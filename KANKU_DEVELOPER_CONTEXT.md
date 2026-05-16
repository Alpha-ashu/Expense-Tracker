# KANKU Project: Master Developer Context & Changelog

This document serves as the single source of truth for the project's architecture, design system, and implementation history. **Any AI assistant or developer working on this project must read this file first to ensure consistency.**

---

## 🏗 Core Architecture

KANKU follows a **feature-modular structure** within the frontend to ensure scalability and clarity.

- **Root Directory**: Contains global configuration (`package.json`, `vite.config.ts`, `tsconfig.json`).
- **`frontend/src/app/components/`**: The unified home for all UI components.
  - `core/`: Primary app shells (Dashboard, Accounts, Transactions, BottomNav, TopBar).
  - `auth/`: Authentication flows, login/signup, and onboarding.
  - `transactions/`: AddTransaction, Transfer, PayEMI, StatementImport, ReceiptScanner, BillUpload.
  - `receipt-scanner/`: Shared sub-views for the ReceiptScanner (ReceiptScannerViews.tsx).
  - `features/`: Extended modules (Reports, Calendar, VoiceInput, ToDoLists).
  - `shared/`: Reusable layouts and complex patterns (AppLayout, QuickActionModal, Diagnostics).
  - `ui/`: Low-level, reusable atoms (Buttons, Cards, Inputs, Logos).
- **`frontend/src/lib/`**: Core services, business logic, and API clients.
- **`frontend/src/contexts/`**: Global state management (Auth, App, UI).
- **`frontend/src/services/`**: Domain services (DocumentManagementService, documentIntelligenceService, receiptScannerService, cloudReceiptScanService).
- **`frontend/src/hooks/`**: Custom hooks (useReceiptScanner, useTransactionCreation).
- **`frontend/src/types/`**: Shared TypeScript types (receipt.types.ts).
- **`docs/`**: Archived documentation and implementation guides.
- **`unused/`**: Deprecated or archived code (do not import from here).

### 🏷 Import Conventions
- **Always use absolute aliases**: Use `@/app/components/...` or `@/lib/...`.
- **Avoid relative nesting**: Do not use `../../../`.

---

## 🎨 Design System & Theme

KANKU uses a **Premium Glassmorphic Aesthetic**. All new features must adhere to these standards:

### **Color Palette**
- **Primary Gradient**: `#7B4CFF` (Purple) to `#4A9EFF` (Blue).
- **Surface**: High-transparency white/slate backgrounds with `backdrop-blur-xl`.
- **Accents**:
  - Success: Emerald-500
  - Error: Rose-500
  - Warning: Amber-500
  - Bill/Attachment: Orange-400 / Orange-500

### **UI Tokens**
- **Corners**: `rounded-[30px]` for cards, `rounded-2xl` (16px) for inner elements.
- **Glassmorphism (Standard)**: `bg-white/80` or `bg-white/70` with `backdrop-blur-xl` and `border-white/20`.
- **Logos & Branding**: Centralized bank/card logo rendering in `src/app/components/ui/AccountLogos.tsx`. This avoids Vite Fast Refresh conflicts by keeping page components as single-export modules.
- **Shadows**: Premium `shadow-xl shadow-black/5` or `shadow-floating`.
- **Typography**: Modern Sans-Serif (Inter/Outfit). High contrast (font-black) for titles, muted for metadata.

### **Stacking Context (Z-Index)**
- **Backdrops**: `z-[60]`
- **Modals/Drawers**: `z-[61]`
- **Transaction Detail Sheet (mobile)**: `z-[61]`
- **Bill Preview Modal**: `z-[70]`
- **Receipt Scanner Overlay**: `z-[80]`
- **Overlays/Toasts**: `z-[100]`

---

## 📜 Change Log & Evolution

---

### **2026-05-16 — Account Import Stability & UI Overhaul**

1. **Deduplication Engine Integration**:
   - Integrated `deduplicateLocalData()` into the `syncUserDataFromBackend` cycle and the primary `AppContext` mount effect.
   - This prevents duplicate accounts and transactions from appearing during cloud-to-local merges, specifically matching by name, type, and currency.
