# Kanakku Project: Master Developer Context & Changelog

This document serves as the single source of truth for the project's architecture, design system, and implementation history. **Any AI assistant or developer working on this project must read this file first to ensure consistency.**

---

## 🏗 Core Architecture

Kanakku follows a **feature-modular structure** within the frontend to ensure scalability and clarity.

- **Root Directory**: Contains global configuration (`package.json`, `vite.config.ts`, `tsconfig.json`).
- **`frontend/src/app/components/`**: The unified home for all UI components.
  - `core/`: Primary app shells (Dashboard, Accounts, BottomNav, TopBar).
  - `auth/`: Authentication flows, login/signup, and onboarding.
  - `transactions/`: AddTransaction, Transfer, PayEMI, Statement Import.
  - `features/`: Extended modules (Reports, Calendar, VoiceInput, ToDoLists).
  - `shared/`: Reusable layouts and complex patterns (AppLayout, QuickActionModal, Diagnostics).
  - `ui/`: Low-level, reusable atoms (Buttons, Cards, Inputs, Logos).
- **`frontend/src/lib/`**: Core services, business logic, and API clients.
- **`frontend/src/contexts/`**: Global state management (Auth, App, UI).
- **`docs/`**: Archived documentation and implementation guides.
- **`unused/`**: Deprecated or archived code (do not import from here).

### 🏷 Import Conventions
- **Always use absolute aliases**: Use `@/app/components/...` or `@/lib/...`.
- **Avoid relative nesting**: Do not use `../../../`.

---

## 🎨 Design System & Theme

Finora uses a **Premium Glassmorphic Aesthetic**. All new features must adhere to these standards:

### **Color Palette**
- **Primary Gradient**: `#7B4CFF` (Purple) to `#4A9EFF` (Blue).
- **Surface**: High-transparency white/slate backgrounds with `backdrop-blur-xl`.
- **Accents**: 
  - Success: Emerald-500
  - Error: Rose-500
  - Warning: Amber-500

### **UI Tokens**
- **Corners**: `rounded-2xl` (16px) or `rounded-3xl` (24px) for cards and modals.
- **Shadows**: Subtle `shadow-[0_8px_30px_rgb(0,0,0,0.04)]` or glass-borders.
- **Typography**: Modern Sans-Serif (Inter/Outfit). High contrast for titles, muted for metadata.

### **Stacking Context (Z-Index)**
- **Backdrops**: `z-[60]`
- **Modals/Drawers**: `z-[61]`
- **Overlays/Toasts**: `z-[100]`

---

## 📜 Change Log & Evolution

### **Last Updated: 2026-05-11**
**Refactor: Unified Component Architecture & Project De-cluttering**

1.  **Directory Consolidation**:
    - Eliminated `src/components/`. All active components moved to `src/app/components/`.
    - Merged `onboarding` into `src/app/components/auth/onboarding/`.
    - Standardized `shared/` layout components (`AppLayout`, `LimitedModeBanner`).
2.  **Project Root Cleanup**:
    - Moved 70+ standalone documentation files to the `docs/` folder.
    - Moved truly dead code to `frontend/src/unused/`. (Note: `realTime.ts` and `enhanced-sync.ts` were restored to `src/lib/` after being identified as dependencies).
3.  **Path Stabilization**:
    - Fixed lazy-loading paths in `App.tsx` (standardized on feature-folders).
    - Resolved Vite build errors regarding broken relative imports in `AuthFlow.tsx`.
4.  **Mobile UX Fixes**:
    - Restructured `AddTransaction` header for mobile responsiveness.
    - Standardized mobile back button placement (left of title) to avoid burger-menu overlap.
    - Optimized bottom navigation spacing for "safe-area" (notch) devices.

---

## 🤖 Core Intelligence Systems
*   **OCR Bill Scanner**: Tesseract.js engine with multi-variant scoring for high-accuracy receipt extraction.
*   **Bank Statement Parser**: Regex-based engine for PDF/Image bank statements (extracts account details & transactions).
*   **Voice Assistant**: Web Speech API integrated with custom NLP for hands-free expense entry.
*   *Reference*: [INTELLIGENCE_SYSTEMS.md](./docs/intelligence/INTELLIGENCE_SYSTEMS.md)

---

## 📚 Project Documentation
- [Frontend Architecture](./frontend/FRONTEND_ARCHITECTURE.md)

---

## 🛠 Tech Stack Details
- **Frontend**: React + Vite + TypeScript.
- **Styling**: Tailwind CSS (Glassmorphism focus).
- **Backend/Auth**: Supabase.
- **Database**: Dexie.js (Local-first) + Supabase (Sync).
- **Mobile Support**: PWA (Service Workers) + Capacitor-ready.

---

## 💡 Developer Instructions for New Features
1. **Reuse UI**: Check `src/app/components/ui/` before creating new primitive elements.
2. **Standard Headers**: Use `PageHeader` from UI for consistency across modules.
3. **Local-First**: Always ensure data is saved to `localStorage` or `Dexie` before syncing to the cloud.
4. **Theme Check**: If a component looks like "Standard Tailwind/Bootstrap," it is wrong. Apply glassmorphism and the primary gradient.
