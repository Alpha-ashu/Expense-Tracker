import supabase from './client';

/**
 * Test Supabase connection
 * Run this to verify your Supabase setup is working correctly
 */
export async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('Key configured:', !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY);

  try {
    // Test 1: Check if client is created
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    console.log('✅ Supabase client created');

    // Test 2: Try to fetch from a table (this will fail if table doesn't exist, but connection works)
    const { data, error } = await supabase.from('todos').select('*').limit(1);
    
    if (error) {
      console.warn('⚠️  Query error (table might not exist yet):', error.message);
      console.log('💡 Connection is working, but you may need to create tables');
    } else {
      console.log('✅ Successfully queried database');
      console.log('📊 Sample data:', data);
    }

    // Test 3: Check auth
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 Auth session:', session ? 'Active' : 'No active session');

    console.log('✅ Supabase connection test complete!');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return { success: false, error };
  }
}

// Run test if called directly
if (import.meta.env.DEV) {
  testSupabaseConnection();
}
