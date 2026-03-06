-- ==============================================================================
-- FinanceLife: Supabase Structured Relational Database Schema
-- ==============================================================================
-- This schema establishes a strong relational foundation for Supabase.
-- It ensures seamless offline-to-online sync, utilizing Row Level Security (RLS)
-- to keep user data 100% private and secure.
-- ==============================================================================

-- 1. Enable UUID Extension (Required for generating UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- PROFILES (Extended from auth.users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user', -- 'admin', 'advisor', 'user'
  job_type TEXT,
  monthly_income NUMERIC,
  annual_income NUMERIC,
  date_of_birth DATE,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ACCOUNTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT, -- For Dexie offline sync reference
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'bank', 
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  -- We store account_id loosely as text to support Dexie integers or Supabase UUIDs
  account_id TEXT NOT NULL, 
  type TEXT NOT NULL, -- 'expense', 'income', 'transfer'
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  merchant TEXT,
  date TIMESTAMPTZ NOT NULL,
  tags TEXT[],
  transfer_to_account_id TEXT,
  transfer_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- GOALS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  target_date TIMESTAMPTZ NOT NULL,
  category TEXT,
  is_group_goal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LOANS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  principal_amount NUMERIC NOT NULL,
  outstanding_balance NUMERIC NOT NULL,
  interest_rate NUMERIC,
  emi_amount NUMERIC,
  due_date TIMESTAMPTZ,
  frequency TEXT,
  status TEXT DEFAULT 'active',
  contact_person TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INVESTMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  buy_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  total_invested NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL,
  profit_loss NUMERIC NOT NULL,
  purchase_date TIMESTAMPTZ NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- USER SETTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- This ensures users can ONLY see and modify their own data.
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Accounts Policies
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- 4. Transactions Policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- 5. Goals Policies
CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);

-- 6. Loans Policies
CREATE POLICY "Users can view own loans" ON public.loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans" ON public.loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans" ON public.loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans" ON public.loans FOR DELETE USING (auth.uid() = user_id);

-- 7. Investments Policies
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON public.investments FOR DELETE USING (auth.uid() = user_id);

-- 8. User Settings Policies
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATED TRIGGERS
-- ==============================================================================

-- Create a function to automatically set the `updated_at` column
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to all tables
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
