# Expense Tracker

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)

**A comprehensive, cloud-synced personal finance management platform**

[Quick Start](./docs/QUICK_START.md) · [Features](./docs/FEATURES.md) · [API Docs](./docs/api.md) · [Architecture](./docs/architecture.md)

</div>

---

## ✨ Overview

Expense Tracker is a full-stack financial management application that helps users track expenses, manage accounts, set goals, and gain insights into their financial health. Built with modern technologies and designed for scalability, security, and exceptional user experience.

### Key Highlights

- 📊 **Real-time Dashboard** - Live financial overview with charts and insights
- 💳 **Multi-Account Management** - Track bank, cash, card, and wallet accounts
- 🎤 **AI Voice Input** - Add transactions using natural language
- 📸 **Receipt Scanner** - OCR-powered receipt digitization
- 🎯 **Smart Goals** - Set and track financial objectives
- 📈 **Investment Tracking** - Monitor stocks, crypto, and more
- 👥 **Group Expenses** - Split bills and track shared costs
- 🔐 **Bank-Grade Security** - End-to-end encryption and JWT auth
- ☁️ **Cloud Sync** - Seamless multi-device synchronization
- 📱 **PWA Ready** - Install on any device, works offline

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│     React + TypeScript (PWA)        │
│  ┌──────────┐    ┌──────────┐      │
│  │Components│    │ Contexts │      │
│  └────┬─────┘    └────┬─────┘      │
│       │               │             │
│  ┌────▼───────────────▼────┐       │
│  │  Dexie (IndexedDB)      │       │
│  └────┬────────────────┬───┘       │
└───────┼────────────────┼───────────┘
        │   Sync Layer    │
┌───────▼────────────────▼───────────┐
│  Supabase (PostgreSQL + Auth)      │
│  ┌──────────┐    ┌──────────┐     │
│  │ Real-time│    │   RLS    │     │
│  └──────────┘    └──────────┘     │
└─────────────────────────────────────┘
```

**Stack:**
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL, Dexie (IndexedDB)
- **Cloud**: Supabase (auth, real-time, storage)
- **Deployment**: Vercel (frontend), Docker (backend)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/Alpha-ashu/Expense-Tracker.git
cd Expense-Tracker

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

📖 **Detailed setup**: See [docs/QUICK_START.md](./docs/QUICK_START.md)

---

## 📋 Feature Modules

| Module | Description | Status |
|--------|-------------|--------|
| 🏠 Dashboard | Financial overview & quick actions | ✅ Complete |
| 💳 Accounts | Multi-account management | ✅ Complete |
| 💸 Transactions | Income/expense tracking with AI | ✅ Complete |
| 🎯 Goals | Savings goals & progress tracking | ✅ Complete |
| 💰 Loans & EMI | Debt management & EMI schedules | ✅ Complete |
| 📈 Investments | Portfolio tracking (stocks, crypto) | ✅ Complete |
| 👥 Groups | Split expenses & settlement | ✅ Complete |
| 📅 Calendar | Date-based expense visualization | ✅ Complete |
| 📊 Reports | Analytics, charts & insights | ✅ Complete |
| 📝 Todo | Task management & collaboration | ✅ Complete |
| 🧾 Tax Calculator | Income tax estimation | ✅ Complete |
| 👔 Advisor Booking | Connect with financial advisors | ✅ Complete |

See [docs/FEATURES.md](./docs/FEATURES.md) for detailed specifications.

---

## 🎨 Design System

### Components
- **UI Library**: Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Notifications**: Sonner toasts

### Themes
- ☀️ Light Mode
- 🌙 Dark Mode
- 🎨 Custom color palettes per account type

### Responsive Design
- 📱 Mobile-first approach
- 💻 Desktop optimized
- 📱 Native gestures (swipe, pull-to-refresh)

---

## 🔐 Security Features

- ✅ JWT authentication with refresh tokens
- ✅ Password hashing (bcrypt)
- ✅ Row-level security (RLS) in PostgreSQL
- ✅ PIN lock for sensitive operations
- ✅ Optional 2FA
- ✅ Session management & token invalidation
- ✅ Encrypted local storage

---

## ☁️ Cloud & Sync

- **Real-time sync** across all devices
- **Offline-first** architecture with queue
- **Conflict resolution** for concurrent edits
- **Auto-sync** on network reconnection
- **Zero data loss** guarantee

---

## 📱 Platform Support

- ✅ **Web** (all modern browsers)
- ✅ **PWA** (installable on desktop/mobile)
- ✅ **iOS** (via Capacitor)
- ✅ **Android** (via Capacitor)
- ✅ **Offline** mode with background sync

---

## 🛠️ Development

### Project Structure
```
expense-tracker/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # React components
│   │   │   └── App.tsx         # Main app
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities
│   │   └── utils/              # Helpers
├── backend/
│   ├── src/
│   │   ├── modules/            # Feature modules
│   │   ├── middleware/         # Express middleware
│   │   └── routes/             # API routes
│   └── prisma/                 # Database schema
├── docs/                       # Documentation
└── tests/                      # Test suites
```

### Scripts

```bash
# Development
npm run dev              # Start dev server
npm run dev:backend      # Start backend only

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# PWA
npm run build:pwa        # Build with PWA support
```

---

## 📚 Documentation

- [Architecture Guide](./docs/architecture.md)
- [API Documentation](./docs/api.md)
- [Database Setup](./docs/setup/DATABASE_SETUP_GUIDE.md)
- [Deployment Guide](./docs/deployment.md)
- [Implementation Status](./docs/implementation/IMPLEMENTATION_STATUS.md)
- [Feature Flags](./docs/ADMIN_FEATURE_FLAGS.md)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## 📦 Deployment

### Frontend (Vercel)
```bash
npm run build
vercel deploy
```

### Backend (Docker)
```bash
docker-compose up -d
```

See [docs/deployment.md](./docs/deployment.md) for detailed instructions.

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Recharts](https://recharts.org/) - Composable charting library

---

## 📞 Support

- 🐛 Issues: [GitHub Issues](https://github.com/Alpha-ashu/Expense-Tracker/issues)
- 📖 Docs: [Full Documentation](./docs/)
- 💬 Discussions: [GitHub Discussions](https://github.com/Alpha-ashu/Expense-Tracker/discussions)

---

<div align="center">

**Made with ❤️ by the Expense Tracker Team**

⭐ Star us on GitHub if you find this helpful!

[Report Bug](https://github.com/Alpha-ashu/Expense-Tracker/issues) · [Request Feature](https://github.com/Alpha-ashu/Expense-Tracker/issues)

</div>