2. **Modularized Branding System**:
   - Decoupled 400+ lines of SVG-heavy logo rendering logic into a dedicated utility: `src/app/components/ui/AccountLogos.tsx`.
   - This resolved persistent Vite Fast Refresh errors (`Duplicate declaration` and `export incompatible`) across core page modules.
3. **Glassmorphic Card Standard (V2)**:
   - Upgraded the `Card` component's `default` and `glass` variants to use a more aggressive `backdrop-blur-xl` and `bg-white/80` aesthetic.
   - Standardized card corners to `rounded-[30px]` for a softer, more premium look.
4. **Statement Import Modal Redesign**:
   - Overhauled the `StatementImport.tsx` UI with a high-fidelity glassmorphic multi-step flow.
   - Added robust error boundaries and defensive date-parsing logic to prevent app crashes during PDF ingestion.
5. **Account Action Consistency**:
   - Restricted the "Import" button visibility to only `bank` and `card` account types, removing it from `cash` and `digital` accounts where statement importing is not applicable.
   - Standardized the placement of account management actions across `Accounts.tsx` and `Dashboard.tsx`.

---

### **2026-05-14 — AddTransaction Workflow & UI Finalization**

1. **Transaction Type Header Restructuring**:
   - Merged the separate transaction type tabs (`Expense`, `Income`, `Transfer`) into the primary top header bar for a compact, single-row design matching the requested pill-style layout.
   - Streamlined mobile layout by hiding the title and exposing only the back arrow and tabs.
2. **Transfer Mode Refinements**:
   - Added a `transferMethod` state (`bank` vs. `cash`) below the Self/Others sub-mode.
   - **Bank Transfer**: Shows the standard "To Account" selection.
   - **Cash Transfer**: Hides the account selection and shows an amber banner acknowledging a direct cash handover.
   - **Others Selection**: Added a full `Friends` picker (pill chips) for selecting external recipients quickly, combined with a manual text input.
3. **Loan Form Simplification**:
   - Institutional loans (`Consumer Loan`, `Personal Loan`, `Home Loan`, `Vehicle Loan`, `Education Loan`, `Credit Card`, `Overdraft`) now automatically hide the individual "Person / Participants" picker, prioritizing the Bank/NBFC dropdown.
   - Fixed conditional visibility so `Overdraft` behaves correctly as an institutional loan.
4. **General UI Polish**:
   - Removed the cluttering "Ref # (Optional)" input field from all modes.
   - "Date" field now spans the full width of its container.
   - **Note**: The AddTransaction page layout and logic flow are now finalized and frozen.

---

### **2026-05-13 (Afternoon) — Receipt & Transaction UX Overhaul**

#### 1. Receipt Scanner — Dual-Mode Flow (`ReceiptScanner.tsx`, `ReceiptScannerViews.tsx`, `receipt.types.ts`)

**Problem**: Camera and gallery both triggered OCR automatically. No way to just attach a file without running OCR.

**Solution**: Introduced a step-machine with two clearly separated workflows:

| Mode | Flow | OCR? |
|------|------|------|
| **Scan Receipt** | Mode → Source (Camera/Gallery) → Preview → OCR → Results | ✅ Yes |
| **Add Attachment** | Mode → Source (Camera/Gallery) → Save doc → Done | ❌ No |

**New components in `ReceiptScannerViews.tsx`**:
- `ModeSelectionView` — Two large action cards: "Scan Receipt" (dark) and "Add Attachment" (light).
- `SourcePickerView` — Camera / Gallery sub-picker reused by both modes. Shows amber info strip in attachment mode.

**Step machine in `ReceiptScanner.tsx`**:
- `mode` → `source-scan` / `source-attach` → `preview-scan` / `attaching` → `results`
- Attachment path: `createDocumentRecord` → `updateDocumentStatus('completed')` → `onAttachmentSaved(docId)`. **Zero OCR.**
- Scan path: existing OCR pipeline unchanged.
- Supports `initialMode` prop to skip mode selection.

**New props on `ReceiptScannerProps`** (in `receipt.types.ts`):
- `onAttachmentSaved?: (documentId: number) => void` — called when attachment-only save completes.
- `initialMode?: 'scan' | 'attachment' | null` — skips mode picker, goes straight to source picker.

---

#### 2. AddTransaction — Inline Receipt Section (`AddTransaction.tsx`)

