
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllRecords(table, fields) {
    let allRecords = [];
    let from = 0;
    let to = 999;
    let done = false;

    while (!done) {
        const { data, error } = await supabase
            .from(table)
            .select(`id, user_id, ${fields.join(', ')}`)
            .range(from, to)
            .order('id', { ascending: true });

        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
            return [];
        }

        allRecords = allRecords.concat(data);
        if (data.length < 1000) {
            done = true;
        } else {
            from += 1000;
            to += 1000;
        }
    }
    return allRecords;
}

async function deduplicateTable(table, fields) {
    console.log(`Deduplicating ${table}...`);

    const records = await fetchAllRecords(table, fields);

    console.log(`Found ${records.length} records in ${table}`);

    const groups = new Map();
    const toDelete = [];

    for (const record of records) {
        const key = `${record.user_id}|` + fields.map(f => String(record[f]).toLowerCase().trim()).join('|');
        if (groups.has(key)) {
            toDelete.push(record.id);
        } else {
            groups.set(key, record.id);
        }
    }

    console.log(`Identified ${toDelete.length} duplicates in ${table}`);

    if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 100) {
            const batch = toDelete.slice(i, i + 100);
            const { error: deleteError } = await supabase.from(table).delete().in('id', batch);
            if (deleteError) {
                console.error(`Error deleting batch from ${table}:`, deleteError.message);
            } else {
                console.log(`Deleted ${batch.length} records from ${table}...`);
            }
        }
    }
}

async function runCleanup() {
    await deduplicateTable('accounts', ['name', 'type', 'currency']);
    await deduplicateTable('goals', ['name', 'target_amount']);
    await deduplicateTable('friends', ['name', 'phone']);
    await deduplicateTable('loans', ['name', 'principal_amount']);
    await deduplicateTable('transactions', ['amount', 'description', 'date', 'type']);

    console.log('Cleanup complete!');
}

runCleanup();
