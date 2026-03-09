import React, { useState } from 'react';
import { db } from '@/lib/database';
import { Download, Upload, Trash2, Database, Calculator, Users, Globe, DollarSign, Eye, EyeOff, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import {
  downloadDataToFile,
  createBackup,
  listBackups
} from '@/lib/importExport';
import supabase from '@/utils/supabase/client';
import { permissionService } from '@/services/permissionService';
import { ImportDataModal } from '@/app/components/ImportDataModal';

export const Settings: React.FC = () => {
  const { currency, setCurrency, language, setLanguage, visibleFeatures, setVisibleFeatures, accounts, refreshData } = useApp();
  const { user, signOut } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [backups, setBackups] = useState<Array<any>>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [importHistory, setImportHistory] = useState<Array<any>>([]);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  React.useEffect(() => {
    loadBackups();
    loadImportHistory();
  }, []);

  const loadBackups = async () => {
    const backupList = await listBackups();
    setBackups(backupList);
  };

  const loadImportHistory = async () => {
    const history = await db.importHistories.orderBy('createdAt').reverse().limit(8).toArray();
    setImportHistory(history);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks

    setIsSigningOut(true);
    console.log('🔐 Starting sign out process...');
    toast.info('Signing out...');

    try {
      // Step 1: Sign out from Supabase (with timeout)
      const signOutPromise = supabase.auth.signOut({ scope: 'global' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );

      try {
        await Promise.race([signOutPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Supabase signOut timed out or failed (non-blocking):', e);
      }

      // Step 2: Clear permissions
      try {
        permissionService.clearPermissions();
      } catch (e) {
        console.warn('Permission clear error (non-blocking):', e);
      }

      // Step 3: Clear all storage (PIN preserved)
      try {
        const pinBackup = {
          hash: localStorage.getItem('Finora_encrypted_key'),
          salt: localStorage.getItem('Finora_salt'),
        };
        localStorage.clear();
        sessionStorage.clear();
        if (pinBackup.hash) localStorage.setItem('Finora_encrypted_key', pinBackup.hash);
        if (pinBackup.salt) localStorage.setItem('Finora_salt', pinBackup.salt);
      } catch (e) {
        console.warn('Storage clear error (non-blocking):', e);
      }

      // Step 4: Clear IndexedDB tables (with timeout)
      try {
        await Promise.race([
          Promise.all([
            db.accounts.clear(),
            db.transactions.clear(),
            db.loans.clear(),
            db.goals.clear(),
            db.investments.clear(),
            db.notifications.clear(),
            db.groupExpenses.clear(),
            db.friends.clear(),
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB clear timeout')), 3000))
        ]);
      } catch (e) {
        console.warn('DB clear error (non-blocking):', e);
      }

      // Step 5: Delete the database
      try {
        window.indexedDB.deleteDatabase('FinoraDB');
      } catch (e) {
        console.warn('IndexedDB delete error (non-blocking):', e);
      }

      console.log('✅ Sign out completed successfully');
      toast.success('Signed out successfully');

      // Step 6: Hard redirect immediately
      window.location.href = window.location.origin + '/login?logged_out=1';

    } catch (error) {
      console.error('❌ Sign out failed:', error);

      // Force cleanup even on error (PIN preserved)
      try {
        const pinBackup = {
          hash: localStorage.getItem('Finora_encrypted_key'),
          salt: localStorage.getItem('Finora_salt'),
        };
        localStorage.clear();
        sessionStorage.clear();
        if (pinBackup.hash) localStorage.setItem('Finora_encrypted_key', pinBackup.hash);
        if (pinBackup.salt) localStorage.setItem('Finora_salt', pinBackup.salt);
      } catch (e) {
        // Ignore
      }

      // Always redirect
      window.location.href = window.location.origin + '/login';
    }
  };

  const toggleFeature = (feature: string) => {
    const updated = { ...visibleFeatures, [feature]: !visibleFeatures[feature] };
    setVisibleFeatures(updated);
    toast.success('Feature visibility updated');
  };

  const handleExportData = async (format: 'json' | 'csv' = 'json') => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `finance-life-backup-${timestamp}`;
      await downloadDataToFile(filename, format);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleCreateBackup = async () => {
    try {
      await createBackup();
      await loadBackups();
    } catch (error) {
      toast.error('Failed to create backup');
    }
  };

  const handleClearAllData = async () => {
    if (confirm('This will delete ALL your data. This action cannot be undone. Are you sure?')) {
      if (confirm('Are you ABSOLUTELY sure? This is your last warning!')) {
        await db.accounts.clear();
        await db.transactions.clear();
        await db.loans.clear();
        await db.goals.clear();
        await db.investments.clear();
        await db.groupExpenses.clear();
        await db.notifications.clear();
        await db.categories.clear();
        await db.importHistories.clear();

        toast.success('All data cleared');
        window.location.reload();
      }
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      <PageHeader
        icon={<SettingsIcon size={24} className="sm:w-8 sm:h-8" />}
        title="Settings"
        subtitle="Manage your data and preferences"
        showBack
        backTo="dashboard"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
          <p className="text-sm text-gray-500 mt-1">Import, export, and manage your financial data</p>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Download className="text-green-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Export Data</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Download all your data as a JSON or CSV file for backup
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportData('json')}
                  className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExportData('csv')}
                  className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
                >
                  CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="text-blue-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Import Data</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Preview and import CSV or JSON from other expense trackers, or restore a Finora backup
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-900 transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                Import
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="text-yellow-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Create Backup</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Create an automatic backup of all your data
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreateBackup}
                className="px-4 py-2 bg-black text-white rounded-full hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
              >
                Create
              </button>
            </div>
          </div>

          {backups.length > 0 && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Backups ({backups.length})</h4>
                <button
                  onClick={() => setShowBackups(!showBackups)}
                  className="text-black hover:text-gray-700 text-sm font-medium"
                >
                  {showBackups ? 'Hide' : 'Show'}
                </button>
              </div>
              {showBackups && (
                <div className="space-y-2">
                  {backups.map((backup, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                      <div className="text-sm">
                        <p className="font-medium">{backup.filename}</p>
                        <p className="text-gray-500">{new Date(backup.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importHistory.length > 0 && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">Recent Imports ({importHistory.length})</h4>
                  <p className="text-sm text-gray-500 mt-1">Track imported files, skipped duplicates, and created categories</p>
                </div>
                <button
                  onClick={() => setShowImportHistory(!showImportHistory)}
                  className="text-black hover:text-gray-700 text-sm font-medium"
                >
                  {showImportHistory ? 'Hide' : 'Show'}
                </button>
              </div>
              {showImportHistory && (
                <div className="space-y-3">
                  {importHistory.map((entry, idx) => (
                    <div key={entry.id ?? idx} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{entry.fileName}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-900 font-medium">{entry.importedRecords} imported</p>
                          <p className="text-gray-500">{entry.skippedRecords} skipped · {entry.duplicateRecords} duplicates</p>
                        </div>
                      </div>
                      {entry.createdCategories?.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                          Created categories: {entry.createdCategories.join(', ')}
                        </p>
                      )}
                      {entry.sourceKind === 'backup' && (
                        <p className="text-sm text-gray-500 mt-2">Backup restore</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 className="text-red-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Clear All Data</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Permanently delete all your data from this device
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearAllData}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all active:scale-95 shadow-lg"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {showImportModal && (
        <ImportDataModal
          accounts={accounts}
          userId={user?.id}
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            await loadImportHistory();
            await refreshData();
          }}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
          <p className="text-sm text-gray-500 mt-1">Customize your app experience</p>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="text-green-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Currency</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Select your preferred currency for all transactions
                  </p>
                </div>
              </div>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  toast.success(`Currency changed to ${e.target.value}`);
                }}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                aria-label="Select currency"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="SGD">SGD - Singapore Dollar</option>
              </select>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="text-purple-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Language</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose your preferred language
                  </p>
                </div>
              </div>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  toast.success(`Language changed to ${e.target.value}`);
                }}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
                aria-label="Select language"
              >
                <option value="en">English</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
                <option value="de">Deutsch (German)</option>
                <option value="it">Italiano (Italian)</option>
                <option value="pt">Português (Portuguese)</option>
                <option value="ja">日本語 (Japanese)</option>
                <option value="zh">中文 (Chinese)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Feature Visibility</h3>
          <p className="text-sm text-gray-500 mt-1">Select which features you want to see in your app</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
              { key: 'accounts', label: 'Accounts', icon: '🏦' },
              { key: 'transactions', label: 'Transactions', icon: '💳' },
              { key: 'loans', label: 'Loans & EMIs', icon: '📊' },
              { key: 'goals', label: 'Goals', icon: '🎯' },
              { key: 'groups', label: 'Group Expenses', icon: '👥' },
              { key: 'investments', label: 'Investments', icon: '📈' },
              { key: 'reports', label: 'Reports', icon: '📋' },
              { key: 'calendar', label: 'Calendar', icon: '📅' },
              { key: 'todoLists', label: 'To-Do Lists', icon: '✅' },
              { key: 'bookAdvisor', label: 'Book Advisor', icon: '💼' },
              { key: 'notifications', label: 'Notifications', icon: '🔔' },
            ].map(feature => (
              <button
                key={feature.key}
                onClick={() => toggleFeature(feature.key)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left backdrop-blur-sm",
                  visibleFeatures[feature.key]
                    ? 'border-black/20 bg-white/80 shadow-sm'
                    : 'border-gray-200/50 bg-gray-50/60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900">{feature.label}</p>
                      <p className="text-xs text-gray-500">
                        {visibleFeatures[feature.key] ? 'Visible' : 'Hidden'}
                      </p>
                    </div>
                  </div>
                  {visibleFeatures[feature.key] ? (
                    <Eye size={20} className="text-gray-700" />
                  ) : (
                    <EyeOff size={20} className="text-gray-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

    </div>
  );
};

