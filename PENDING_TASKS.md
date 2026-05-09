# Finora – Pending Tasks, Enhancements & Dependencies

> Last updated: 9 May 2026  
> Use this file as the living backlog. Move items to `DONE` when completed.

---

## Table of Contents
1. [Critical / Must-Do](#1-critical--must-do)
2. [Backend Hardening](#2-backend-hardening)
3. [Frontend Hardening](#3-frontend-hardening)
4. [Offline & Sync](#4-offline--sync)
5. [Testing](#5-testing)
6. [Performance](#6-performance)
7. [DevOps & Deployment](#7-devops--deployment)
8. [New Features](#8-new-features)
9. [Dependencies to Install](#9-dependencies-to-install)
10. [Dependencies to Remove / Audit](#10-dependencies-to-remove--audit)
11. [Environment Variables Checklist](#11-environment-variables-checklist)

---

## 1. Critical / Must-Do

| # | Task | File(s) | Priority |
|---|---|---|---|
| ~~C-1~~ | ~~Refactor all backend controllers to use `next(err)` + `AppError` instead of inline `res.status().json()` error blocks~~ | `auth.controller.ts`, `pin.routes.ts`, `sync.routes.ts` | ✅ Done |
| C-2 | Add `express-rate-limit` separate stricter limiter to all auth endpoints (`/auth/login`, `/auth/register`, `/auth/reset-password`) | `backend/src/app.ts` or route files | ✅ Already existed on `/auth/login` & `/auth/register` |
| C-3 | All PIN management routes (`/pin/*`) must require biometric/OTP verification before change — currently PIN can be changed with just the old PIN | `backend/src/modules/pin/` | 🔴 High |
| C-4 | Remove duplicate token keys in `TokenManager` — 4 different keys store the same access token (`accessToken`, `auth_token`, `token`, `authToken`). Standardise to one key. | `frontend/src/lib/api.ts` | 🔴 High |
| C-5 | Supabase RLS policies need to be verified and applied for every user-scoped table. Check `supabase/` migrations. | `supabase/` | 🔴 High |
| C-6 | Replace `any` types in controller function signatures with typed `AuthRequest` + proper DTO interfaces | `backend/src/modules/*/**.controller.ts` | 🔴 High |

---

## 2. Backend Hardening

| # | Task | File(s) | Priority |
|---|---|---|---|
| ~~B-1~~ | ~~Add `requestId` middleware to stamp every request with a unique ID~~ | `backend/src/app.ts` | ✅ Done – uses `crypto.randomUUID()`, sets `X-Request-Id` header |
| ~~B-2~~ | ~~Add `express-async-errors` package~~ | N/A | ✅ Done – used `try/catch + next(err)` pattern instead (no extra package needed) |
| B-3 | Centralise Prisma error codes in `errorHandler` — `P2002` (unique), `P2025` (not found), `P2003` (FK) — **already done in `AppError.ts`**, but verify all controllers no longer catch these manually | All controllers | 🟠 Medium |
| ~~B-4~~ | ~~Add input sanitisation middleware globally~~ | `backend/src/app.ts` | ✅ Done – body sanitizer wired as middleware |
| B-5 | Add `helmet.contentSecurityPolicy` config tuned for the Supabase storage URLs used in the app | `backend/src/app.ts` | 🟠 Medium |
| ~~B-6~~ | ~~Verify the new sync route has proper auth + validation middleware~~ | `backend/src/modules/sync/sync.routes.ts` | ✅ Done – refactored with AppError validation |
| B-7 | `server.js` at project root is a plain JS file alongside the TS source. Clarify whether it is still used or can be removed | `backend/server.js` | 🟡 Low |
| B-8 | Add pagination support (`limit`/`offset` or cursor-based) to `GET /transactions`, `GET /accounts`, `GET /loans` — large datasets will be slow without it | `backend/src/modules/transactions/`, etc. | ✅ Already exists in transactions controller |
| B-9 | Add `morgan` HTTP request logger if not already wired — every inbound request should be logged in dev | `backend/src/app.ts` | ✅ Basic request logging already via Winston in app.ts |
| ~~B-10~~ | ~~Stocks module (`api/stocks.ts`) — standardise error shape to `{ success, error, code }`~~ | `api/stocks.ts` | ✅ Done |

---

## 3. Frontend Hardening

| # | Task | File(s) | Priority |
|---|---|---|---|
| F-1 | Replace `any` in `api.ts` helper methods (`create(data: any)`, `update(id, data: any)`) with typed DTOs matching the backend Zod schemas | `frontend/src/lib/api.ts` | 🟠 Medium |
| F-2 | `safeExecute` in `errorHandling.ts` uses `error.message` directly from caught error — pipe through `getUserMessage()` from `api.ts` for consistency | `frontend/src/lib/errorHandling.ts` | 🟠 Medium |
| F-3 | `wrapAsyncFunction` exposes `error.message` (technical) in the created `AppError` — filter through friendly map before showing toast | `frontend/src/lib/errorHandling.ts` | 🟠 Medium |
| ~~F-4~~ | ~~Wire `setupGlobalErrorHandlers()` in `main.tsx`~~ | `frontend/src/main.tsx` | ✅ Done |
| ~~F-5~~ | ~~Add a global `<ErrorBoundary>` wrapper~~ | `frontend/src/app/App.tsx` | ✅ Done – `PageErrorBoundary` already wraps all pages; now logs to console instead of rendering raw error message |
| F-6 | `ProfileCache` in `api.ts` uses a simple 5-second TTL — consider using TanStack Query for profile caching | `frontend/src/lib/api.ts` | 🟡 Low |
| F-7 | Add Zod-based response schema validation — validate API responses before using them | `frontend/src/lib/api.ts` | 🟠 Medium |
| ~~F-8~~ | ~~Toast duration inconsistent — standardise via a constant~~ | `frontend/src/lib/errorHandling.ts` | ✅ Done – `TOAST_DURATION` constants added |
| F-9 | Add a loading skeleton/spinner component for all data-fetching states | `frontend/src/components/` | 🟡 Low |
| F-10 | Implement a proper offline indicator banner | `frontend/src/components/` | ✅ Already exists – `OfflineBanner` component wired in App.tsx |

---

## 4. Offline & Sync

| # | Task | File(s) | Priority |
|---|---|---|---|
| S-1 | Dexie schema version management — ensure every table that participates in cloud sync has `syncStatus` and `updatedAt` fields; audit current Dexie schema | `frontend/src/` (Dexie db file) | 🔴 High |
| S-2 | Implement a proper sync queue: failed writes should be stored with `syncStatus: 'error'` and retried using `retryAsync` from `errorHandling.ts` | `frontend/src/services/` | 🔴 High |
| S-3 | The backend `sync.service.ts` needs to be audited — verify it handles conflicts (server vs local) with a deterministic strategy (e.g. server-wins or last-write-wins by `updatedAt`) | `backend/src/modules/sync/sync.service.ts` | 🔴 High |
| S-4 | Background sync should be scoped per user — ensure `userId` is part of the Dexie compound index so data from different users never mixes on shared devices | `frontend/src/` (Dexie db file) | 🔴 High |
| S-5 | Add a Service Worker for background sync using Workbox (`workbox-window` is already installed) — currently sync only happens when the app is open | `frontend/src/` | 🟠 Medium |

---

## 5. Testing

| # | Task | File(s) | Priority |
|---|---|---|---|
| T-1 | Add unit tests for `AppError` class and the new `errorHandler` — test each error type normalisation path | `backend/tests/` | 🟠 Medium |
| T-2 | Add unit tests for `ValidationErrorHandler.showErrors` to confirm field names are not in toast output | `frontend/` (vitest) | 🟠 Medium |
| T-3 | Integration tests for `POST /auth/login` and `POST /auth/register` with invalid inputs to verify friendly error shapes | `backend/tests/integration/auth.test.ts` | 🟠 Medium |
| T-4 | Add frontend Vitest tests for `ErrorFactory.fromHTTPStatus` covering all mapped status codes | `frontend/` (vitest) | 🟡 Low |
| T-5 | Add E2E tests (Playwright or Cypress) for the login, registration, and transaction CRUD flows | `tests/` | 🟡 Low |
| T-6 | Current `jest_results*.txt` files indicate some test failures — review and fix the failing tests before the next release | `backend/jest_results*.txt` | 🟠 Medium |
| T-7 | Add test coverage thresholds in `jest.config.ts` (backend) and `vitest.config.ts` (frontend) — target ≥ 80% | Config files | 🟡 Low |

---

## 6. Performance

| # | Task | File(s) | Priority |
|---|---|---|---|
| P-1 | Add database indexes on `userId` + `createdAt` for `transactions`, `accounts`, `loans`, `goals` — missing indexes will cause full table scans | `backend/prisma/schema.prisma` | 🔴 High |
| P-2 | Implement TanStack Query (`@tanstack/react-query`) for all server-state fetching — removes redundant `useEffect`+`useState` data fetching patterns | Frontend-wide | 🟠 Medium |
| P-3 | Route-level code splitting with `React.lazy` — heavy pages like Dashboard, Reports, Investments should be lazy loaded | `frontend/src/app/` | 🟠 Medium |
| P-4 | Bundle analysis — run `npx vite-bundle-visualizer` and identify packages that can be tree-shaken or replaced with lighter alternatives | Root | 🟡 Low |
| P-5 | `tesseract.js` is loaded in the frontend bundle but is very heavy (~5 MB). Load it lazily only when the receipt scanner feature is used | `frontend/src/hooks/useReceiptScanner.ts` | 🟠 Medium |

---

## 7. DevOps & Deployment

| # | Task | File(s) | Priority |
|---|---|---|---|
| D-1 | Add a `.env.example` for the frontend root (mirroring `backend/.env.example`) — all `VITE_*` variables should be documented | Root `.env.example` | 🟠 Medium |
| D-2 | `docker-compose.yml` exists at root and in `backend/` — consolidate into one root-level file that starts both services | Root `docker-compose.yml` | 🟡 Low |
| D-3 | Add a GitHub Actions CI workflow: lint → type-check → test (backend Jest + frontend Vitest) on every PR | `.github/workflows/ci.yml` | 🟠 Medium |
| D-4 | Add `prisma migrate deploy` to the Dockerfile `CMD` or a startup script so migrations run automatically on container start | `backend/Dockerfile` | 🟠 Medium |
| D-5 | `vercel.json` is present — verify Vercel serverless functions in `api/` match the Express route shapes and return the same `{ success, error, code }` envelope | `api/`, `vercel.json` | 🟠 Medium |
| D-6 | Android release keystore `finance-life-release.keystore` is tracked in git — move it to secure CI secrets or a secrets manager | `android/` | 🔴 High |

---

## 8. New Features

| # | Feature | Notes | Priority |
|---|---|---|---|
| N-1 | Push notifications for bill due dates | `@capacitor/local-notifications` is already installed — wire up to `bills` module | 🟠 Medium |
| N-2 | Export transactions as PDF / CSV | `jspdf` and `papaparse` are already installed — build the export service | 🟠 Medium |
| N-3 | AI-powered spending insights (monthly summary, anomaly alerts) | `@google/generative-ai` is installed on backend — build a `/api/v1/ai/insights` endpoint | 🟠 Medium |
| N-4 | Multi-currency support | Store currency code per account; convert on display using an exchange rate API | 🟡 Low |
| N-5 | Recurring transaction scheduling | Auto-create transactions on a schedule (daily/weekly/monthly) via a cron job | 🟡 Low |
| N-6 | Dark / Light / System theme toggle | `next-themes` is installed — ensure all components respect the theme class | 🟡 Low |
| N-7 | Biometric login (fingerprint / Face ID) on mobile | Use `@capacitor/biometric-auth` plugin | 🟡 Low |
| N-8 | Shared expenses / groups | `groups/` and `friends/` modules already exist in backend — complete the frontend UI | 🟡 Low |

---

## 9. Dependencies to Install

### Backend (`cd backend && npm install <package>`)

| Package | Why | Command |
|---|---|---|
| `express-async-errors` | Automatically forwards async errors to Express `next(err)` — eliminates manual try-catch in every controller | `npm install express-async-errors` |
| `morgan` | HTTP request logging middleware (if not already wired) | `npm install morgan && npm install -D @types/morgan` |
| `express-mongo-sanitize` | Sanitise user input against NoSQL/operator injection | `npm install express-mongo-sanitize` |
| `uuid` | Generate request IDs for tracing (`req.id`) | `npm install uuid && npm install -D @types/uuid` |
| `express-validator` | Alternative/complement to Zod for param-level validation | *(optional — only if Zod alone is insufficient)* |
| `pino` + `pino-http` | Faster structured logger (consider replacing Winston if performance matters) | *(optional — evaluate before adding)* |

### Frontend (`npm install <package>` at root)

| Package | Why | Command |
|---|---|---|
| `@tanstack/react-query` | Server-state cache, background refetch, stale-while-revalidate | `npm install @tanstack/react-query` |
| `@tanstack/react-query-devtools` | Query inspector in dev mode | `npm install -D @tanstack/react-query-devtools` |
| `vite-bundle-visualizer` | Analyse and reduce bundle size | `npm install -D vite-bundle-visualizer` |
| `@capacitor-community/biometric-auth` | Fingerprint / Face ID login on Android & iOS | `npm install @capacitor-community/biometric-auth` |
| `@sentry/react` + `@sentry/vite-plugin` | Error tracking & performance monitoring in production | `npm install @sentry/react && npm install -D @sentry/vite-plugin` |
| `workbox-precaching` + `workbox-routing` | Full service worker / PWA caching (complement to `workbox-window` already installed) | `npm install workbox-precaching workbox-routing` |
| `@vitest/coverage-v8` | Code coverage for Vitest | `npm install -D @vitest/coverage-v8` |

### Full install commands (copy-paste ready)

```powershell
# Backend
cd backend
npm install express-async-errors uuid morgan
npm install -D @types/uuid @types/morgan

# Frontend (root)
cd ..
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools vite-bundle-visualizer @vitest/coverage-v8
```

---

## 10. Dependencies to Remove / Audit

| Package | Location | Reason |
|---|---|---|
| `sqlite3` | Root `package.json` | Frontend should never use SQLite directly. Dexie (IndexedDB) is already used. Check if this is a leftover. |
| `sqlite3` | `backend/package.json` | Backend uses Prisma + PostgreSQL. Verify this is only used for the `dev.db` fallback and is not needed in production. |
| `bcrypt` + `bcryptjs` | Both `package.json` files | Both are installed. Standardise on one — prefer `bcryptjs` for pure-JS compatibility on all platforms. |
| `axios` | Root `package.json` | The frontend uses a custom Fetch-based `HTTPClient` in `api.ts`. If `axios` is unused, remove it. |
| `react-slick` | Root `package.json` | Check if `embla-carousel-react` (also installed) replaces this. Remove the unused one. |
| `regenerator-runtime` | Root `package.json` | Vite + modern targets do not need this polyfill. Remove if not explicitly required. |
| `@types/helmet` | `backend/package.json` | `helmet` v8+ ships its own types. This `@types/` package is outdated and may conflict. |
| `check-*.js`, `test-*.js` files | `backend/` root | Loose JS scripts (`check_profiles.js`, `check-db.js`, etc.) are dev utilities — move to `scripts/` or delete. |

---

## 11. Environment Variables Checklist

Ensure all of the following are set before each environment. Create `.env` from `.env.example`.

### Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `JWT_SECRET` | ✅ Yes | Min 32 chars, random string |
| `SUPABASE_URL` | ✅ Yes | From Supabase project settings |
| `SUPABASE_ANON_KEY` | ✅ Yes | Public anon key |
| `SUPABASE_SERVICE_KEY` | ✅ Yes | **Never expose to frontend** |
| `SUPABASE_JWT_SECRET` | ✅ Yes | From Supabase → Settings → API |
| `FRONTEND_URL` | ✅ Yes | CORS allowed origin (e.g. `https://yourapp.com`) |
| `NODE_ENV` | ✅ Yes | `development` / `production` |
| `PORT` | ⬜ Optional | Default `3000` |
| `REDIS_URL` | ⬜ Optional | If using ioredis for rate-limit store |
| `GEMINI_API_KEY` | ⬜ Optional | For `@google/generative-ai` AI features |

### Frontend (`.env` at root)

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Yes | Same as backend `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Public anon key only |
| `VITE_API_URL` | ✅ Yes | Backend base URL (e.g. `https://api.yourapp.com`) |
| `VITE_APP_ENV` | ⬜ Optional | `development` / `production` for feature flags |

---

## Done ✅
*(Move completed items here with the date)*

- [x] Created `AppError` class with factory methods (`backend/src/utils/AppError.ts`) — 9 May 2026
- [x] Enhanced central `errorHandler` to handle Prisma errors, Zod errors, and malformed JSON — 9 May 2026
- [x] Frontend `api.ts` toasts replaced with `ErrorHandler.handle()` + friendly message map — 9 May 2026
- [x] `ValidationErrorHandler.showErrors` no longer exposes raw field names in toasts — 9 May 2026
- [x] Proper `console.error` logging added throughout (`logToService`, network handler, recovery) — 9 May 2026
- [x] Created `docs/skills/frontend.skill.md` — 9 May 2026
- [x] Created `docs/skills/backend.skill.md` — 9 May 2026
- [x] Created `docs/skills/database.skill.md` — 9 May 2026
- [x] Created `docs/skills/security.skill.md` — 9 May 2026
- [x] **C-1** – `auth.controller.ts`, `pin.routes.ts`, `sync.routes.ts` refactored to `AppError` + `next(err)` — 9 May 2026
- [x] **C-2** – Auth rate limiter on `/auth/login` + `/auth/register` confirmed present — 9 May 2026
- [x] **B-1** – `requestId` middleware added to `app.ts` using `crypto.randomUUID()`, sets `X-Request-Id` header — 9 May 2026
- [x] **B-2** – `try/catch + next(err)` pattern adopted across refactored controllers (no extra package needed) — 9 May 2026
- [x] **B-4** – Global body-sanitize middleware wired in `app.ts` — 9 May 2026
- [x] **B-6** – Sync routes refactored with AppError validation and userId guard — 9 May 2026
- [x] **B-8** – Pagination already implemented in `transaction.controller.ts` (page/limit params) — 9 May 2026
- [x] **B-9** – Request logging via Winston already wired in `app.ts` — 9 May 2026
- [x] **B-10** – `api/stocks.ts` standardised to `{ success, error, code }` envelope — 9 May 2026
- [x] **F-4** – `setupGlobalErrorHandlers()` called in `main.tsx` before app render — 9 May 2026
- [x] **F-5** – `PageErrorBoundary` in `App.tsx` now logs to console via `componentDidCatch`; no longer shows raw `error.message` to users — 9 May 2026
- [x] **F-8** – `TOAST_DURATION` constants exported from `errorHandling.ts`; all durations now consistent — 9 May 2026
- [x] **F-10** – `OfflineBanner` component already wired in `App.tsx` — 9 May 2026
- [x] **404 handler** – Updated in `app.ts` to return `{ success: false, error, code }` shape — 9 May 2026

