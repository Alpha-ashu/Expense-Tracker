// =====================================================
// Supabase Database Helper Functions
// =====================================================
// Import and use these functions throughout your app
// to interact with Supabase tables
// =====================================================

import supabase from '@/utils/supabase/client';

// =====================================================
// TYPE DEFINITIONS (matching database schema)
// =====================================================

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  currency: string;
  language: string;
  pin_code: string | null;
  visible_features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  user_id: string;
  name: string;
  type: 'bank' | 'card' | 'cash' | 'wallet';
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Transaction {
  id: number;
  user_id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  account_id: number;
  category: string;
  subcategory: string | null;
  description: string;
  merchant: string | null;
  date: string;
  tags: string[] | null;
  attachment: string | null;
  transfer_to_account_id: number | null;
  transfer_type: 'self-transfer' | 'other-transfer' | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// =====================================================
// AUTHENTICATION HELPERS
// =====================================================

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// =====================================================
// PROFILE FUNCTIONS
// =====================================================

export async function getProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', (await getCurrentUser()).id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// =====================================================
// ACCOUNT FUNCTIONS
// =====================================================

export async function getAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Account[];
}

export async function getActiveAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  
  if (error) throw error;
  return data as Account[];
}

export async function createAccount(account: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...account, user_id: user.id })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateAccount(id: number, updates: Partial<Account>) {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteAccount(id: number) {
  // Soft delete
  const { error } = await supabase
    .from('accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// TRANSACTION FUNCTIONS
// =====================================================

export async function getTransactions(limit?: number) {
  let query = supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('date', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data as Transaction[];
}

export async function getTransactionsByAccount(accountId: number) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data as Transaction[];
}

export async function getTransactionsByDateRange(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data as Transaction[];
}

export async function createTransaction(transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, user_id: user.id })
    .select()
    .single();
  
  if (error) throw error;
  
  // Update account balance
  if (transaction.type === 'expense') {
    await updateAccountBalance(transaction.account_id, -transaction.amount);
  } else if (transaction.type === 'income') {
    await updateAccountBalance(transaction.account_id, transaction.amount);
  } else if (transaction.type === 'transfer' && transaction.transfer_to_account_id) {
    await updateAccountBalance(transaction.account_id, -transaction.amount);
    await updateAccountBalance(transaction.transfer_to_account_id, transaction.amount);
  }
  
  return data;
}

async function updateAccountBalance(accountId: number, amount: number) {
  const { data: account } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', accountId)
    .single();
  
  if (account) {
    await supabase
      .from('accounts')
      .update({ balance: account.balance + amount })
      .eq('id', accountId);
  }
}

export async function deleteTransaction(id: number) {
  // Soft delete
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// REALTIME SUBSCRIPTIONS
// =====================================================

export function subscribeToTransactions(callback: (payload: any) => void) {
  return supabase
    .channel('transactions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions'
      },
      callback
    )
    .subscribe();
}

export function subscribeToAccounts(callback: (payload: any) => void) {
  return supabase
    .channel('accounts-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'accounts'
      },
      callback
    )
    .subscribe();
}

// =====================================================
// USAGE EXAMPLES
// =====================================================

/*

// In your React component:

import { 
  getAccounts, 
  createAccount, 
  getTransactions, 
  subscribeToTransactions 
} from '@/lib/supabase-helpers';

// Fetch accounts
const accounts = await getAccounts();

// Create new account
const newAccount = await createAccount({
  name: 'New Bank Account',
  type: 'bank',
  balance: 1000,
  currency: 'USD',
  is_active: true
});

// Fetch transactions
const transactions = await getTransactions(50); // last 50

// Subscribe to real-time updates
useEffect(() => {
  const subscription = subscribeToTransactions((payload) => {
    console.log('Transaction change:', payload);
    // Refresh your data here
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

*/
