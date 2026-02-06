import React, { useMemo, useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, RefreshCw, Copy, ExternalLink } from 'lucide-react';

export const Diagnostics: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('Not tested');

  const envStatus = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    return {
      mode: import.meta.env.MODE,
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      online: navigator.onLine,
    };
  }, []);

  const handleSupabaseTest = async () => {
    setIsTesting(true);
    setTestResult('Testing...');

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setTestResult(`Error: ${error.message}`);
        toast.error('Supabase session check failed');
        return;
      }
      const hasSession = !!data.session;
      setTestResult(hasSession ? 'OK (session active)' : 'OK (no session)');
      toast.success('Supabase check successful');
    } catch (error) {
      console.error('Supabase test failed:', error);
      setTestResult('Error: unexpected failure');
      toast.error('Supabase test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyEnvVars = () => {
    const envVars = `VITE_SUPABASE_URL=https://mmwrckfqeqjfqciymemh.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_QA4aNzLgHR9xanXUJaPpew_XGRicYBq`;
    
    navigator.clipboard.writeText(envVars);
    toast.success('Environment variables copied to clipboard');
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('settings')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Diagnostics</h2>
            <p className="text-gray-500 mt-1">Check environment and Supabase status</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Build mode</p>
              <p className="text-lg font-semibold text-gray-900">{envStatus.mode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Online</p>
              <p className={`text-lg font-semibold ${envStatus.online ? 'text-green-600' : 'text-red-600'}`}>
                {envStatus.online ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">VITE_SUPABASE_URL</p>
              <p className={`text-base font-semibold ${envStatus.supabaseUrl ? 'text-green-600' : 'text-red-600'}`}>
                {envStatus.supabaseUrl ? 'Present' : 'Missing'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-500">VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY</p>
              <p className={`text-base font-semibold ${envStatus.supabaseKey ? 'text-green-600' : 'text-red-600'}`}>
                {envStatus.supabaseKey ? 'Present' : 'Missing'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Supabase session test</p>
                <p className="text-base font-semibold text-gray-900">{testResult}</p>
              </div>
              <button
                onClick={handleSupabaseTest}
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} />
                {isTesting ? 'Testing...' : 'Run test'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Vercel Deployment Checklist</h3>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              Open Vercel <ExternalLink size={14} />
            </a>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Required Environment Variables</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    VITE_SUPABASE_URL
                  </code>
                  <span className={`text-xs font-medium ${envStatus.supabaseUrl ? 'text-green-600' : 'text-red-600'}`}>
                    {envStatus.supabaseUrl ? '✓ Present' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
                  </code>
                  <span className={`text-xs font-medium ${envStatus.supabaseKey ? 'text-green-600' : 'text-red-600'}`}>
                    {envStatus.supabaseKey ? '✓ Present' : '✗ Missing'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCopyEnvVars}
                className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Copy size={14} /> Copy environment variables
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900">Setup Steps:</p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Go to <strong>Vercel Dashboard → Your Project → Settings</strong></li>
                <li>Click <strong>Environment Variables</strong></li>
                <li>Add both variables for <strong>Production, Preview, and Development</strong></li>
                <li>Click <strong>Save</strong></li>
                <li>Go to <strong>Deployments</strong> and click <strong>Redeploy</strong></li>
                <li>If it still fails, clear build cache and redeploy</li>
              </ol>
            </div>

            {(!envStatus.supabaseUrl || !envStatus.supabaseKey) && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Environment variables are missing.</strong> Your app will not work correctly on Vercel without these.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Email Confirmation Setup</h3>
            <a
              href="https://supabase.com/dashboard/project/mmwrckfqeqjfqciymemh/auth/url-configuration"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              Open Supabase <ExternalLink size={14} />
            </a>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">⚠️ Fix "localhost refused to connect" error</p>
              <p className="text-sm text-amber-700">
                If email confirmation links redirect to localhost in production, configure these URLs in Supabase Dashboard:
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Site URL:</p>
                <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded block">
                  {import.meta.env.VITE_APP_URL || window.location.origin}
                </code>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Redirect URLs (add all):</p>
                <div className="space-y-1">
                  <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded block">
                    http://localhost:5173
                  </code>
                  <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded block">
                    http://localhost:5173/**
                  </code>
                  <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded block">
                    {import.meta.env.VITE_APP_URL || 'https://your-app.vercel.app'}
                  </code>
                  <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded block">
                    {import.meta.env.VITE_APP_URL || 'https://your-app.vercel.app'}/**
                  </code>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900">Configuration Steps:</p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Go to <strong>Supabase Dashboard → Authentication → URL Configuration</strong></li>
                <li>Set <strong>Site URL</strong> to your production URL</li>
                <li>Add all redirect URLs listed above</li>
                <li>Add <code className="text-xs bg-gray-100 px-1">VITE_APP_URL</code> to Vercel environment variables</li>
                <li>Redeploy your app</li>
                <li>Test by signing up with a new email</li>
              </ol>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> After configuration, the email confirmation link will redirect to your app, which will automatically verify the email and log the user in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CenteredLayout>
  );
};
