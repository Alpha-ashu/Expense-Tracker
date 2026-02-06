import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Create a stub client for when env vars are missing
const createStubClient = (): any => {
	console.error(
		'Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY in your environment.',
	);
	
	return {
		auth: {
			getSession: async () => ({ data: { session: null }, error: null }),
			getUser: async () => ({ data: { user: null }, error: null }),
			signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured', status: 500 } }),
			signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured', status: 500 } }),
			signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: { message: 'Supabase not configured', status: 500 } }),
			signOut: async () => ({ error: null }),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
		},
		from: () => ({
			select: () => ({ data: null, error: { message: 'Supabase not configured', status: 500 } }),
			insert: () => ({ data: null, error: { message: 'Supabase not configured', status: 500 } }),
			update: () => ({ data: null, error: { message: 'Supabase not configured', status: 500 } }),
			delete: () => ({ data: null, error: { message: 'Supabase not configured', status: 500 } }),
		}),
	};
};

const supabase = (!supabaseUrl || !supabaseKey) 
	? createStubClient()
	: createClient(supabaseUrl, supabaseKey);

export default supabase;