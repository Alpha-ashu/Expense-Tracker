import React, { useState } from 'react';
import { db } from '@/lib/database';
import { Download, Upload, Trash2, Database, Calculator, Users, Globe, DollarSign, Eye, EyeOff, LogOut, Settings as SettingsIcon, Smartphone, RefreshCw, Shield, AlertCircle, CheckCircle2, Bell, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  downloadDataToFile,
  createBackup,
  listBackups
} from '@/lib/importExport';
import supabase from '@/utils/supabase/client';
import { permissionService } from '@/services/permissionService';
import { ImportDataModal } from '@/app/components/ImportDataModal';
import {
  clearSmsDetectedTransactions,
  describeSmsTransaction,
  disableSmsTransactionDetection,
  enableSmsTransactionDetection,
  getSmsDetectionStatus,
  markSmsTransactionIgnored,
  primeSmsTransactionDraft,
  scanHistoricalSmsTransactions,
  type SmsDetectionStatus,
} from '@/services/smsTransactionDetectionService';

export const Settings: React.FC = () => {
  const { currency, setCurrency, language, setLanguage, visibleFeatures, setVisibleFeatures, accounts, refreshData, setCurrentPage } = useApp();
  const { user, signOut } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [backups, setBackups] = useState<Array<any>>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [importHistory, setImportHistory] = useState<Array<any>>([]);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [smsStatus, setSmsStatus] = useState<SmsDetectionStatus>({
    supported: false,
    enabled: false,
    permissionState: 'unavailable',
    historicalScanCompleted: false,
  });
  const [isSmsBusy, setIsSmsBusy] = useState(false);

  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('notificationSettings');
      return stored ? JSON.parse(stored) : {
        transactionAlerts: true,
        budgetAlerts: true,
        loanReminders: true,
        groupExpenseUpdates: true,
        goalProgressAlerts: true,
        appUpdates: true,
      };
    } catch {
      return {
        transactionAlerts: true,
        budgetAlerts: true,
        loanReminders: true,
        groupExpenseUpdates: true,
        goalProgressAlerts: true,
        appUpdates: true,
      };
    }
  });

  const toggleNotif = (key: string) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
  };

  const smsTransactions = useLiveQuery(
    () => db.smsTransactions.orderBy('detectedAt').reverse().limit(12).toArray(),
    [],
  ) ?? [];
  const pendingSmsTransactions = smsTransactions.filter((item) => item.status === 'detected');
  const importedSmsTransactions = smsTransactions.filter((item) => item.status === 'imported');

  React.useEffect(() => {
    loadBackups();
    loadImportHistory();
    void loadSmsStatus();
  }, []);

  const loadSmsStatus = async () => {
    const status = await getSmsDetectionStatus();
    setSmsStatus(status);
  };

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
            db.smsTransactions.clear(),
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
        await db.smsTransactions.clear();

        toast.success('All data cleared');
        window.location.reload();
      }
    }
  };

  const handleToggleSmsDetection = async () => {
    setIsSmsBusy(true);

    try {
      if (!smsStatus.enabled) {
        toast.info('Finora reads bank transaction messages only to help track expenses automatically. SMS content stays on this device.');
        const result = await enableSmsTransactionDetection(30);
        setSmsStatus(result.status);

        if (!result.status.supported) {
          toast.error('SMS detection is available only on Android devices.');
          return;
        }

        if (!result.status.enabled) {
          toast.error('SMS permission is required to enable transaction detection.');
          return;
        }

        if (result.historicalScan.scanned > 0) {
          toast.success(`${result.historicalScan.created} SMS transactions ready for review from the last 30 days.`);
        } else {
          toast.success('SMS transaction detection enabled.');
        }
        return;
      }

      const status = await disableSmsTransactionDetection();
      setSmsStatus(status);
      toast.success('SMS transaction detection disabled.');
    } catch (error) {
      console.error('Failed to toggle SMS detection:', error);
      toast.error('Unable to update SMS transaction detection right now.');
    } finally {
      setIsSmsBusy(false);
    }
  };

  const handleRescanSms = async () => {
    setIsSmsBusy(true);

    try {
      const result = await scanHistoricalSmsTransactions(30, 300);
      await loadSmsStatus();
      toast.success(`${result.created} transactions detected from the last 30 days.`);
    } catch (error) {
      console.error('Historical SMS scan failed:', error);
      toast.error('Historical SMS scan failed.');
    } finally {
      setIsSmsBusy(false);
    }
  };

  const handleOpenSmsTransaction = async (smsTransactionId: number) => {
    const draft = await primeSmsTransactionDraft(smsTransactionId);
    if (!draft) {
      toast.error('SMS transaction could not be loaded.');
      return;
    }

    localStorage.setItem('quickBackPage', 'settings');
    setCurrentPage('add-transaction');
  };

  const handleIgnoreSms = async (smsTransactionId: number) => {
    await markSmsTransactionIgnored(smsTransactionId);
    toast.success('SMS transaction ignored.');
  };

  const handleClearSmsData = async () => {
    await clearSmsDetectedTransactions();
    toast.success('Stored SMS detections cleared from this device.');
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      <PageHeader
        icon={<SettingsIcon size={24} className="sm:w-8 sm:h-8" />}
        title="Settings"
        showBack
        backTo="dashboard"
      />

      {/* ── Preferences ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="text-green-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Currency</h4>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="text-purple-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Language</h4>
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

      {/* ── Notification Settings ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { key: 'transactionAlerts',   label: 'Transaction Alerts' },
            { key: 'budgetAlerts',        label: 'Budget Alerts' },
            { key: 'loanReminders',       label: 'Loan & EMI Reminders' },
            { key: 'groupExpenseUpdates', label: 'Group Expense Updates' },
            { key: 'goalProgressAlerts',  label: 'Goal Progress Alerts' },
            { key: 'appUpdates',          label: 'App Updates & Announcements' },
          ].map(({ key, label }) => (
            <div key={key} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bell className="text-blue-600" size={18} />
                  </div>
                  <h4 className="font-medium text-gray-900">{label}</h4>
                </div>
                <button
                  type="button"
                  aria-label={`Toggle ${label}`}
                  title={`Toggle ${label}`}
                  onClick={() => toggleNotif(key)}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black/20',
                    notifSettings[key] ? 'bg-black' : 'bg-gray-300',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                      notifSettings[key] ? 'translate-x-5' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Data Management ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Download className="text-green-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Export Data</h4>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="text-blue-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Import Data</h4>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="text-yellow-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Create Backup</h4>
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
                <h4 className="font-medium text-gray-900">Recent Imports ({importHistory.length})</h4>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 className="text-red-600" size={20} />
                </div>
                <h4 className="font-medium text-gray-900">Clear All Data</h4>
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
        transition={{ delay: 0.3 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">SMS Transaction Detection</h3>
            <button
              type="button"
              onClick={handleToggleSmsDetection}
              disabled={isSmsBusy}
              className={cn(
                'min-w-[112px] rounded-full px-4 py-2 text-sm font-semibold transition-all shadow-sm',
                smsStatus.enabled
                  ? 'bg-black text-white hover:bg-gray-900'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
                isSmsBusy && 'cursor-not-allowed opacity-60',
              )}
            >
              {isSmsBusy ? 'Working...' : smsStatus.enabled ? 'Turn Off' : 'Turn On'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Platform</p>
                    <p className="text-sm text-gray-500">
                      {smsStatus.supported ? 'Android supported' : 'Available on Android only'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    smsStatus.permissionState === 'granted'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600',
                  )}>
                    {smsStatus.permissionState === 'granted' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Permission</p>
                    <p className="text-sm text-gray-500 capitalize">{smsStatus.permissionState}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                    <Database size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Detections</p>
                    <p className="text-sm text-gray-500">
                      {pendingSmsTransactions.length} pending · {importedSmsTransactions.length} imported
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!smsStatus.supported && (
              <p className="text-sm text-gray-500 mt-4">Available on Android only.</p>
            )}

            {smsStatus.supported && (
              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleRescanSms}
                  disabled={isSmsBusy || !smsStatus.enabled}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={16} />
                    Rescan Last 30 Days
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSmsData}
                  disabled={isSmsBusy || smsTransactions.length === 0}
                  className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Stored Detections
                </button>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-medium text-gray-900">Detected Transactions</h4>
              {smsStatus.lastScanAt && (
                <p className="text-xs text-gray-400">
                  Last scan: {new Date(smsStatus.lastScanAt).toLocaleString()}
                </p>
              )}
            </div>

            {smsTransactions.length > 0 ? (
              <div className="space-y-3 mt-5">
                {smsTransactions.map((smsTransaction) => (
                  <div key={smsTransaction.id} className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{describeSmsTransaction(smsTransaction)}</p>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                            smsTransaction.status === 'imported'
                              ? 'bg-emerald-100 text-emerald-700'
                              : smsTransaction.status === 'ignored'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-sky-100 text-sky-700',
                          )}>
                            {smsTransaction.status}
                          </span>
                          {smsTransaction.duplicateTransactionId && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Possible duplicate
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mt-2">
                          {smsTransaction.bankName || 'Unknown bank'}
                          {smsTransaction.accountLast4 ? ` • ${smsTransaction.accountLast4}` : ''}
                          {smsTransaction.suggestedCategory ? ` • ${smsTransaction.suggestedCategory}` : ''}
                        </p>

                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(smsTransaction.date).toLocaleString()}
                          {smsTransaction.messagePreview ? ` • ${smsTransaction.messagePreview}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {smsTransaction.status === 'detected' && smsTransaction.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenSmsTransaction(smsTransaction.id!)}
                              className="px-4 py-2 rounded-xl bg-black text-white hover:bg-gray-900 transition-colors"
                            >
                              {smsTransaction.duplicateTransactionId ? 'Import Anyway' : 'Add'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIgnoreSms(smsTransaction.id!)}
                              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Ignore
                            </button>
                          </>
                        )}
                        {smsTransaction.status === 'imported' && smsTransaction.linkedTransactionId && (
                          <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
                            Imported
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-6 mt-5 text-center">
                <p className="text-gray-500 text-sm">No SMS transactions detected yet</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Feature Visibility ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Feature Visibility</h3>
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
                    <p className="font-medium text-gray-900">{feature.label}</p>
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

      {/* ── Legal ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-gray-900">Legal</h3>
        </div>
        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="text-gray-500" size={18} />
                </div>
                <h4 className="font-medium text-gray-900">Privacy Policy</h4>
              </div>
              <button
                onClick={() => setCurrentPage('privacy-policy')}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View <ExternalLink size={14} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="text-gray-500" size={18} />
                </div>
                <h4 className="font-medium text-gray-900">Terms &amp; Conditions</h4>
              </div>
              <button
                onClick={() => setCurrentPage('terms')}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

