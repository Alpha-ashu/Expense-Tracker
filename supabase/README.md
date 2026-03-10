# 🗄️ Supabase Database Migrations

This folder contains all SQL scripts to set up your Expense Tracker database in Supabase.

## 📋 Quick Start

### **1. Run Migrations in Order:**

Open each file in **Supabase SQL Editor** and run them in this order:

1. **[001_create_tables.sql](migrations/001_create_tables.sql)** - Creates all database tables
2. **[002_enable_rls.sql](migrations/002_enable_rls.sql)** - Enables Row Level Security
3. **[003_seed_data.sql](migrations/003_seed_data.sql)** - *(Optional)* Adds sample data for testing
4. **[004_add_missing_columns.sql](migrations/004_add_missing_columns.sql)** - *(Recommended)* Aligns friends/group_expenses with app sync fields

### **2. Follow Detailed Instructions:**

See **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** for step-by-step guide.

---

## 📊 Database Schema

### **Tables Created:**

| Table | Description | Records |
|-------|-------------|---------|
| **profiles** | User profiles and settings | User info |
| **accounts** | Bank accounts, cards, cash | Financial accounts |
| **friends** | Contact list for lending/borrowing | Contacts |
| **transactions** | Income, expenses, transfers | All transactions |
| **loans** | Borrowed, lent, EMI loans | Loan tracking |
| **loan_payments** | Loan payment history | Payment records |
| **goals** | Savings goals | Financial goals |
| **goal_contributions** | Goal deposits | Contributions |
| **group_expenses** | Split bills with friends | Shared expenses |
| **investments** | Stocks, crypto, gold, etc. | Investments |
| **notifications** | EMI/loan reminders | Alerts |
| **tax_calculations** | Tax estimates | Tax data |
| **todo_lists** | Task lists | Todo lists |
| **todo_items** | Individual tasks | Tasks |
| **todo_list_shares** | Shared todo lists | Sharing |
| **expense_bills** | File attachments | Receipts |

**Total: 16 Tables**

---

## 🔐 Security Features

### **Row Level Security (RLS):**
- ✅ All tables have RLS enabled
- ✅ Users can **only** access their own data
- ✅ Todo lists can be shared with permissions (view/edit)
- ✅ File uploads are user-specific

### **Automatic Features:**
- ✅ `updated_at` timestamps are auto-updated (for tables that include the column)
- ✅ User profiles are auto-created on signup
- ✅ User IDs are automatically enforced by RLS

---

## 🚀 Migration Files Explained

### **001_create_tables.sql**
- Creates all 16 tables
- Sets up foreign key relationships
- Creates indexes for performance
- Adds triggers for auto-updating timestamps
- Sets up auto-profile creation

### **002_enable_rls.sql**
- Enables RLS on all tables
- Creates policies for SELECT, INSERT, UPDATE, DELETE
- Sets up storage bucket for file uploads
- Configures todo list sharing permissions

### **003_seed_data.sql** *(Optional)*
- Adds sample data for testing
- Creates 4 accounts, 15 transactions, 3 loans, 4 goals
- Adds investments, notifications, todo lists
- **Note:** Must replace `YOUR_USER_ID_HERE` with your actual user ID

### **004_add_missing_columns.sql** *(Recommended)*
- Adds missing sync columns for **friends** and **group_expenses**
- Adds `updated_at` triggers and missing indexes
- Safe to run multiple times (uses `IF NOT EXISTS`)

---

## 💻 How to Run Migrations

### **Method 1: Supabase Dashboard (Recommended)**

1. Go to https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh
2. Click **SQL Editor** → **New query**
3. Copy & paste the SQL file content
4. Click **Run** or press `Ctrl+Enter`

### **Method 2: Supabase CLI** *(Advanced)*

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref mmwrckfqeqjfqciymemh

# Run migrations
supabase db push
```

---

## ✅ Verification Checklist

After running migrations, verify:

- [ ] All 16 tables appear in **Table Editor**
- [ ] RLS is enabled (check **Policies** tab for each table)
- [ ] Storage bucket `expense-bills` exists
- [ ] Test queries work without errors
- [ ] User signup creates a profile automatically

---

## 🧪 Testing

### **Test Query 1: Check Tables**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### **Test Query 2: Verify RLS**
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```
*All tables should have `rowsecurity = true`*

### **Test Query 3: Check Your User ID**
```sql
SELECT id, email, created_at 
FROM auth.users;
```
*Use this ID for the seed data script*

---

## 🔄 Reset Database (If Needed)

**⚠️ WARNING: This deletes ALL data!**

```sql
-- Drop all tables
DROP SCHEMA public CASCADE;

-- Recreate schema
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Re-run migrations
-- 1. 001_create_tables.sql
-- 2. 002_enable_rls.sql
```

---

## 📚 Resources

- **Setup Guide**: [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)
- **Supabase Docs**: https://supabase.com/docs
- **Your Dashboard**: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh

---

## 🆘 Troubleshooting

### **"permission denied for table"**
→ Run `002_enable_rls.sql` to create policies

### **"relation does not exist"**
→ Run `001_create_tables.sql` to create tables

### **"user does not exist" in seed data**
→ Sign up first, then get your user ID with: `SELECT id FROM auth.users;`

### **Can't see any data in app**
→ Check that user is authenticated and `user_id` matches `auth.uid()`

---

## 📝 Notes

- Always run migrations in order
- Never commit sensitive data to Git
- Backup data before running reset scripts
- Use seed data only in development/testing
- Enable 2FA on your Supabase account

---

**Ready to build!** 🎉
