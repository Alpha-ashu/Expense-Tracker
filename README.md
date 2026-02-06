# 💰 Expense Tracker - Personal Finance Management App

A comprehensive personal finance management application built with React, Vite, and Supabase. Track expenses, manage accounts, set financial goals, and monitor investments all in one place.

**Original Figma Design**: https://www.figma.com/design/YFfOCSQMHx6XmjEezEKAkY/Expense-Tracker-Import-Feature

---

## ✨ Features

- 📊 **Dashboard** - Complete financial overview
- 💳 **Accounts** - Manage bank accounts, cards, cash
- 💸 **Transactions** - Track income, expenses, and transfers
- 🎯 **Goals** - Set and track savings goals
- 💰 **Loans & EMI** - Manage borrowed/lent money
- 📈 **Investments** - Track stocks, crypto, gold, forex
- 👥 **Group Expenses** - Split bills with friends
- 📅 **Calendar** - View transactions by date
- 📊 **Reports** - Detailed financial analytics
- 📝 **Todo Lists** - Task management with sharing
- 🧾 **Tax Calculator** - Estimate tax liability
- 🔔 **Notifications** - EMI and payment reminders
- 📱 **PWA Support** - Install as mobile app
- 🌙 **Dark Mode** - Eye-friendly interface
- 🔒 **PIN Protection** - Secure app access

---

## 🚀 Quick Start

### 1. **Install Dependencies**

```bash
npm install
```

### 2. **Set Up Supabase Database**

Follow the comprehensive guide: **[supabase/SETUP_INSTRUCTIONS.md](supabase/SETUP_INSTRUCTIONS.md)**

Quick steps:
1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh)
2. Go to SQL Editor
3. Run `supabase/migrations/001_create_tables.sql`
4. Run `supabase/migrations/002_enable_rls.sql`
5. *(Optional)* Run `supabase/migrations/003_seed_data.sql` for test data

### 3. **Configure Environment Variables**

The environment variables are already set in:
- `.env` (root)
- `frontend/.env.local`

No changes needed! ✅

### 4. **Start Development Server**

```bash
npm run dev
```

Open http://localhost:5173

---

## 📁 Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # React components
│   │   │   └── App.tsx         # Main app
│   │   ├── contexts/           # React contexts
│   │   ├── lib/                # Utilities & helpers
│   │   │   ├── supabase-helpers.ts  # Database functions
│   │   │   ├── database.ts     # IndexedDB (legacy)
│   │   │   └── ...
│   │   └── utils/
│   │       └── supabase/       # Supabase client
│   └── public/                 # Static assets
├── supabase/
│   ├── migrations/             # Database SQL scripts
│   │   ├── 001_create_tables.sql
│   │   ├── 002_enable_rls.sql
│   │   └── 003_seed_data.sql
│   ├── SETUP_INSTRUCTIONS.md
│   ├── GET_USER_ID.md
│   └── README.md
├── backend/                    # Backend API (optional)
├── .env                        # Environment variables
└── package.json
```

---

## 🗄️ Database Schema

Complete schema with 16 tables:

- **User Management**: profiles
- **Financial**: accounts, transactions, loans, loan_payments
- **Goals**: goals, goal_contributions
- **Social**: friends, group_expenses
- **Investments**: investments
- **Productivity**: todo_lists, todo_items, todo_list_shares
- **Utilities**: notifications, tax_calculations, expense_bills

See **[supabase/README.md](supabase/README.md)** for complete details.

---

## 🔐 Security

- ✅ **Row Level Security (RLS)** - Users can only access their own data
- ✅ **Authentication** - Email/password signup
- ✅ **Secure Storage** - Files stored in Supabase Storage
- ✅ **PIN Protection** - App-level security
- ✅ **Environment Variables** - Sensitive data protected

---

## 🛠️ Tech Stack

### **Frontend:**
- ⚛️ React 18
- ⚡ Vite 6
- 🎨 Tailwind CSS 4
- 🎯 TypeScript
- 🧩 Material-UI
- 📊 Recharts

### **Backend:**
- 🗄️ Supabase (PostgreSQL)
- 🔐 Supabase Auth
- 📦 Supabase Storage
- ⚡ Realtime subscriptions

### **Additional:**
- 📱 Capacitor (Mobile)
- 🔄 PWA Support
- 🗂️ IndexedDB (offline)
- 🎭 Dexie

---

## 📖 Documentation

- **[Supabase Setup Guide](supabase/SETUP_INSTRUCTIONS.md)** - Complete database setup
- **[Database Schema](supabase/README.md)** - Table structure & relationships
- **[Get User ID](supabase/GET_USER_ID.md)** - For seed data
- **[Supabase Connection Guide](SUPABASE_SETUP.md)** - Frontend integration

---

## 🧪 Testing

### **Test Supabase Connection:**

1. Start dev server: `npm run dev`
2. Open http://localhost:5173
3. Look for the **Supabase Connection Test** component
4. Click "Test Connection"

Or run test queries in browser console:

```javascript
// Import Supabase client
import supabase from '@/utils/supabase/client';

// Test query
const { data, error } = await supabase.from('accounts').select('*');
console.log({ data, error });
```

---

## 🔄 Migration from IndexedDB to Supabase

Currently, the app uses IndexedDB (Dexie) for local storage. To migrate to Supabase:

1. ✅ Supabase is connected and configured
2. ✅ Database tables are created
3. ✅ Helper functions are available in `lib/supabase-helpers.ts`
4. 🔄 Update components to use Supabase instead of Dexie
5. 🔄 Add authentication pages (signup/login)
6. 🔄 Replace `db.accounts.toArray()` with `getAccounts()`

---

## 📱 Build for Production

### **Web:**
```bash
npm run build
```

### **PWA:**
```bash
npm run build:pwa
```

### **Mobile (Capacitor):**
```bash
npm run cap:sync
npm run cap:open:android  # or ios
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

---

## 🆘 Support

- **Issues**: Open an issue on GitHub
- **Supabase Dashboard**: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh
- **Documentation**: See docs in `supabase/` folder

---

## 🎉 Credits

- Original Design: Figma Expense Tracker
- Built with React, Vite, and Supabase
- Icons: Lucide React
- Charts: Recharts

---

**Made with ❤️ for better financial management**

  