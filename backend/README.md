# Backend

This folder contains the primary application server.

## Owns

- Express API routes and middleware
- JWT/session auth enforcement
- Socket.IO event handling
- Prisma data model and migrations
- Sync endpoints and conflict handling
- Server-side PIN, receipt, and payment security logic

## Key folders

- `src/modules/`: feature modules
- `src/middleware/`: auth, validation, rate limiting, caching
- `src/sockets/`: realtime socket entrypoints
- `src/db/`: Prisma client wiring
- `prisma/`: schema and migrations
- `tests/`: Jest integration coverage
- `scripts/`: supported QA/seed helpers

## Commands

```bash
npm run dev
npm run build
npm test
npm run qa:test-features
```

## Environment

- Local template: [`backend/.env.example`](./.env.example)
- Test template: [`backend/.env.test`](./.env.test)
- Runtime secrets should stay in local `.env` files only

## Notes

- `server.js` and several loose helper scripts in this folder are historical utilities. Prefer `src/server.ts` and package scripts for normal development.
- Prisma-generated client output is under `generated/`.
