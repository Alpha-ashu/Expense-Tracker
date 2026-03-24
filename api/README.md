# API

This folder contains lightweight serverless endpoints that are separate from the main Express backend.

## Current files

- `auth.ts`
- `health.ts`
- `stocks.ts`
- `users.ts`

## Use cases

- small deployable endpoints for Vercel/serverless hosting
- health checks
- thin integrations that do not need the full backend runtime

## Important boundary

The main application authority still lives in [`backend/`](../backend/README.md). Keep business logic, authz rules, sync identity, and core persistence there unless there is a clear reason to duplicate them in serverless form.
