import React, { useState } from 'react';
import { db } from '@/lib/database';
import { Download, Upload, Trash2, Database, Calculator, Users, Globe, DollarSign, Eye, EyeOff, LogOut, Settings as SettingsIcon, Smartphone, RefreshCw, AlertCircle, CheckCircle2, Bell, ExternalLink, FileText } from 'lucide-react';
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
import { runWithCloudSyncSuppressed } from '@/lib/auth-sync-integration';
import {
  financialDataCaptureService,
  type AiQueueRunHistoryEntry,
  type AiQueueRunTelemetry,
  type FinancialCaptureTask,
} from '@/services/financialDataCaptureService';

const AI_REPORT_REDACTION_STORAGE_KEY = 'settings_ai_report_redaction_enabled';
const AI_FAILURE_DETAILS_EXPANDED_STORAGE_KEY = 'settings_ai_failure_details_expanded';

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
  const [isAiQueueBusy, setIsAiQueueBusy] = useState(false);
  const [showAiFailureDetails, setShowAiFailureDetails] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AI_FAILURE_DETAILS_EXPANDED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [redactAiReports, setRedactAiReports] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(AI_REPORT_REDACTION_STORAGE_KEY);
      if (stored == null) return true;
      return stored === 'true';
    } catch {
      return true;
    }
  });

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
  const aiQueueTasks = useLiveQuery(async () => {
    const record = await db.settings.get('financial_capture_ai_queue');
    const value = record?.value;
    return Array.isArray(value) ? (value as FinancialCaptureTask[]) : [];
  }, []) ?? [];
  const aiQueueTelemetry = useLiveQuery(async () => {
    const record = await db.settings.get('financial_capture_ai_last_run');
    const value = record?.value;
    return (value && typeof value === 'object') ? (value as AiQueueRunTelemetry) : null;
  }, []);
  const aiQueueRunHistory = useLiveQuery(async () => {
    const record = await db.settings.get('financial_capture_ai_run_history');
    const value = record?.value;
    return Array.isArray(value) ? (value as AiQueueRunHistoryEntry[]) : [];
  }, []) ?? [];
  const aiQueueStats = {
    total: aiQueueTasks.length,
    queued: aiQueueTasks.filter((task) => task.status === 'queued').length,
    failed: aiQueueTasks.filter((task) => task.status === 'failed').length,
  };

  const formatTelemetryTime = (value?: string) => {
    if (!value) return 'Never';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleString();
  };

  const getRunSuccessPercent = (entry: AiQueueRunHistoryEntry) => {
    const total = entry.processed + entry.failed;
    if (total <= 0) return 0;
    return Math.round((entry.processed / total) * 100);
  };

  const getRunHeightClass = (entry: AiQueueRunHistoryEntry) => {
    const total = entry.processed + entry.failed;
    if (total >= 8) return 'h-12';
    if (total >= 5) return 'h-10';
    if (total >= 3) return 'h-8';
    if (total >= 1) return 'h-6';
    return 'h-5';
  };

  const FAILURE_STREAK_ALERT_THRESHOLD = 3;

  const currentFailureStreak = React.useMemo(() => {
    let streak = 0;
    for (const entry of aiQueueRunHistory) {
      if ((entry.failed || 0) > 0) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [aiQueueRunHistory]);

  const failedRunsInRecentFive = React.useMemo(() => (
    aiQueueRunHistory.slice(0, 5).filter((entry) => (entry.failed || 0) > 0).length
  ), [aiQueueRunHistory]);

  const shouldShowFailureAlert = currentFailureStreak >= FAILURE_STREAK_ALERT_THRESHOLD;
  const recentFailedTasks = aiQueueTasks
    .filter((task) => task.status === 'failed')
    .slice(0, 3);

  React.useEffect(() => {
    loadBackups();
    loadImportHistory();
    void loadSmsStatus();
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(AI_REPORT_REDACTION_STORAGE_KEY, String(redactAiReports));
    } catch {
      // Ignore storage errors and keep runtime value.
    }
  }, [redactAiReports]);

  React.useEffect(() => {
    try {
      localStorage.setItem(AI_FAILURE_DETAILS_EXPANDED_STORAGE_KEY, String(showAiFailureDetails));
    } catch {
      // Ignore storage errors and keep runtime value.
    }
  }, [showAiFailureDetails]);

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
        try {
          // Clear cloud user-scoped entities first so sync does not restore cleared local records.
          const cloudTables = ['accounts', 'friends', 'transactions', 'loans', 'goals', 'group_expenses', 'investments'] as const;
          const cloudDeleteErrors: string[] = [];
          if (user?.id) {
            const results = await Promise.allSettled(
              cloudTables.map((table) => supabase.from(table).delete().eq('user_id', user.id)),
            );

            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                cloudDeleteErrors.push(`${cloudTables[index]}: request failed`);
                return;
              }
              if (result.value.error) {
                cloudDeleteErrors.push(`${cloudTables[index]}: ${result.value.error.message}`);
              }
            });
          }

          // Prevent stale queued upserts from replaying after reload.
          localStorage.removeItem('finora_sync_queue_v3');

          await runWithCloudSyncSuppressed(async () => {
            await Promise.all([
              db.accounts.clear(),
              db.friends.clear(),
              db.transactions.clear(),
              db.loans.clear(),
              db.loanPayments.clear(),
              db.goals.clear(),
              db.goalContributions.clear(),
              db.groupExpenses.clear(),
              db.investments.clear(),
              db.notifications.clear(),
              db.categories.clear(),
              db.importHistories.clear(),
              db.smsTransactions.clear(),
              db.documents.clear(),
              db.merchantProfiles.clear(),
              db.userCategoryPreferences.clear(),
              db.expenseBills.clear(),
              db.expenseCategories.clear(),
              db.budgets.clear(),
              db.taxCalculations.clear(),
              db.gold.clear(),
              db.groups.clear(),
              db.toDoItems.clear(),
              db.toDoLists.clear(),
              db.toDoListShares.clear(),
              db.chatMessages.clear(),
              db.chatConversations.clear(),
              db.bookingRequests.clear(),
              db.advisorAssignments.clear(),
              db.advisorSessions.clear(),
              db.financeAdvisors.clear(),
              db.logs.clear(),
              db.errorReports.clear(),
              db.backups.clear(),
            ]);
          });

          if (cloudDeleteErrors.length > 0) {
            console.warn('Cloud clear partial failures:', cloudDeleteErrors);
            toast.warning('Local data cleared. Some cloud rows could not be deleted right now.');
          } else {
            toast.success('All user data cleared. Profile/account identity has been preserved.');
          }
          refreshData();
          window.location.reload();
        } catch (error) {
          console.error('Failed to clear all data:', error);
          toast.error('Failed to clear all data');
        }
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

  const handleProcessAiQueue = async () => {
    setIsAiQueueBusy(true);
    try {
      const result = await financialDataCaptureService.processQueuedAiTasksInForeground({ trigger: 'manual' });
      if (result.processed > 0) {
        toast.success(`Processed ${result.processed} queued AI task(s).`);
      } else if (result.failed > 0) {
        toast.warning(`No tasks processed. ${result.failed} task(s) failed.`);
      } else {
        toast.info('No queued AI tasks to process.');
      }
    } catch (error) {
      console.error('Failed to process AI queue:', error);
      toast.error('Failed to process AI queue right now.');
    } finally {
      setIsAiQueueBusy(false);
    }
  };

  const handleRetryFailedAiTasks = async () => {
    setIsAiQueueBusy(true);
    try {
      const result = await financialDataCaptureService.retryFailedAiTasks();
      if (result.retried > 0) {
        toast.success(`Re-queued ${result.retried} failed AI task(s).`);
      } else {
        toast.info('No failed AI tasks to retry.');
      }
    } catch (error) {
      console.error('Failed to retry AI queue tasks:', error);
      toast.error('Could not retry failed AI tasks.');
    } finally {
      setIsAiQueueBusy(false);
    }
  };

  const handleClearAiQueue = async () => {
    if (!confirm('Clear all queued AI tasks? Failed and queued tasks will be removed.')) return;

    setIsAiQueueBusy(true);
    try {
      await financialDataCaptureService.clearAiQueue();
      toast.success('AI queue cleared.');
    } catch (error) {
      console.error('Failed to clear AI queue:', error);
      toast.error('Failed to clear AI queue.');
    } finally {
      setIsAiQueueBusy(false);
    }
  };

  const handleRecoverAiQueue = async () => {
    if (isAiQueueBusy) return;

    setIsAiQueueBusy(true);
    try {
      const retried = await financialDataCaptureService.retryFailedAiTasks();
      const result = await financialDataCaptureService.processQueuedAiTasksInForeground({
        trigger: 'manual',
        includeFailed: true,
      });

      if (result.processed > 0) {
        toast.success(`Recovery completed: ${result.processed} task(s) processed.`);
      } else if (retried.retried > 0 || result.failed > 0) {
        toast.warning(`Recovery attempted. ${result.failed} task(s) still failing.`);
      } else {
        toast.info('No failed tasks needed recovery.');
      }
    } catch (error) {
      console.error('AI queue recovery failed:', error);
      toast.error('Failed to run queue recovery.');
    } finally {
      setIsAiQueueBusy(false);
    }
  };

  const handleCopyAiErrors = async () => {
    if (recentFailedTasks.length === 0) {
      toast.info('No failed task errors to copy.');
      return;
    }

    const text = recentFailedTasks
      .map((task, index) => {
        const safeError = redactAiReports
          ? redactErrorText(task.lastError || 'No detailed error captured')
          : (task.lastError || 'No detailed error captured');
        return `${index + 1}. ${task.kind}\nAttempts: ${task.attempts}\nError: ${safeError}\n`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Failed task errors copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy AI error details:', error);
      toast.error('Could not copy errors right now.');
    }
  };

  const redactErrorText = (value: string) => value
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-id]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b\d{10,16}\b/g, '[redacted-number]')
    .replace(/\b(?:https?:\/\/|www\.)\S+\b/gi, '[redacted-url]');

  const maskTaskId = (taskId: string) => {
    if (taskId.length <= 8) return '[redacted-id]';
    return `${taskId.slice(0, 2)}***${taskId.slice(-2)}`;
  };

  const buildAllFailedTasksReport = () => {
    const allFailedTasks = aiQueueTasks.filter((task) => task.status === 'failed');
    if (allFailedTasks.length === 0) {
      return null;
    }

    const header = [
      'Finora AI Queue Failure Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Failed Tasks: ${allFailedTasks.length}`,
      '',
    ].join('\n');

    const body = allFailedTasks
      .map((task, index) => {
        const queuedAt = task.queuedAt ? formatTelemetryTime(task.queuedAt) : 'Unknown';
        const safeTaskId = redactAiReports ? maskTaskId(task.id) : task.id;
        const safeError = redactAiReports
          ? redactErrorText(task.lastError || 'No detailed error captured')
          : (task.lastError || 'No detailed error captured');
        return [
          `${index + 1}. ${task.kind}`,
          `Task ID: ${safeTaskId}`,
          `Status: ${task.status}`,
          `Attempts: ${task.attempts}`,
          `Queued At: ${queuedAt}`,
          `Error: ${safeError}`,
          '',
        ].join('\n');
      })
      .join('\n');

    return `${header}${body}`;
  };

  const handleCopyAllAiErrors = async () => {
    const report = buildAllFailedTasksReport();
    if (!report) {
      toast.info('No failed tasks available to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(report);
      toast.success('Full failed-task report copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy full AI error report:', error);
      toast.error('Could not copy full report right now.');
    }
  };

  const handleDownloadAllAiErrors = () => {
    const report = buildAllFailedTasksReport();
    if (!report) {
      toast.info('No failed tasks available to download.');
      return;
    }

    try {
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const link = document.createElement('a');
      link.href = url;
      link.download = `finora-ai-queue-failures-${stamp}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Failure report downloaded.');
    } catch (error) {
      console.error('Failed to download AI error report:', error);
      toast.error('Could not download report right now.');
    }
  };

  const handleResetAiQueueUiPreferences = () => {
    try {
      localStorage.removeItem(AI_REPORT_REDACTION_STORAGE_KEY);
      localStorage.removeItem(AI_FAILURE_DETAILS_EXPANDED_STORAGE_KEY);
    } catch {
      // Ignore storage errors and still reset in-memory state.
    }

    setRedactAiReports(true);
    setShowAiFailureDetails(false);
    toast.success('Queue UI preferences reset to defaults.');
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

      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="rounded-[30px] overflow-hidden relative bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass"
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Processing Queue</h3>
            <span className="rounded-full bg-gray-900/5 px-3 py-1 text-xs font-semibold text-gray-700">
              {aiQueueStats.total} total
            </span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Queued</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{aiQueueStats.queued}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Failed</p>
              <p className="mt-1 text-xl font-semibold text-amber-700">{aiQueueStats.failed}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{aiQueueStats.total}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-gray-600">
                Last run: <span className="font-medium text-gray-900">{formatTelemetryTime(aiQueueTelemetry?.lastRunAt)}</span>
              </p>
              <p className="text-gray-600">
                Trigger: <span className="font-medium capitalize text-gray-900">{aiQueueTelemetry?.trigger || 'N/A'}</span>
              </p>
              <p className="text-gray-600">
                Processed/Failed: <span className="font-medium text-gray-900">{(aiQueueTelemetry?.processed ?? 0)}/{(aiQueueTelemetry?.failed ?? 0)}</span>
              </p>
              <button
                type="button"
                onClick={handleResetAiQueueUiPreferences}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                Reset UI Preferences
              </button>
            </div>
          </div>

          <div className={cn(
            'rounded-2xl border px-4 py-3',
            shouldShowFailureAlert
              ? 'border-amber-300 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50',
          )}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="space-y-1">
                <p className={cn('font-medium', shouldShowFailureAlert ? 'text-amber-800' : 'text-emerald-800')}>
                  {shouldShowFailureAlert
                    ? `Alert: ${currentFailureStreak} consecutive runs had failures`
                    : 'Queue health is stable'}
                </p>
                <p className={cn(shouldShowFailureAlert ? 'text-amber-700' : 'text-emerald-700')}>
                  Failed runs in last 5: <span className="font-semibold">{failedRunsInRecentFive}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {shouldShowFailureAlert && (
                  <button
                    type="button"
                    onClick={handleRecoverAiQueue}
                    disabled={isAiQueueBusy}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isAiQueueBusy
                        ? 'cursor-not-allowed bg-amber-200 text-amber-600'
                        : 'bg-amber-600 text-white hover:bg-amber-700',
                    )}
                  >
                    Retry Failed Now
                  </button>
                )}
                {shouldShowFailureAlert && recentFailedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAiFailureDetails((prev) => !prev)}
                    className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    {showAiFailureDetails ? 'Hide Error Details' : 'View Error Details'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleProcessAiQueue}
                  disabled={isAiQueueBusy}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                    isAiQueueBusy
                      ? 'cursor-not-allowed border-gray-300 text-gray-400'
                      : 'border-gray-400 text-gray-700 hover:bg-white/70',
                  )}
                >
                  Process Now
                </button>
              </div>
            </div>

            {showAiFailureDetails && recentFailedTasks.length > 0 && (
              <div className="mt-3 space-y-2 rounded-xl border border-amber-300 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                    redactAiReports
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-amber-300 bg-amber-50 text-amber-800',
                  )}>
                    Redaction {redactAiReports ? 'ON' : 'OFF'}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <label className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={redactAiReports}
                        onChange={(event) => setRedactAiReports(event.target.checked)}
                        className="h-3.5 w-3.5 rounded border-amber-400"
                        aria-label="Redact sensitive details in exported AI error reports"
                        title="Redact sensitive details in exported AI error reports"
                      />
                      Redact Sensitive Data
                    </label>
                    <span className="text-[11px] text-amber-800/90">
                      Masks IDs, emails, long numbers, and URLs in details and exports.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAiErrors}
                      className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      Copy Visible
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAllAiErrors}
                      className="rounded-full border border-amber-500 px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      Copy All Failed
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadAllAiErrors}
                      className="rounded-full border border-amber-500 px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      Download .txt
                    </button>
                  </div>
                </div>
                {recentFailedTasks.map((task) => (
                  <div key={`failed-${task.id}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-amber-900">{task.kind}</p>
                    <p className="mt-1 text-amber-800">
                      {redactAiReports
                        ? redactErrorText(task.lastError || 'No detailed error was captured for this task.')
                        : (task.lastError || 'No detailed error was captured for this task.')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {aiQueueRunHistory.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Run Trend</p>
                <p className="text-xs text-gray-500">Newest to oldest</p>
              </div>

              <div className="flex items-end gap-1 h-12">
                {aiQueueRunHistory.slice(0, 16).map((entry) => {
                  const successPercent = getRunSuccessPercent(entry);
                  const barHeightClass = getRunHeightClass(entry);
                  const barColor = successPercent >= 80
                    ? 'bg-emerald-500'
                    : successPercent >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500';

                  return (
                    <div
                      key={entry.id}
                      title={`${formatTelemetryTime(entry.lastRunAt)} | ${entry.processed} processed / ${entry.failed} failed`}
                      className={cn('w-3 rounded-sm transition-opacity hover:opacity-80', barColor, barHeightClass)}
                    />
                  );
                })}
              </div>

              <div className="space-y-1">
                {aiQueueRunHistory.slice(0, 4).map((entry) => (
                  <div key={`row-${entry.id}`} className="flex items-center justify-between text-xs text-gray-600">
                    <span>{formatTelemetryTime(entry.lastRunAt)}</span>
                    <span className="capitalize">{entry.trigger}</span>
                    <span className="font-medium text-gray-900">{entry.processed}/{entry.failed}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleProcessAiQueue}
              disabled={isAiQueueBusy}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold shadow-sm',
                isAiQueueBusy
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-black text-white hover:bg-gray-900',
              )}
            >
              Process Queue
            </button>
            <button
              type="button"
              onClick={handleRetryFailedAiTasks}
              disabled={isAiQueueBusy || aiQueueStats.failed === 0}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                isAiQueueBusy || aiQueueStats.failed === 0
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-amber-300 text-amber-700 hover:bg-amber-50',
              )}
            >
              Retry Failed
            </button>
            <button
              type="button"
              onClick={handleClearAiQueue}
              disabled={isAiQueueBusy || aiQueueStats.total === 0}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                isAiQueueBusy || aiQueueStats.total === 0
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-red-300 text-red-700 hover:bg-red-50',
              )}
            >
              Clear Queue
            </button>
          </div>

          {aiQueueTasks.length > 0 && (
            <div className="space-y-2">
              {aiQueueTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{task.kind}</p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                        task.status === 'failed'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700',
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Attempts: {task.attempts}</p>
                  {task.lastError && (
                    <p className="mt-1 text-xs text-amber-700">{task.lastError}</p>
                  )}
                </div>
              ))}
            </div>
          )}
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