**Changes**:
- ❌ Removed standalone camera button from the header.
- ✅ Added a **"Receipt" card** in the right column (`lg:col-span-5`) with two buttons:
  - **Scan Receipt** (dark, `ScanLine` icon) — opens scanner in scan mode.
  - **Add Attachment** (light, `Paperclip` icon) — opens scanner in attachment mode.
- ✅ Added `attachmentDocumentId` state alongside existing `scanDocumentId`.
- ✅ On save: links whichever doc ID is set (`scanDocumentId ?? attachmentDocumentId`) to the transaction via `DocumentManagementService.linkTransaction()`.
- ✅ Shows a green "Attached" badge + removable confirmation row when a receipt/attachment is linked.
- ✅ `scannerMode` state (`'scan' | 'attachment' | null`) passed as `initialMode` to `ReceiptScanner`.

**Document linking**: The `attachment` field on the transaction is set to `document:{id}` and `importMetadata['Document Id']` is also set. This is how `Transactions.tsx` detects a linked bill to show the Eye icon.

---

#### 3. Transactions Page — Responsive List & View Bill (`Transactions.tsx`)

**Problem**: Single table layout broke on mobile. Eye (View Bill) icon was hidden behind hover. No mobile detail view.

**Solution**:

**Desktop (lg+)**:
- All 4 columns visible: Details, Category, Account, Amount + Actions.
- **Eye icon** (`text-orange-400`) — **always visible** (not hover-gated) when a bill is attached.
- Edit/Delete icons remain hover-only (`opacity-0 group-hover:opacity-100`).
- "Bill attached" shown as orange `Paperclip` badge in Details cell.

**Mobile (< lg)**:
- Card-based list showing **Details + Amount** only.
- Orange `Paperclip` "Bill" badge shown inline when bill exists.
- `ChevronRight` arrow signals tappable row.
- Tapping any row opens the **Transaction Detail Bottom Sheet**.

**Mobile Detail Sheet** (`motion.div`, `z-[61]`):
- Spring-animated slide-up drawer.
- Drag handle, header with icon + description + date.
- **Amount hero** with transaction type badge.
- Full detail rows: Category, Account, Date, Tax Amount, Notes.
- **"View Attached Bill"** — full-width orange button, always visible when bill attached.
- **Edit** and **Delete** action buttons (2-column grid).
- Backdrop tap to close.

---

### **2026-05-12 (Evening) — Sync Stabilization & User Profile Finalization**

1. **Synchronization Engine Stabilization**:
   - Standardized `cloudId` (camelCase) indexing across `backend-sync-service.ts`, `sync-service.ts`, and `offline-sync-engine.ts`.
   - Resolved persistent `SchemaError` by aligning codebase field names with Dexie Version 11 schema.
2. **User Profile Finalization**:
   - Implemented a modernized **Avatar Gallery** with 28 curated high-quality characters (DiceBear).
   - Fixed selection persistence and preview updates in the profile editor.
   - Standardized date formatting to `DD-MMM-YYYY` (e.g., 25-Aug-1996) using a custom Popover/Calendar component.
   - Applied precision rounding (`Math.round`) to all monthly income calculations to resolve floating-point display errors.
   - **Update Logic Stabilization**: Refactored `avatar-gallery.ts` resolution logic to handle external URLs with query parameters correctly and simplified the `UserProfile` preview logic to use a single-source state (`tempData`), ensuring zero-latency UI updates during selection.
   - **Note**: The User Profile page is now considered "Perfect" and is frozen for future changes.

---

### **2026-05-12 (Morning) — Account Module Finalization & Design Standardization**

1. **Account Module Stabilization**:
   - The **Account Page** and **Add Account** sub-page have been finalized with a premium responsive layout.
   - Standardized glassmorphic cards, balance entry, and brand-specific iconography (Bank/Credit Card/Wallet).
   - **Note**: These pages are considered "Perfect" and should not be edited unless explicitly requested.

---

### **2026-05-11 — Unified Component Architecture & Project De-cluttering**

1. **Directory Consolidation**:
   - Eliminated `src/components/`. All active components moved to `src/app/components/`.
   - Merged `onboarding` into `src/app/components/auth/onboarding/`.
   - Standardized `shared/` layout components (`AppLayout`, `LimitedModeBanner`).
