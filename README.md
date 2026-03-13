# Expense Tracker - Framework Organization

This repository has been newly structured for better maintainability and clarity. The application framework follows a modular architecture separating frontend interfaces, backend services, database scripts, external API integrations, and comprehensive documentation.

## Directory Structure

Here is how the project is organized:

### Architecture

- **`frontend/`** 
  Contains the core client-side code (`src`, `public`). The Vite build process runs from the project root but scopes all of its compilation, components, UI rendering, and routing inside this directory.
- **`backend/`**
  Houses the local Node.js / Express backend server (`src/server.ts`), complete with Prisma ORM setup, JWT token implementations, REST endpoints, and WebSocket sync.
- **`database/`**
  Contains direct database logic outside of the Prisma ORM — strictly initialization scripts (`init.sql`) and standalone database migration configurations.
- **`api/`**
  Contains Vercel serverless function integrations. This hosts lightweight, scalable endpoints (e.g. `auth.ts`, `users.ts`, `health.ts`) independently deployable from your main local backend architecture.
- **`docs/` & `guidelines/`**
  Contains project documentation, architecture details, diagrams, and standardized guidelines for the framework.
- **`supabase/`**
  Contains Supabase-specific configurations and offline-first database mapping schemas if applicable.

### Testing and Utilities

- **`tests/`**
  All test files, mock data (JSON), visual runner HTMLs, and enterprise test-suite configurations are kept here, maintaining the purity of backend/frontend logic.
- **`scripts/`**
  Build scripts and DevOps commands (such as PowerShell deployment macros `e2e-build.ps1`).
- **`android/`**
  Capacitor output and mobile platform files for building native Android APKs.
- **`resources/`**
  Global static assets, branding files, and generalized resources not exclusively tied to the frontend UI layer.

### Root Configuration (The "Glue")

The root folder is kept minimal and primarily retains foundational configuration rules for:
- Environment Variables (`.env`)
- Build Pipelines (`vite.config.ts`, `package.json`)
- Deployments (`vercel.json`, `docker-compose.yml`)
- Source Code Type Definitions and Linter rules (`tsconfig.json`, `postcss.config.mjs`)

## QA Feature Matrix (Admin)

Use this to seed admin data and run an automated end-to-end backend API check for:

- Dashboard
- Accounts
- Transactions
- Calendar
- Group Expense
- Loan
- Todo List
- Investment
- Report
- Goals
- Setting

### Local run (one command)

From `backend/`:

```bash
npm run qa:test-features
```

From project root:

```bash
npm run qa:backend
```

This command will:

1. Seed deterministic admin mock data.
2. Start the backend server.
3. Run the feature matrix script against `/api/v1`.
4. Stop the backend server automatically.

### CI run

GitHub Actions workflow:

- `.github/workflows/backend-feature-matrix.yml`

The workflow runs on backend changes for pushes and pull requests.

## Frontend-Backend Flow Summary

The app is local-first with cloud synchronization:

1. Frontend screens render from Dexie (IndexedDB) via live queries in App Context.
2. Auth establishes session and role; backend JWT protects `/api/v1` routes.
3. Writes are applied locally first and queued/synced to backend and cloud.
4. Backend persists source-of-truth financial entities in Prisma models.
5. Redis caches selected GET routes with user-scoped keys and TTL policies.
6. Cache invalidation runs after create/update/delete mutations.

Key files:

- `frontend/src/contexts/AppContext.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/lib/auth-sync-integration.ts`
- `frontend/src/lib/backend-api.ts`
- `backend/src/routes/index.ts`
- `backend/src/cache/redis.ts`
- `backend/src/middleware/cache.ts`
- `backend/src/cache/cache-policy.ts`

## QA Troubleshooting

### 1) Matrix fails with connection error

Symptom: `Unable to connect to the remote server` during `qa:matrix`.

Fix:

```bash
cd backend
npm run qa:test-features
```

Use `qa:test-features` (not `qa:matrix` directly) so the script can start and stop the backend automatically.

### 2) Port 3000 already in use

Symptom: backend fails to start.

Fix (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

Then rerun:

```bash
cd backend
npm run qa:test-features
```

### 3) Prisma column/model mismatch

Symptom: errors like `column ... does not exist` during seed or runtime.

Fix:

```bash
cd backend
npx prisma db push
npx prisma generate
```

### 4) Login/auth test failures

Symptom: auth endpoints return 401/invalid credentials.

Fix:

1. Ensure admin seed runs successfully.
2. Use the seeded credentials:
  - Email: `shaik.job.details@gmail.com`
  - Password: `123456789`
  - PIN: `123456`

### 5) Local DB appears dirty after QA

Symptom: `git status` shows `backend/prisma/dev.db` modified.

Reason: expected local seeded test data.

Suggested handling:

1. Keep it uncommitted for local testing.
2. Commit only code/docs/workflow/script files.

### 6) CI feature matrix fails on health check

Symptom: workflow times out waiting for `/health`.

Fix checklist:

1. Verify backend build passes locally: `cd backend && npm run build`.
2. Verify workflow starts backend from `backend/` working directory.
3. Check workflow artifact `backend-dev-log` for startup errors.
