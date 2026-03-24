# Backend Scripts

Supported backend helper scripts live here.

## Current scripts

- `seed-admin-feature-data.cjs`: deterministic admin/demo data seed
- `run-feature-matrix.ps1`: feature matrix execution
- `run-feature-matrix-with-server.ps1`: starts backend, runs matrix, stops backend

## Preferred usage

```bash
npm run qa:seed-admin
npm run qa:matrix
npm run qa:test-features
```

Prefer the package scripts instead of calling PowerShell files directly.
