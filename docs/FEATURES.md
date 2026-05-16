# Expense Tracker - Feature Specification

##  Product Overview
A full-stack, cloud-synced personal finance management platform with modular architecture, clean UI, role-based control, and scalable performance.

##  Core Principles
- **Modular Design**: All features are reusable components
- **Clean Architecture**: Consistent UI/UX patterns
- **Scalability**: Built for performance and growth
- **Cloud-First**: Real-time sync across devices

---

##  Feature Modules

### 1. Dashboard (Home)
**Purpose**: Centralized DashBoard

**Features**:
- Total balance across all accounts (real-time)
- Monthly income vs expense summary
- Savings rate percentage
- Recent transactions feed
- Active goals progress bars
- Quick actions:
  -  Add Expense
  -  Add Income
  -  Transfer
  -  Voice input

**Components**: `Dashboard.tsx`

---

### 2. Accounts Management
**Purpose**: Multi-account financial tracking

**Account Types**:
-  Bank
-  Cash
-  Credit Cards
-  Savings

**Features**:
- Add / Edit / Delete accounts
- Color-coded account cards
- Live balance updates
- Account-specific filtering
- Inter-account transfers
- Swipe + Tab based UI

**Components**: `Accounts.tsx`, `AddAccount.tsx`, `EditAccount.tsx`

---

### 3. Transactions System
**Purpose**: Comprehensive transaction management

**Input Methods**:
-  Manual form entry
-  Voice AI (speech  structured data)
-  Receipt scan (OCR)

**Transaction Schema**:
```typescript
{
  user_id: string
  account_id: string
  account_type: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  category: string
  subcategory?: string
  date: Date
  notes?: string
  tags?: string[]
  attachment?: string
}
```

**Features**:
- Categorization + subcategories
- Notes & tags
- Receipt attachments
- Edit/Delete capabilities
- Smart filters (account, category, date, type)

**Components**: `Transactions.tsx`, `AddTransaction.tsx`

---

### 4. Savings Goals
**Purpose**: Track progress towards financial goals

**Features**:
- Create multiple goals
- Target amount + deadline
- Visual progress bars
- Add contributions
- Completion notifications
- Priority ordering

**Components**: `Goals.tsx`, `AddGoal.tsx`

---

### 5. Loans & EMI Management
**Purpose**: Track borrowed/lent money and EMI schedules

**Features**:
- Borrowed/Lent tracking
- EMI schedules
- Interest calculation
- Payment history
- Automated reminders

**Components**: `Loans.tsx`, `PayEMI.tsx`

---

### 6. Investment Portfolio
**Purpose**: Track investment performance

**Supported Assets**:
-  Stocks
-  Cryptocurrency
-  Gold
-  Forex

**Features**:
- Current value tracking
- Profit/Loss calculation
- Historical trends
- Portfolio summary

**Components**: `Investments.tsx`, `AddInvestment.tsx`, `EditInvestment.tsx`

---

### 7. Group Expenses
**Purpose**: Split bills and track group payments

**Features**:
- Create expense groups
- Split methods (equal/custom)
- Track dues
- Settlement management
- Payment reminders

**Components**: `Groups.tsx`, `AddGroup.tsx`

---

### 8. Calendar View
**Purpose**: Visual expense tracking by date

**Features**:
- Daily / Weekly / Monthly view
- Visual expense mapping
- Quick add from calendar
- Date range filters

**Components**: `Calendar.tsx`

---

### 9. Reports & Analytics
**Purpose**: Financial insights and trends

**Features**:
- Income vs Expense graphs
- Category breakdown
- Net worth tracking
- Trend analysis
- Forecasting
- Export formats:
  -  PDF
  -  Excel
  -  CSV

**Components**: `Reports.tsx`, `ExportReports.tsx`

---

### 10. Todo & Productivity
**Purpose**: Task management and collaboration

**Features**:
- Personal task lists
- Shared lists
- Task status tracking
- Collaborative features

**Components**: `ToDoLists.tsx`, `ToDoListDetail.tsx`, `ToDoListShare.tsx`

---

### 11. Tax Calculator
**Purpose**: Tax estimation and planning

**Features**:
- Income input
- Deduction tracking
- Regime comparison
- Estimated liability calculation

**Components**: `TaxCalculatorPage.tsx`

---

### 12. Advisor Booking System
**Purpose**: Connect users with financial advisors

**Features**:
- Advisor profiles
- Availability management
- Booking calendar
- Chat functionality (advisor-initiated)
- Notifications
- Reviews & ratings

**Components**: `BookAdvisor.tsx`, `AdvisorWorkspace.tsx`

---

##  Security Features

-  JWT authentication
-  Encrypted passwords (bcrypt)
-  User data isolation (RLS)
-  PIN lock
-  Optional 2FA
-  Token invalidation on logout
-  Session management

---

##  Cloud & Synchronization

**Technology**: PostgreSQL + Supabase

**Features**:
-  Cross-device sync
-  Real-time updates (WebSockets)
-  Offline queue
-  Auto-sync on reconnection
-  No data loss on logout
-  Conflict resolution

---

##  Platform Support

-  Progressive Web App (PWA)
-  Mobile responsive design
-  Desktop responsive design
-  Native gestures (swipe, tap)
-  Push notifications
-  Offline capability

---

##  UX Standards

**Design System**:
- Dark/Light mode toggle
- Professional banking-style UI
- Reusable component library
- Global design tokens
- Consistent animations
- Toast notifications

**Component Library**:
- Radix UI primitives
- Tailwind CSS styling
- Framer Motion animations
- Sonner toasts

---

##  Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Library**: Radix UI
- **State Management**: Context API
- **Local Storage**: Dexie (IndexedDB)
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Real-time**: WebSockets
- **Auth**: JWT + bcrypt

### Infrastructure
- **Cloud DB**: Supabase
- **Deployment**: Vercel (Frontend), Docker (Backend)
- **CDN**: Vercel Edge Network

---

##  Admin Controls

**Admin Features**:
- Feature flag management
- User management dashboard
- System analytics
- Performance monitoring
- Usage statistics

**Components**: `AdminDashboard.tsx`

---

##  Data Export System

**Export Formats**:
- PDF reports
- Excel spreadsheets
- CSV data dumps

**Features**:
- Custom date range selection
- Category filtering
- Account-specific exports

---

##  Development Guidelines

###  DO:
- Keep features modular
- Use reusable components
- Follow clean architecture
- Maintain responsive design
- Write type-safe code
- Test across devices

###  DON'T:
- Break existing features
- Duplicate UI pages
- Use inline hacks
- Hardcode values
- Skip type definitions
- Ignore accessibility

---

##  Unique Selling Points

1. **AI Automation**: Voice input + OCR receipt scanning
2. **Complete Ecosystem**: All-in-one financial management
3. **Cloud Sync**: Seamless multi-device experience
4. **Advisor Marketplace**: Monetization opportunity
5. **Offline-First**: Reliable in any network condition
6. **Enterprise-Grade Security**: Bank-level protection

---

##  Architecture Diagram

```

           React Frontend (PWA)              
                 
   Components    Contexts              
                 
                                           
               
     Dexie (IndexedDB)                   
               

                       
           Sync Layer  
                       

      Supabase (PostgreSQL)                
                 
     Auth      Real-time             
                 

```

---

##  Current Implementation Status

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed progress tracking.

---

##  Related Documentation

- [Architecture](./architecture.md)
- [API Documentation](./api.md)
- [Deployment Guide](./deployment.md)
- [Quick Start](./QUICK_START.md)
- [Database Setup](../DATABASE_SETUP_GUIDE.md)
