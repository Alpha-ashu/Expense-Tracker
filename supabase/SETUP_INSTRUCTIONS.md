# Supabase Database Setup Guide 🚀

## ✅ Connection Verified!

Your Supabase connection is working! Now let's set up your database tables and security.

---

## 📋 Step-by-Step Instructions

### **Step 1: Open Supabase SQL Editor**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh
2. Click on **SQL Editor** in the left sidebar
3. Click **"+ New query"**

---

### **Step 2: Create All Tables**

1. Open the file: [`supabase/migrations/001_create_tables.sql`](supabase/migrations/001_create_tables.sql)
2. **Copy the entire content** 
3. **Paste it** into the Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)
5. You should see: ✅ **"Success. No rows returned"**

**What this does:**
- Creates 16 tables for your app (accounts, transactions, loans, goals, etc.)
- Sets up indexes for better performance
- Creates automatic triggers for `updated_at` fields
- Auto-creates user profiles when users sign up

---

### **Step 3: Enable Row Level Security (RLS)**

1. Create a **new query** in SQL Editor
2. Open the file: [`supabase/migrations/002_enable_rls.sql`](supabase/migrations/002_enable_rls.sql)
3. **Copy the entire content**
4. **Paste it** into the SQL Editor
5. Click **"Run"**
6. You should see: ✅ **"Success. No rows returned"**

**What this does:**
- Enables RLS on all tables
- Creates policies so users can ONLY see their own data
- Sets up file storage for expense bill attachments
- Enables todo list sharing with permissions

---

### **Step 4: Verify Tables Were Created**

1. In Supabase Dashboard, go to **Table Editor**
2. You should see all these tables:
   - ✅ profiles
   - ✅ accounts
   - ✅ friends
   - ✅ transactions
   - ✅ loans
   - ✅ loan_payments
   - ✅ goals
   - ✅ goal_contributions
   - ✅ group_expenses
   - ✅ investments
   - ✅ notifications
   - ✅ tax_calculations
   - ✅ todo_lists
   - ✅ todo_items
   - ✅ todo_list_shares
   - ✅ expense_bills

---

### **Step 5: Enable Email Authentication**

1. Go to **Authentication** → **Providers** in Supabase Dashboard
2. Enable **Email** provider (should be enabled by default)
3. Configure email templates if desired
4. **Optional:** Enable other providers (Google, GitHub, etc.)

---

### **Step 6: Test the Setup**

Run this test query in SQL Editor to verify everything works:

```sql
-- Test 1: Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Test 2: Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

You should see all your tables with `rowsecurity = true`

---

## 🔐 Security Features Explained

### **Row Level Security (RLS)**
- ✅ Users can **only** view, create, update, and delete **their own** data
- ✅ User A cannot see User B's transactions, accounts, or any other data
- ✅ Todo lists can be shared with specific permissions (view/edit)

### **Authentication**
- ✅ Users must sign up/login to access the app
- ✅ User ID is automatically added to all records
- ✅ Profile is automatically created on signup

---

## 📊 Database Schema Overview

### **Core Financial Tables:**
- **accounts** - Bank accounts, cards, cash, wallets
- **transactions** - Income, expenses, transfers
- **loans** - Borrowed, lent, EMIs
- **loan_payments** - Payment history
- **goals** - Savings goals
- **goal_contributions** - Goal deposits
- **investments** - Stocks, crypto, forex, gold, etc.

### **Social Features:**
- **friends** - Contact list for lending/borrowing
- **group_expenses** - Split bills with friends

### **Productivity:**
- **todo_lists** - Task lists
- **todo_items** - Individual tasks
- **todo_list_shares** - Share lists with others

### **Additional Features:**
- **notifications** - EMI reminders, due dates
- **tax_calculations** - Tax estimates
- **expense_bills** - File attachments

---

## 🔄 Next Steps: Update Your Frontend

Now that the database is set up, you need to update your React app to use Supabase instead of IndexedDB (Dexie).

### **Files to Update:**

1. **Authentication**: Add signup/login pages
2. **database.ts**: Replace Dexie with Supabase queries
3. **AppContext.tsx**: Fetch data from Supabase
4. **All components**: Update to work with Supabase

---

## 🧪 Testing with Sample Data

Want to add some test data? Create a new SQL query:

```sql
-- After signing up a user, get your user ID
SELECT id, email FROM auth.users;

-- Then insert test data (replace YOUR_USER_ID)
INSERT INTO public.accounts (user_id, name, type, balance, currency) VALUES
('YOUR_USER_ID', 'Main Bank Account', 'bank', 5000.00, 'USD'),
('YOUR_USER_ID', 'Credit Card', 'card', -500.00, 'USD'),
('YOUR_USER_ID', 'Cash Wallet', 'cash', 200.00, 'USD');

INSERT INTO public.transactions (user_id, type, amount, account_id, category, description, date) VALUES
('YOUR_USER_ID', 'expense', 50.00, 1, 'Food', 'Grocery shopping', NOW() - INTERVAL '2 days'),
('YOUR_USER_ID', 'income', 3000.00, 1, 'Salary', 'Monthly salary', NOW() - INTERVAL '5 days'),
('YOUR_USER_ID', 'expense', 30.00, 1, 'Transport', 'Uber ride', NOW() - INTERVAL '1 day');
```

---

## 🆘 Troubleshooting

### **Error: "permission denied for table..."**
- ❌ RLS is enabled but policies aren't created
- ✅ Run the `002_enable_rls.sql` script

### **Error: "relation does not exist"**
- ❌ Tables weren't created
- ✅ Run the `001_create_tables.sql` script

### **Can't see any data**
- ❌ User is not authenticated
- ✅ Make sure users sign up/login first
- ✅ Check that `user_id` matches `auth.uid()`

### **Need to reset everything?**
```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
-- Then re-run both migration scripts
```

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Your Dashboard**: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh
- **SQL Editor**: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh/sql
- **Table Editor**: https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh/editor

---

## 🎉 You're All Set!

Once you complete these steps, your database will be:
- ✅ Fully set up with all tables
- ✅ Secured with Row Level Security
- ✅ Ready to use in your React app
- ✅ User-specific and private

Ready to start building! 🚀
