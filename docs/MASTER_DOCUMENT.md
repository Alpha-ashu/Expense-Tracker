# Kanakku - Master Technical Documentation

## Executive Summary

Kanakku is a comprehensive personal finance management platform with web (PWA), mobile (Capacitor), and AI-powered features. It combines a React frontend, Express backend, Supabase-managed PostgreSQL database, and AI services for receipt OCR and financial insights.

---

## 1. Tech Stack Overview

### 1.1 [Intelligence Systems (OCR & Voice NLP)](./intelligence/INTELLIGENCE_SYSTEMS.md)

### 1.2 Frontend Architecture

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | React | 18.3.1 | UI library with hooks |
| Build Tool | Vite | 6.3.5 | Fast dev server & bundling |
| Language | TypeScript | 5.3.3 | Type-safe development |
| Styling | Tailwind CSS | 4.1.12 | Utility-first CSS (Glassmorphism focus) |
| UI Components | Radix UI | 1.2.3+ | Accessible primitives |
| UI Components | MUI (Material) | 7.3.5 | Complex components |
| Animation | Framer Motion | 12.23.24 | Page transitions & micro-interactions |
| State | React Context | - | Global state management |
| Icons | Lucide React | 0.487.0 | Icon library |
| Charts | Recharts | 2.15.2 | Financial visualizations |
| Testing | Vitest | 4.1.0 | Unit testing |
| Mobile Wrapper | Capacitor | 8.0.2 | iOS/Android native apps |
| PWA | Workbox | 7.4.0 | Service workers & offline |

**Architecture Style**: Feature-Modular Unified Structure
- **Root**: `frontend/src/app/`
- **Components**: `frontend/src/app/components/{feature}/`
- **Imports**: Absolute aliases via `@/app/components/...`
- **Design**: Premium Glassmorphism (HSL, Backdrop-blur-xl)

### 1.3 Backend Architecture

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 18.x+ | Server runtime |
| Framework | Express.js | 4.22.1 | HTTP server & API |
| Language | TypeScript | 5.3.3 | Type-safe development |
| Database ORM | Prisma | 6.19.2 | Type-safe DB queries |
| Auth | JWT (jsonwebtoken) | 9.0.3 | Custom token verification |
| Auth | bcrypt | 6.0.0 | Password/PIN hashing |
| Real-time | Socket.IO | 4.7.4 | WebSocket events |
| Validation | Zod | 3.23.8 | Schema validation |
| Logging | Winston | 3.19.0 | Structured logging |
| Testing | Jest | 29.7.0 | Unit & integration tests |
| AI | @google/generative-ai | 0.24.1 | Gemini integration |
| OCR | Tesseract.js | 7.0.0 | Receipt text extraction |
| Image | Sharp | 0.33.5 | Image processing |
| File Upload | Multer | 1.4.5 | HTTP file uploads |
| Security | Helmet | 8.1.0 | Security headers |
| CORS | cors | 2.8.5 | Cross-origin requests |

### 1.4 Database & Storage

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary DB | Supabase PostgreSQL | Managed Postgres |
| ORM | Prisma Client | Type-safe queries |
| Cache | Redis (optional) | Session & rate limiting |
| File Storage | Supabase Storage | Receipt images & bills |
| Offline Storage | Dexie.js (IndexedDB) | Client-side caching |

### 1.5 Infrastructure & Deployment

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Hosting | Vercel | Frontend & API serverless |
| Database | Supabase | Managed PostgreSQL |
| AI Service | Google Gemini API | OCR & insights |
| Auth Service | Supabase Auth | User management |
| Local Dev | Docker Compose | Postgres + API containers |
| CI/CD | (Not configured) | Manual deployment |

### 1.6 Third-Party Integrations

| Service | Integration Point | Purpose |
|---------|-------------------|---------|
| Google Gemini | Backend API | Receipt OCR & AI insights |
| Tesseract.js | Frontend + Backend | Fallback OCR |
| Supabase Auth | Frontend + Backend | User authentication |
| Supabase Storage | Backend | File uploads |
| Supabase Realtime | Available but unused | (Socket.IO preferred) |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Web App    │  │  PWA (Web)   │  │ iOS App      │  │ Android App  │        │
│  │  (Browser)   │  │ (Installed)  │  │ (Capacitor)  │  │ (Capacitor)│        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │               │                │
│         └─────────────────┴─────────────────┴───────────────┘                │
│                           │                                                  │
│                    ┌──────┴──────┐                                           │
│                    │  React + Vite│                                           │
│                    │  (Feature-   │                                           │
│                    │   Modular)   │                                           │
│                    └──────┬───────┘                                           │
└───────────────────────────┼─────────────────────────────────────────────────┘
                            │ HTTPS/WebSocket
