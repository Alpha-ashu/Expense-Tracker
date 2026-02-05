import React, { useState } from 'react';
import { db } from '@/lib/database';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { Download, Upload, Trash2, Database, Calculator, Users, Globe, DollarSign, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { 
  downloadDataToFile, 
  uploadDataFromFile,
  exportDataToJSON,
  exportDataToCSV,
  createBackup,
  listBackups 
} from '@/lib/importExport';

export const Settings: React.FC = () => {
  const { currency, setCurrency, language, setLanguage, setCurrentPage, visibleFeatures, setVisibleFeatures } = useApp();
  const [showImportModal, setShowImportModal] = useState(false);
  const [backups, setBackups] = useState<Array<any>>([]);
  const [showBackups, setShowBackups] = useState(false);

  React.useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    const backupList = await listBackups();
    setBackups(backupList);
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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (confirm('This will replace all existing data. Are you sure?')) {
        await uploadDataFromFile(file);
        window.location.reload();
      }
    } catch (error) {
      toast.error('Import failed. Please check the file format.');
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
        
        toast.success('All data cleared');
        window.location.reload();
      }
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-500 mt-1">Manage your data and preferences</p>
        </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
          <p className="text-sm text-gray-500 mt-1">Import, export, and manage your financial data</p>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Download className="text-blue-600" size={20} />
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExportData('csv')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="text-green-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Import Data</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Restore your data from a previously exported JSON file
                  </p>
                </div>
              </div>
              <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
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
                  className="text-blue-600 hover:text-blue-700 text-sm"
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

          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
          <p className="text-sm text-gray-500 mt-1">Customize your app experience</p>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
                className="px-3 py-2 bg-green-50 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
                className="px-3 py-2 bg-purple-50 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Feature Visibility</h3>
          <p className="text-sm text-gray-500 mt-1">Select which features you want to see in your app</p>
        </div>

        <div className="divide-y divide-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'accounts', label: 'Accounts', icon: '🏦' },
              { key: 'transactions', label: 'Transactions', icon: '💳' },
              { key: 'loans', label: 'Loans & EMIs', icon: '📊' },
              { key: 'goals', label: 'Goals', icon: '🎯' },
              { key: 'groups', label: 'Group Expenses', icon: '👥' },
              { key: 'investments', label: 'Investments', icon: '📈' },
              { key: 'reports', label: 'Reports', icon: '📋' },
              { key: 'calendar', label: 'Calendar', icon: '📅' },
              { key: 'todoLists', label: 'To-Do Lists', icon: '✅' },
              { key: 'transfer', label: 'Transfer Money', icon: '🔄' },
              { key: 'taxCalculator', label: 'Tax Calculator', icon: '🧮' },
              { key: 'financeAdvisor', label: 'Finance Advisor', icon: '💼' },
            ].map(feature => (
              <button
                key={feature.key}
                onClick={() => toggleFeature(feature.key)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  visibleFeatures[feature.key]
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
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
                    <Eye size={20} className="text-blue-600" />
                  ) : (
                    <EyeOff size={20} className="text-gray-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">About FinanceLife</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Storage:</strong> All data is stored locally on your device using IndexedDB</p>
          <p><strong>Privacy:</strong> Your financial data never leaves your device</p>
          <p><strong>Offline:</strong> Works completely offline, no internet required</p>
        </div>
      </div>
      </div>
    </CenteredLayout>
  );
};