2. **Project Root Cleanup**:
   - Moved 70+ standalone documentation files to the `docs/` folder.
   - Moved truly dead code to `frontend/src/unused/`. (Note: `realTime.ts` and `enhanced-sync.ts` were restored to `src/lib/` after being identified as dependencies).
3. **Path Stabilization**:
   - Fixed lazy-loading paths in `App.tsx` (standardized on feature-folders).
   - Resolved Vite build errors regarding broken relative imports in `AuthFlow.tsx`.
4. **Mobile UX Fixes**:
   - Restructured `AddTransaction` header for mobile responsiveness.
   - Standardized mobile back button placement (left of title) to avoid burger-menu overlap.
   - Optimized bottom navigation spacing for "safe-area" (notch) devices.

---

## 🤖 Core Intelligence Systems
- **OCR Bill Scanner**: Cloud OCR (Google Gemini Vision) primary, Tesseract.js on-device fallback. Privacy mode toggle preserves user data locally. Two separate modes: **Scan Receipt** (OCR-enabled) and **Add Attachment** (OCR-disabled).
- **Bank Statement Parser**: Regex-based engine for PDF/Image bank statements (extracts account details & transactions).
- **Voice Assistant**: Web Speech API integrated with custom NLP for hands-free expense entry.
- **AI Categorization**: `backendService.categorizeText()` — auto-categorizes from merchant/description with confidence scoring (>0.45 threshold).
- *Reference*: [INTELLIGENCE_SYSTEMS.md](./docs/intelligence/INTELLIGENCE_SYSTEMS.md)

---

## 📦 Document & Attachment System

Documents are stored in the **Dexie `documents` table** (`DocumentRecord`).

### How a bill gets linked to a transaction:
1. **Scan mode**: `useReceiptScanner` calls `DocumentManagementService.createDocumentRecord()` during scan → `linkTransaction(docId, txId)` sets `attachment: 'document:{id}'` and `importMetadata['Document Id']` on the transaction.
2. **Attachment mode**: `ReceiptScanner` calls `createDocumentRecord()` → `updateDocumentStatus('completed')` → returns `docId` via `onAttachmentSaved`. `AddTransaction` stores it in `attachmentDocumentId` and links it on save.

### How to detect a linked bill:
```ts
const getDocumentIdFromTransaction = (tx) => {
  const match = tx.attachment?.match(/^document:(\d+)$/);
  if (match) return parseInt(match[1]);
  const id = parseInt(tx.importMetadata?.['Document Id'] || '');
  return isFinite(id) ? id : null;
};
```
- If `attachedDocumentId` is truthy → show **Eye (View Bill)** icon.
- `DocumentManagementService.getDocument(id)` → `fileData` → `URL.createObjectURL()` for preview.

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
- **Animations**: Framer Motion (`motion.div`, `AnimatePresence`, spring transitions).

---

## 💡 Developer Instructions for New Features
1. **Reuse UI**: Check `src/app/components/ui/` before creating new primitive elements.
2. **Standard Headers**: Use `PageHeader` from UI for consistency across modules.
3. **Local-First**: Always ensure data is saved to `localStorage` or `Dexie` before syncing to the cloud.
4. **Theme Check**: If a component looks like "Standard Tailwind/Bootstrap," it is wrong. Apply glassmorphism and the primary gradient.
5. **Frozen Pages**: The **Account Page**, **Add Account** sub-page, **User Profile** page, and **Add Transaction** page are finalized. **DO NOT** modify their layout, logic, or features unless the user specifically requests changes to them.
6. **Receipt/Bill System**: When adding receipt support to any new module, use `DocumentManagementService` directly. Do NOT reinvent document storage. Pass `initialMode` to `ReceiptScanner` to pre-select the workflow.
7. **Mobile Responsiveness**: Every list/table must have a mobile card view. Use `hidden lg:block` for desktop tables and `lg:hidden` for mobile card lists. Tapping a row should open a bottom-sheet detail view.
8. **View Bill Icon**: Always use `Eye` icon from `lucide-react` in `text-orange-400` color. It must be **always visible** (not hover-gated) when `attachedDocumentId` is truthy.