┌───────────────────────────┼─────────────────────────────────────────────────┐
│                           ▼                                                  │
│                         API LAYER                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Vercel Serverless Functions                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Express API │  │  Socket.IO   │  │  API Routes  │               │   │
│  │  │  (/api/v1/*) │  │  (WebSocket) │  │  (/api/*.ts) │               │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │   │
│  └─────────┼────────────────┼────────────────┼────────────────────────────┘   │
│            │                │                │                              │
└────────────┼────────────────┼────────────────┼────────────────────────────────┘
             │                │                │
             └────────────────┴────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────────────┐
│                             ▼                                                │
│                        SERVICE LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Auth Service │ │ PIN Service  │ │ AI/OCR       │ │ Transaction  │       │
│  │ (JWT +       │ │ (bcrypt      │ │ Service      │ │ Service      │       │
│  │  Supabase)   │ │  + lockout)  │ │ (Gemini)     │ │ (Balance     │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │  + Dedup)    │       │
│         │                │                │         └──────┬───────┘       │
│         └────────────────┴────────────────┴────────────────┘               │
│                              │                                               │
│                    ┌─────────┴─────────┐                                    │
│                    │   Prisma Client    │                                    │
│                    │  (Type-safe ORM)   │                                    │
│                    └─────────┬─────────┘                                    │
└──────────────────────────────┼────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼────────────────────────────────────────────────┐
│                              ▼                                                │
│                        DATA LAYER                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Managed PostgreSQL                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │   │
│  │  │   Users      │ │  Accounts    │ │ Transactions │ │   Goals    │ │   │
│  │  │   (Auth)     │ │  (Balances)  │ │  (History)   │ │ (Tracking) │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │   │
│  │  │    Loans     │ │ Investments  │ │ Group Exp    │ │ User Pins  │ │   │
│  │  │  (Payments)  │ │ (Portfolio)  │ │ (Shared)     │ │ (Security) │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Storage                                 │   │
│  │                    (Receipts & Bills)                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Authentication Flow

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Client  │────────▶│  Supabase    │────────▶│   Custom     │────────▶│   Prisma     │
│          │         │   Auth       │         │    JWT       │         │   User       │
└──────────┘         └──────────────┘         └──────────────┘         └──────────────┘
     │                      │                       │                       │
     │ 1. Sign up/login     │                       │                       │
     │──────────────────────▶│                       │                       │
     │                      │                       │                       │
     │ 2. Return session    │                       │                       │
     │◀──────────────────────│                       │                       │
     │                      │                       │                       │
     │ 3. API call with token│                      │                       │
     │──────────────────────────────────────────────▶│                       │
     │                      │                       │                       │
     │                      │                       │ 4. Verify JWT         │
     │                      │                       │ 5. Lookup user status │
     │                      │                       │───────────────────────▶│
     │                      │                       │                       │
     │ 6. Return data       │                       │◀──────────────────────│
     │◀──────────────────────────────────────────────│                       │
```

### 2.3 Data Flow - Transaction Creation

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Frontend │───▶│ Backend  │───▶│ Prisma   │───▶│ Postgres │
│ Action   │    │ API Call │    │ Validate │    │ Create   │    │ Store    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     │ 1. Enter      │               │               │               │
     │ transaction   │               │               │               │
     │───────────────▶│               │               │               │
     │               │               │               │               │
     │               │ 2. POST       │               │               │
     │               │ /api/v1/      │               │               │
     │               │ transactions  │               │               │
     │               │───────────────▶│               │               │
     │               │               │               │               │
     │               │               │ 3. Validate   │               │
     │               │               │ - Amount > 0  │               │
     │               │               │ - Dedup hash  │               │
     │               │               │ - Auth check  │               │
     │               │               │               │               │
     │               │               │ 4. Prisma    │               │
     │               │               │ create       │               │
     │               │               │───────────────▶│               │
     │               │               │               │               │
     │               │               │               │ 5. Insert    │
     │               │               │               │ + Trigger    │
     │               │               │               │ (balance)    │
     │               │               │               │───────────────▶
     │               │               │               │               │
     │               │               │               │ 6. Return    │
     │               │               │◀──────────────│◀──────────────│
     │               │◀──────────────│               │               │
     │◀──────────────│               │               │               │
```

---

## 3. Feature Catalog

### 3.1 Core Financial Features

| Feature | Description | Data Models | API Endpoints |
|---------|-------------|-------------|---------------|
| **Accounts** | Bank, card, cash, wallet tracking | Account, User | `/api/v1/accounts/*` |
| **Transactions** | Income/expense/transfer recording | Transaction, Account | `/api/v1/transactions/*` |
| **Categories** | Custom expense/income categories | Category, User | `/api/v1/categories/*` |
| **Budgets** | Spending limits & alerts | (via Categories) | `/api/v1/reports/*` |
| **Goals** | Savings targets with contributions | Goal, GoalContribution | `/api/v1/goals/*` |
| **Loans** | Borrowed/lent money tracking | Loan, LoanPayment | `/api/v1/loans/*` |
| **Investments** | Stocks, crypto, assets tracking | Investment, User | `/api/v1/investments/*` |
| **Group Expenses** | Shared bills with friends | GroupExpense, GroupExpenseMember | `/api/v1/group-expenses/*` |

### 3.2 AI-Powered Features

| Feature | Description | Tech Stack | Flow |
|---------|-------------|------------|------|
| **Receipt OCR** | Extract data from receipt images | Gemini API + Tesseract | Upload → Backend → Gemini → Parse → Transaction |
| **Smart Categorization** | Auto-categorize transactions | Gemini NLP | Transaction → Gemini → Category suggestion |
| **AI Insights** | Spending patterns & advice | Gemini analysis | Data aggregation → Gemini → Insights |
| **Voice Input** | Speech-to-text expense entry | Web Speech API + Gemini | Voice → Text → Parse → Transaction |
| **Bank Statement Import** | PDF/CSV parsing & import | Tesseract + PDF.js | Upload → Parse → Preview → Import |

### 3.3 Security Features

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **PIN Protection** | 4-6 digit app lock | bcrypt hash, lockout after 5 failures |
| **PIN Backup** | Recovery key for forgotten PIN | Encrypted key storage |
| **Biometric Auth** | Fingerprint/Face ID | Capacitor Biometric plugin |
| **Session Management** | Device tracking & revocation | Device table + JWT expiry |
| **Transaction Dedup** | Prevent duplicate entries | SHA256 hash of amount+date+merchant |
| **Audit Logging** | Security event tracking | Winston audit logs |

### 3.4 Social & Collaboration

| Feature | Description | Data Models |
|---------|-------------|-------------|
| **Friends** | Contact list for shared expenses | Friend, User |
| **Group Expenses** | Split bills, track who paid | GroupExpense, GroupExpenseMember |
| **Advisor Booking** | Schedule financial advisor sessions | BookingRequest, AdvisorSession |
| **Chat** | Real-time messaging with advisor | ChatMessage (Socket.IO) |
| **Notifications** | Push & in-app alerts | Notification, Socket.IO |

### 3.5 Import & Export

| Feature | Description | Supported Formats |
|---------|-------------|-------------------|
| **Bank Statement Import** | Import transaction history | PDF, CSV, Excel |
| **Receipt Scanning** | OCR to transaction | JPG, PNG, PDF |
| **Data Export** | Backup & portability | CSV, JSON, PDF reports |
| **Category Import** | Bulk category creation | CSV |

### 3.6 Mobile-First Features

| Feature | Description | Platform |
|---------|-------------|----------|
| **Offline Mode** | Work without internet | Dexie.js IndexedDB |
| **Background Sync** | Auto-sync when online | Service Worker |
| **Push Notifications** | Reminders & alerts | Capacitor Push + FCM/APNS |
| **Haptic Feedback** | Touch vibration | Capacitor Haptics |
| **Home Screen Widget** | Quick add transaction | iOS/Android widgets |
| **SMS Parsing** | Auto-import from bank SMS | Android only |

---

## 4. Database Schema

### 4.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MANAGEMENT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐        │
│  │     User     │◀───────│   UserPin    │        │ UserSettings │        │
│  │──────────────│        │──────────────│        │──────────────│        │
│  │ id (PK)      │        │ id (PK)      │        │ id (PK)      │        │
│  │ email (UQ)   │        │ userId (FK)  │        │ userId (FK)  │        │
│  │ password     │        │ pinHash      │        │ theme        │        │
│  │ name         │        │ keyBackup    │        │ language     │        │
│  │ role         │        │ expiresAt    │        │ currency     │        │
│  │ status       │        │ failedAtt... │        │ timezone     │        │
│  │ isApproved   │        │ lockedUntil  │        │ settings     │        │
│  └──────────────┘        └──────────────┘        └──────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            FINANCIAL CORE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐        │
│  │    Account   │◀───────│  Transaction │        │   Category   │        │
│  │──────────────│        │──────────────│        │──────────────│        │
│  │ id (PK)      │        │ id (PK)      │        │ id (PK)      │        │
│  │ userId (FK)  │        │ userId (FK)  │        │ userId (FK)  │        │
│  │ name         │        │ accountId(FK)│        │ name         │        │
│  │ type         │        │ type         │        │ type         │        │
│  │ balance      │◀───────│ amount       │        │ color        │        │
│  │ currency     │        │ category     │◀───────│ icon         │        │
│  │ isActive     │        │ date         │        └──────────────┘        │
│  └──────────────┘        │ description  │                                │
│                          │ merchant     │        ┌──────────────┐        │
│                          │ dedupHash    │        │    Friend    │        │
│                          └──────────────┘        │──────────────│        │
│                                                  │ id (PK)      │        │
│                                                  │ userId (FK)  │        │
│  ┌──────────────┐        ┌──────────────┐        │ name         │        │
│  │     Goal     │◀───────│GoalContribution│      │ email        │        │
│  │──────────────│        │──────────────│        │ phone        │        │
│  │ id (PK)      │        │ id (PK)      │        └──────────────┘        │
│  │ userId (FK)  │        │ goalId (FK)  │                                │
│  │ name         │        │ accountId(FK)│        ┌──────────────┐        │
│  │ targetAmount │        │ amount       │        │   ExpenseBill│        │
│  │ currentAmount│        │ date         │        │──────────────│        │
│  │ targetDate   │        └──────────────┘        │ id (PK)      │        │
│  └──────────────┘                                │ userId (FK)  │        │
│                                                  │ storagePath  │        │
│  ┌──────────────┐        ┌──────────────┐        │ sha256       │        │
│  │     Loan     │◀───────│  LoanPayment │        │ scanStatus   │        │
│  │──────────────│        │──────────────│        └──────────────┘        │
│  │ id (PK)      │        │ id (PK)      │                                │
│  │ userId (FK)  │        │ loanId (FK)  │                                │
│  │ name         │        │ amount       │                                │
│  │ principal    │        │ date         │                                │
│  │ outstanding  │◀───────│ notes        │                                │
│  │ interestRate │        └──────────────┘                                │
│  │ dueDate      │                                                        │
│  └──────────────┘                                                        │
│                                                                              │
│  ┌──────────────┐                                                        │
│  │  Investment  │                                                        │
│  │──────────────│                                                        │
│  │ id (PK)      │                                                        │
│  │ userId (FK)  │                                                        │
│  │ assetType    │                                                        │
│  │ assetName    │                                                        │
│  │ quantity     │                                                        │
│  │ buyPrice     │                                                        │
│  │ currentPrice │                                                        │
│  │ totalInvested│◀─── Computed by trigger                                │
│  │ currentValue │◀─── Computed by trigger                                │
│  │ profitLoss   │◀─── Computed by trigger                                │
│  └──────────────┘                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SOCIAL & GROUP                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                              │
│  │   GroupExpense   │◀───│GroupExpenseMember│                              │
│  │──────────────────│    │──────────────────│                              │
│  │ id (PK)          │    │ id (PK)          │                              │
│  │ userId (FK)      │    │ groupExpenseId(FK)│                             │
│  │ name             │    │ userId (FK)      │                              │
│  │ totalAmount      │    │ name             │                              │
│  │ paidBy           │    │ email            │                              │
│  │ splitType        │    │ phone            │                              │
│  │ yourShare        │    │ shareAmount      │                              │
│  │ members (JSON)   │    │ hasPaid          │                              │
│  └──────────────────┘    └──────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADVISOR & BOOKING                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐│
│  │   Booking    │───▶│   Advisor    │───▶│   Payment    │    │  ChatMsg  ││
│  │   Request    │    │   Session    │    │              │    │          ││
│  │──────────────│    │──────────────│    │──────────────│    │──────────││
│  │ id (PK)      │    │ id (PK)      │    │ id (PK)      │    │ id (PK)  ││
│  │ clientId(FK) │    │ bookingId(FK)│    │ sessionId(FK)│    │sessionId ││
│  │ advisorId(FK)│    │ advisorId(FK)│    │ clientId(FK) │    │senderId  ││
│  │ sessionType  │    │ clientId(FK) │    │ advisorId(FK)│    │message   ││
│  │ amount       │    │ startTime    │    │ amount       │    │timestamp ││
│  │ status       │    │ status       │    │ status       │    └──────────┘│
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                              │
│  ┌──────────────┐                                                            │
│  │   Advisor    │                                                            │
│  │ Availability │                                                            │
│  │──────────────│                                                            │
│  │ id (PK)      │                                                            │
│  │ advisorId(FK)│                                                            │
│  │ dayOfWeek    │                                                            │
│  │ startTime    │                                                            │
│  │ endTime      │                                                            │
│  └──────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Database Indexes (Performance Optimized)

| Table | Index | Purpose |
|-------|-------|---------|
| Transaction | `(userId, date DESC)` | User transaction history |
| Transaction | `(deletedAt)` | Soft-delete filtering |
| Account | `(userId)` | User's accounts lookup |
| Account | `(deletedAt)` | Active accounts filter |
| Loan | `(userId, status)` | Active loans by user |
| Loan | `(dueDate)` | Upcoming payments |
| Goal | `(userId, targetDate)` | Goals by deadline |
| Investment | `(userId, assetType)` | Portfolio grouping |
| Notification | `(userId, isRead)` | Unread notifications |

### 4.3 Database Triggers (Data Integrity)

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_update_account_balance` | Transaction | Auto-recalculate account balance |
| `trg_update_loan_balance` | LoanPayment | Auto-update outstanding balance |
| `trg_update_investment_values` | Investment | Auto-compute current value & P&L |

---

## 5. API Reference

### 5.1 REST API Endpoints

#### Authentication
```
POST   /api/v1/auth/register        # User registration
POST   /api/v1/auth/login          # User login
GET    /api/v1/auth/profile         # Get current user profile
PUT    /api/v1/auth/profile         # Update profile
POST   /api/v1/auth/otp/send        # Send OTP
POST   /api/v1/auth/otp/verify     # Verify OTP
DELETE /api/v1/auth/logout         # Logout (revoke token)
```

#### PIN Management
```
POST   /api/v1/pin/create          # Create PIN
POST   /api/v1/pin/verify          # Verify PIN
GET    /api/v1/pin/status          # Check PIN status
PUT    /api/v1/pin/update          # Change PIN
DELETE /api/v1/pin/delete          # Remove PIN
POST   /api/v1/pin/backup          # Create backup key
POST   /api/v1/pin/recover         # Recover with backup
```

#### Accounts
```
GET    /api/v1/accounts             # List all accounts
POST   /api/v1/accounts            # Create account
GET    /api/v1/accounts/:id       # Get account details
PUT    /api/v1/accounts/:id       # Update account
DELETE /api/v1/accounts/:id       # Delete account (soft)
```

#### Transactions
```
GET    /api/v1/transactions                 # List transactions
POST   /api/v1/transactions                # Create transaction
GET    /api/v1/transactions/:id            # Get transaction
PUT    /api/v1/transactions/:id            # Update transaction
DELETE /api/v1/transactions/:id            # Delete transaction
GET    /api/v1/transactions/summary        # Transaction summary
GET    /api/v1/transactions/by-category     # Grouped by category
GET    /api/v1/transactions/by-month        # Monthly aggregation
```

#### Categories
```
GET    /api/v1/categories            # List categories
POST   /api/v1/categories           # Create category
PUT    /api/v1/categories/:id      # Update category
DELETE /api/v1/categories/:id      # Delete category
```

#### Goals
```
GET    /api/v1/goals                 # List goals
POST   /api/v1/goals                # Create goal
GET    /api/v1/goals/:id            # Get goal
PUT    /api/v1/goals/:id            # Update goal
DELETE /api/v1/goals/:id            # Delete goal
POST   /api/v1/goals/:id/contribute # Add contribution
GET    /api/v1/goals/:id/progress   # Goal progress
```

#### Loans
```
GET    /api/v1/loans                 # List loans
POST   /api/v1/loans                # Create loan
GET    /api/v1/loans/:id            # Get loan
PUT    /api/v1/loans/:id            # Update loan
DELETE /api/v1/loans/:id            # Delete loan
POST   /api/v1/loans/:id/payments   # Add payment
GET    /api/v1/loans/:id/payments   # List payments
GET    /api/v1/loans/:id/schedule    # Payment schedule
```

#### Investments
```
GET    /api/v1/investments          # List investments
POST   /api/v1/investments         # Create investment
GET    /api/v1/investments/:id     # Get investment
PUT    /api/v1/investments/:id     # Update investment
DELETE /api/v1/investments/:id     # Delete investment
GET    /api/v1/investments/summary # Portfolio summary
```

#### Group Expenses
```
GET    /api/v1/group-expenses           # List group expenses
POST   /api/v1/group-expenses          # Create group expense
GET    /api/v1/group-expenses/:id     # Get details
PUT    /api/v1/group-expenses/:id     # Update
DELETE /api/v1/group-expenses/:id     # Delete
POST   /api/v1/group-expenses/:id/members      # Add member
PUT    /api/v1/group-expenses/:id/members/:id # Update member
DELETE /api/v1/group-expenses/:id/members/:id # Remove member
POST   /api/v1/group-expenses/:id/settle      # Mark as settled
```

#### Advisor & Booking
```
GET    /api/v1/advisors              # List advisors
GET    /api/v1/advisors/:id          # Get advisor profile
GET    /api/v1/advisors/:id/availability  # Get availability
POST   /api/v1/bookings               # Create booking
GET    /api/v1/bookings               # List my bookings
GET    /api/v1/bookings/:id           # Get booking details
PUT    /api/v1/bookings/:id/status   # Update status
POST   /api/v1/bookings/:id/cancel    # Cancel booking
```

#### AI & OCR
```
POST   /api/v1/ai/scan-receipt        # Scan receipt image
POST   /api/v1/ai/parse-statement     # Parse bank statement
POST   /api/v1/ai/categorize           # Auto-categorize
GET    /api/v1/ai/insights            # Get AI insights
POST   /api/v1/ai/voice-parse         # Parse voice input
```

#### Bills & Files
```
POST   /api/v1/bills/upload          # Upload receipt/bill
GET    /api/v1/bills                 # List uploaded bills
GET    /api/v1/bills/:id             # Get bill details
GET    /api/v1/bills/:id/download    # Download file
DELETE /api/v1/bills/:id             # Delete bill
```

#### Reports
```
GET    /api/v1/reports/monthly        # Monthly report
GET    /api/v1/reports/yearly         # Yearly report
GET    /api/v1/reports/category       # Category breakdown
GET    /api/v1/reports/trends         # Spending trends
GET    /api/v1/reports/export         # Export data
```

### 5.2 WebSocket Events (Socket.IO)

#### Client → Server Events
```javascript
// Sync
socket.emit('sync_request', { lastSyncedAt, entityTypes })
socket.emit('transaction_update', { transaction })
socket.emit('account_update', { account })
socket.emit('goal_update', { goal })

// Booking
socket.emit('booking_request', { bookingId, message })
socket.emit('booking_status_update', { bookingId, status, rejectionReason })

// Payment
socket.emit('payment_status_update', { paymentId, status })

// Chat
socket.emit('chat_message', { sessionId, message })
```

#### Server → Client Events
```javascript
// Sync responses
socket.on('sync_response', (data) => {})
socket.on('transaction_updated', (data) => {})
socket.on('transaction_saved', (data) => {})
socket.on('account_updated', (data) => {})
socket.on('account_saved', (data) => {})
socket.on('goal_updated', (data) => {})
socket.on('goal_saved', (data) => {})

// Booking notifications
socket.on('booking_notification', (data) => {})
socket.on('booking_status_changed', (data) => {})
socket.on('booking_status_updated', (data) => {})

// Payment notifications
socket.on('payment_status_changed', (data) => {})
socket.on('payment_received', (data) => {})
socket.on('payment_status_updated', (data) => {})

// Chat
socket.on('new_message', (data) => {})
socket.on('message_sent', (data) => {})

// Connection
socket.on('connect', () => {})
socket.on('disconnect', () => {})
socket.on('error', (error) => {})
```

---

## 6. Security Architecture

### 6.1 Authentication Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Supabase Auth (Primary Identity)                                   │
│  ├── Email/Password authentication                                           │
│  ├── Email verification                                                      │
│  ├── Password reset                                                          │
│  └── Session management                                                      │
│                                                                              │
│  Layer 2: Custom JWT (API Access)                                            │
│  ├── Issued after Supabase auth                                              │
│  ├── Contains: userId, email, role, isApproved                             │
│  ├── Signed with JWT_SECRET                                                  │
│  └── Verified on every API request                                           │
│                                                                              │
│  Layer 3: PIN Code (App Access)                                              │
│  ├── bcrypt hashed in database                                                │
│  ├── 5 failed attempts = 15 min lockout                                      │
│  ├── Optional backup key for recovery                                          │
│  └── Device-specific (optional)                                              │
│                                                                              │
│  Layer 4: Device Tracking                                                      │
│  ├── Device ID stored locally                                                │
│  ├── Server tracks active devices                                            │
│  └── Revocation support                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Data Security

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcrypt with salt (backend) |
| **PIN Hashing** | bcrypt with salt rounds 10 |
| **API Security** | Helmet.js headers, CORS whitelist |
| **Rate Limiting** | Express rate-limit middleware |
| **Input Validation** | Zod schemas on all inputs |
| **SQL Injection** | Prisma ORM (parameterized queries) |
| **XSS Protection** | Helmet, React auto-escaping |
| **CSRF Protection** | SameSite cookies, CORS origin check |
| **File Upload** | Multer with size limits, Sharp sanitization |

### 6.3 RLS (Row Level Security)

All core tables have RLS policies enforcing:
```sql
-- Users can only access their own data
USING (auth.uid() = user_id)

-- Storage policies enforce user isolation
USING (auth.uid()::text = (storage.foldername(name))[1])
```

**Note:** Express uses Service Role Key which bypasses RLS. Access control enforced in middleware.

---

## 7. Deployment Architecture

### 7.1 Production Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Vercel Edge Network                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │   │
│  │  │  Static Frontend │  │  API Functions   │  │  Edge Config     │ │   │
│  │  │  (Global CDN)    │  │  (Serverless)    │  │  (Feature flags) │ │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              │ WebSocket (Long polling fallback)             │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Supabase Platform                            │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │   │
│  │  │  PostgreSQL      │  │  Auth Service    │  │  Storage         │   │   │
│  │  │  (Primary DB)    │  │  (User Mgmt)     │  │  (Files)         │   │   │
│  │  │                  │  │                  │  │                  │   │   │
│  │  │  - Read replicas │  │  - JWT issuance  │  │  - Receipts      │   │   │
│  │  │  - Automated     │  │  - OAuth         │  │  - Bills         │   │   │
│  │  │    backups       │  │  - Magic links   │  │  - Signed URLs   │   │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              │ API calls                                      │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Third-Party Services                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │   │
│  │  │  Google Gemini   │  │  (Optional:       │  │  (Optional:      │   │   │
│  │  │  AI/OCR API      │  │   SendGrid)      │  │   Stripe)        │   │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Development Environment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LOCAL DEVELOPMENT STACK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │   Frontend   │◀───────▶│   Backend    │◀───────▶│   Postgres   │        │
│  │   (Vite)     │  Proxy  │   (Express)  │         │   (Docker)   │        │
│  │   :5173      │         │   :3000      │         │   :5432      │        │
│  └──────────────┘         └──────────────┘         └──────────────┘        │
│         │                       │                       │                 │
│         │                       │                       │                 │
│         ▼                       ▼                       ▼                 │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │  Hot Reload  │         │  ts-node-dev │         │  Volume      │        │
│  │  HMR         │         │  restart     │         │  Persistence │        │
│  └──────────────┘         └──────────────┘         └──────────────┘        │
│                                                                              │
│  Optional: Connect to Supabase for auth instead of local                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Mobile App Deployment

| Platform | Status | Deployment Target |
|----------|--------|-------------------|
| **Web (PWA)** | Live | Vercel CDN |
| **iOS** | Configured, not deployed | App Store (pending) |
| **Android** | Configured, not deployed | Play Store (pending) |

**Capacitor Configuration:**
- App ID: `com.financelife.app`
- App Name: FinanceLife
- Web Dir: `dist` (Vite build output)

---

## 8. Feature Flows

### 8.1 User Registration Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Frontend │───▶│ Backend  │───▶│ Supabase │───▶│  Email   │
│          │    │          │    │          │    │   Auth   │    │ Service  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     │ 1. Enter      │               │               │               │
     │ email/pass    │               │               │               │
     │───────────────▶│               │               │               │
     │               │               │               │               │
     │               │ 2. POST       │               │               │
     │               │ /auth/register│               │               │
     │               │───────────────▶│               │               │
     │               │               │               │               │
     │               │               │ 3. Validate   │               │
     │               │               │ - Email format│               │
     │               │               │ - Password    │               │
     │               │               │   strength    │               │
     │               │               │               │               │
     │               │               │ 4. Create user│               │
     │               │               │───────────────▶│               │
     │               │               │               │               │
     │               │               │               │ 5. Send       │
     │               │               │               │ confirmation  │
     │               │               │               │───────────────▶
     │               │               │               │               │
     │               │               │ 6. Return     │               │
     │               │               │◀──────────────│               │
     │               │               │   session     │               │
     │               │◀──────────────│               │               │
     │ 7. Show PIN   │               │               │               │
     │ setup prompt  │               │               │               │
     │◀──────────────│               │               │               │
```

### 8.2 Receipt Scanning Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Frontend │───▶│ Backend  │───▶│   OCR    │───▶│  Gemini  │
│          │    │ Camera   │    │          │    │ (Tesser- │    │   AI     │
│          │    │ /Upload  │    │          │    │  act.js) │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     │ 1. Take/      │               │               │               │
     │ upload photo  │               │               │               │
     │───────────────▶│               │               │               │
     │               │               │               │               │
     │               │ 2. POST       │               │               │
     │               │ /ai/scan-     │               │               │
     │               │ receipt       │               │               │
     │               │ (FormData)    │               │               │
     │               │───────────────▶│               │               │
     │               │               │               │               │
     │               │               │ 3. Save to    │               │
     │               │               │    Storage    │               │
     │               │               │               │               │
     │               │               │ 4. Extract    │               │
     │               │               │    text       │               │
     │               │               │───────────────▶│               │
     │               │               │               │               │
     │               │               │               │ 5. Structured │
     │               │               │               │    parsing    │
     │               │               │               │───────────────▶
     │               │               │               │               │
     │               │               │               │ 6. JSON       │
     │               │               │               │    result     │
     │               │               │               │◀──────────────│
     │               │               │ 7. Parse &  │               │
     │               │               │    validate │               │
     │               │               │               │               │
     │               │ 8. Return     │               │               │
     │               │    extracted  │               │               │
     │               │    data       │               │               │
     │               │◀──────────────│               │               │
     │               │               │               │               │
     │ 9. Show       │               │               │               │
     │    preview &  │               │               │               │
     │    confirm    │               │               │               │
     │◀──────────────│               │               │               │
```

### 8.3 Offline Sync Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │───▶│ Frontend │───▶│  Dexie   │───▶│  Backend │
│ Action   │    │   React  │    │(IndexedDB)│   │   API    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │ 1. Action     │               │               │
     │ (offline)     │               │               │
     │───────────────▶│               │               │
     │               │               │               │
     │               │ 2. Store      │               │
     │               │ locally       │               │
     │               │───────────────▶│               │
     │               │               │               │
     │               │ 3. Show       │               │
     │               │    optimistic │               │
     │               │    update     │               │
     │               │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │               │               │               │
     │               │ (later)       │               │
     │               │ 4. Detect     │               │
     │               │    online     │               │
     │               │               │               │
     │               │ 5. Sync       │               │
     │               │    queued     │               │
     │               │    items      │               │
     │               │───────────────┼───────────────▶│
     │               │               │               │
     │               │               │               │ 6. Validate
     │               │               │               │    & save
     │               │               │               │
     │               │ 7. Update     │               │
     │               │    local ID   │               │
     │               │◀──────────────│◀──────────────│
     │               │               │               │
     │ 8. Show       │               │               │
     │    sync       │               │               │
     │    complete   │               │               │
     │◀──────────────│               │               │
```

### 8.4 Group Expense Split Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Creator  │    │ Backend  │    │ Database │    │ Members  │
│          │    │          │    │          │    │ (Friends)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │ 1. Create     │               │               │
     │ group expense │               │               │
     │ + add members │               │               │
     │───────────────▶│               │               │
     │               │               │               │
     │               │ 2. Create     │               │
     │               │ GroupExpense  │               │
     │               │ + Members     │               │
     │               │───────────────▶│               │
     │               │               │               │
     │               │               │ 3. Store      │               │
     │               │               │ relationships │               │
     │               │               │               │
     │               │               │               │ 4. Notify
     │               │               │               │ (if registered)
     │               │               │───────────────▶
     │               │               │               │
     │ 5. Show       │               │               │
     │    expense    │               │               │
     │    with       │               │               │
     │    split      │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │               │               │               │
     │ (later)       │               │               │
     │ 6. Member     │               │               │
     │    marks paid │               │               │
     │───────────────▶│               │               │
     │               │               │               │
     │               │ 7. Update     │               │
     │               │    member     │               │
     │               │    status     │               │
     │               │───────────────▶│               │
```

---

## 9. Environment Variables

### 9.1 Frontend (.env)

```env
# API Configuration
VITE_API_URL=https://api.Kanakku .app
VITE_API_PROXY_TARGET=http://localhost:3000

# Supabase Configuration
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...

# Feature Flags
VITE_DEBUG_PWA=false
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_VOICE_INPUT=true
```

### 9.2 Backend (.env)

```env
# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://postgres:pass@host:5432/db

# Supabase (Auth & Storage)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Redis (Optional)
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# AI Services
GOOGLE_API_KEY=AIza...

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# PIN Security
MAX_PIN_ATTEMPTS=5
PIN_LOCKOUT_MINUTES=15
PIN_EXPIRY_DAYS=90
```

---

## 10. Development Guide

### 10.1 Local Setup

```bash
# 1. Clone & install
git clone <repo>
cd Kanakku 
npm install

# 2. Setup environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Edit both .env files with your credentials

# 3. Database (Option A: Supabase)
# Use existing Supabase project

# 3. Database (Option B: Local Docker)
cd backend
docker-compose up -d

# 4. Run migrations
cd backend
npx prisma migrate dev

# 5. Start backend
cd backend
npm run dev

# 6. Start frontend (new terminal)
cd frontend
npm run dev
```

### 10.2 Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npx prisma migrate dev` | Create/apply migrations |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma studio` | Open DB GUI |
| `npx cap sync` | Sync Capacitor plugins |
| `npx cap open ios` | Open iOS project |
| `npx cap open android` | Open Android project |

### 10.3 Testing Strategy

| Test Type | Tool | Location | Status |
|-----------|------|----------|--------|
| Unit Tests | Vitest | `frontend/**/*.test.ts` | Active |
| Unit Tests | Jest | `backend/**/*.test.ts` | Partial |
| Integration | Jest | `backend/tests/integration/` | Security tests only |
| E2E Tests | - | - | Not implemented |

---

## 11. Roadmap & Known Issues

### 11.1 Completed Features ✅
- User authentication (email/password, OTP)
- PIN security with lockout
- Account & transaction management
- Categories & budgeting
- Goals with contributions
- Loan tracking with payments
- Investment portfolio
- Group expenses (basic)
- Receipt OCR (Gemini + Tesseract)
- Bank statement import
- PWA with offline support
- Socket.IO real-time sync
- Advisor booking system
- File upload & storage

### 11.2 In Progress 🚧
- Group expense member relation migration (JSON → relational)
- Currency consistency (USD vs INR)
- Mobile app store deployment
- Biometric authentication

### 11.3 Planned 📋
- Bank API integrations (Plaid, Open Banking)
- Recurring transaction automation
- Investment price auto-sync
- Tax reporting
- Multi-language support
- Dark mode polish
- Push notification refinement

### 11.4 Known Technical Debt

| Issue | Severity | Location |
|-------|----------|----------|
| Mixed UI libraries (MUI + Radix) | Medium | Frontend components |
| Socket.IO on serverless | High | Vercel deployment |
| Tesseract.js bundle size | Medium | Frontend vendors chunk |
| No E2E tests | High | Testing gap |
| Currency mismatch | Medium | Profile vs Transaction |
| Missing CHECK constraints | Low | Database (partial) |

---

## 12. File Structure

```
Kanakku /
├── frontend/                    # React web application
│   ├── src/
│   │   ├── app/                # Main application code
│   │   │   ├── components/     # React components
│   │   │   │   ├── ui/        # Reusable UI (Radix-based)
│   │   │   │   └── ...        # Feature components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── pages/         # Route pages
│   │   ├── contexts/          # React contexts (Auth, etc.)
│   │   ├── lib/               # Utility libraries
│   │   │   ├── api.ts         # API client
│   │   │   ├── socket-client.ts
│   │   │   ├── pwa.ts         # PWA utilities
│   │   │   └── supabase-helpers.ts
│   │   ├── services/          # Business logic services
│   │   │   ├── ocrService.ts
│   │   │   ├── receiptScannerService.ts
│   │   │   └── ...
│   │   ├── styles/            # CSS & Tailwind
│   │   └── utils/             # Helper functions
│   ├── public/                # Static assets
│   └── vite.config.ts         # Vite configuration
│
├── backend/                     # Express API server
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication
│   │   │   ├── transactions/  # Transaction logic
│   │   │   ├── accounts/      # Account management
│   │   │   ├── ai/            # OCR & AI services
│   │   │   ├── pin/           # PIN security
│   │   │   └── ...
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.ts        # JWT verification
│   │   │   └── rateLimit.ts   # Rate limiting
│   │   ├── db/                # Database setup
│   │   │   ├── prisma.ts      # Prisma client
│   │   │   └── supabase.ts    # Supabase client
│   │   ├── config/            # Configuration
│   │   │   ├── env.ts         # Environment validation
│   │   │   └── logger.ts      # Winston logging
│   │   ├── sockets/           # Socket.IO handlers
│   │   └── app.ts             # Express app setup
│   ├── 3. Intelligence Layer:
│       *   OCR: Tesseract.js with multi-variant scoring.
│       *   Bank: Regex-based structured document parser.
│       *   Voice: Web Speech API with natural language expense extraction.
│       *   Reference: [INTELLIGENCE_SYSTEMS.md](./docs/intelligence/INTELLIGENCE_SYSTEMS.md)
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database migrations
│   ├── tests/                 # Test suites
│   └── docker-compose.yml     # Local dev stack
│
├── api/                        # Vercel serverless functions
│   ├── stocks.ts              # Stock API proxy
│   ├── auth.ts                # Auth helpers
│   └── health.ts              # Health check
│
├── supabase/                   # Supabase configuration
│   └── migrations/            # SQL migrations
│       ├── 001_create_tables.sql
│       ├── 002_enable_rls.sql
│       └── ...
│
├── capacitor.config.json      # Capacitor mobile config
├── vercel.json                # Vercel deployment config
├── package.json               # Root workspace config
└── README.md                  # Project documentation
```

---

## 13. Contact & Support

- **Project**: Kanakku  Personal Finance
- **Repository**: Private
- **Deployment**: Vercel + Supabase
- **Support**: Via in-app chat (Advisor system)

---

*Document Version: 1.0*
*Last Updated: April 2026*
*Status: Production Ready*
