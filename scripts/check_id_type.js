
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

async function checkIdType() {
    const { data: rows, error } = await supabase.from('goals').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    if (rows && rows.length > 0) {
        console.log('Sample Goal:', rows[0]);
        console.log('ID Type:', typeof rows[0].id);
    } else {
        console.log('No goals found');
    }
}
checkIdType();
