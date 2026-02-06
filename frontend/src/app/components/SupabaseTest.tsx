import { useState } from 'react';
import supabase from '@/utils/supabase/client';

/**
 * Supabase Connection Test Component
 * Add this to your app temporarily to verify connection
 */
export default function SupabaseTest() {
  const [status, setStatus] = useState<string>('Not tested');
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing...');

    try {
      // Test basic connection
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .limit(5);

      if (error) {
        setStatus(`⚠️ Connected, but query error: ${error.message}`);
        setDetails({ 
          message: 'Connection works! You may need to create the "todos" table.',
          error: error.message,
          hint: error.hint 
        });
      } else {
        setStatus('✅ Successfully connected to Supabase!');
        setDetails({ 
          recordCount: data?.length || 0,
          data: data 
        });
      }
    } catch (err: any) {
      setStatus('❌ Connection failed');
      setDetails({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      margin: '20px', 
      border: '2px solid #ccc', 
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2>🔌 Supabase Connection Test</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <strong>URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Not set'}
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <strong>Key:</strong> {import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ? '✅ Configured' : '❌ Not set'}
      </div>

      <button 
        onClick={testConnection} 
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {loading ? 'Testing...' : 'Test Connection'}
      </button>

      <div style={{ marginTop: '20px' }}>
        <strong>Status:</strong> {status}
      </div>

      {details && (
        <pre style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#eee',
          borderRadius: '5px',
          overflow: 'auto',
          maxHeight: '300px'
        }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
