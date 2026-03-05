import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mmwrckfqeqjfqciymemh.supabase.co';
const supabaseServiceKey = 'sb_secret_rLtUWQRvgcjFaM5mzR4c0w_bQd6Oywx';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanDB() {
    console.log('Starting DB cleanup...');
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

        if (error) {
            throw error;
        }

        console.log(`Found ${users.length} users. Checking which ones to delete...`);

        let deletedCount = 0;

        // We only keep the admin
        const ADMIN_EMAIL = 'shaik.job.details@gmail.com';

        for (const user of users) {
            if (user.email === ADMIN_EMAIL) {
                console.log(`✅ Skipping admin user: ${user.email} (${user.id})`);

                // Let's also clean all demo/testing data from the admin user just in case
                console.log('   Removing admin demo data...');
                await supabase.from('transactions').delete().eq('user_id', user.id);
                await supabase.from('accounts').delete().eq('user_id', user.id);
                await supabase.from('goals').delete().eq('user_id', user.id);
                await supabase.from('loans').delete().eq('user_id', user.id);

                continue;
            }

            console.log(`🗑️ Deleting user: ${user.email || 'No email'} (${user.id})`);
            const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

            if (deleteError) {
                console.error(`❌ Failed to delete ${user.id}:`, deleteError.message);
            } else {
                deletedCount++;
            }
        }

        console.log(`\n🎉 Cleanup complete! Deleted ${deletedCount} users and their associated records.`);

    } catch (err) {
        console.error('Script failed:', err.message);
    }
}

cleanDB();
