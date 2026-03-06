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
