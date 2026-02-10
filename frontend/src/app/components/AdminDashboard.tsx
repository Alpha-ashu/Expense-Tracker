import React, { useMemo } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { FeatureKey } from '@/lib/featureFlags';
import { ChevronLeft, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  accounts: 'Bank accounts, credit cards, and wallet management',
  transactions: 'View and manage income/expense transactions',
  loans: 'Loans and EMI tracking',
  goals: 'Savings goals and targets',
  groups: 'Group expense splitting',
  investments: 'Investment portfolio tracking',
  reports: 'Financial reports and analytics',
  calendar: 'Calendar view for transactions',
  todoLists: 'To-do lists and reminders',
  transfer: 'Money transfers between accounts',
  taxCalculator: 'Tax calculation tools',
  bookAdvisor: 'Book and consult with financial advisors',
  adminPanel: 'Admin panel access for feature flag controls',
  advisorPanel: 'Advisor workspace and tools',
  notifications: 'User notifications and alerts',
  userProfile: 'User profile and account settings',
  settings: 'Application settings',
  dashboard: 'Main dashboard view',
};

export const AdminDashboard: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { role } = useAuth();
  const { flags, toggleFeature, resetToDefaults, getFeatureStatus } = useFeatureFlags();

  // Only admins can access this
  if (role !== 'admin') {
    return (
      <CenteredLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only admins can access the admin panel.</p>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </CenteredLayout>
    );
  }

  const handleReset = () => {
    if (confirm('Reset all feature flags to defaults? This cannot be undone.')) {
      resetToDefaults();
      toast.success('Feature flags reset to defaults');
    }
  };

  const featureKeys = Object.keys(FEATURE_DESCRIPTIONS) as FeatureKey[];

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
            <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
            <p className="text-gray-500 mt-1">Feature flags & access control</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Feature Flags</h3>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <RotateCcw size={16} />
              Reset Defaults
            </button>
          </div>

          <p className="text-sm text-gray-600">
            Toggle features for each role. Changes apply instantly across the app.
          </p>

          <div className="space-y-4">
            {featureKeys.map((feature) => {
              const status = getFeatureStatus(feature);
              const description = FEATURE_DESCRIPTIONS[feature];

              return (
                <div
                  key={feature}
                  className="rounded-lg border border-gray-200 p-4 space-y-3"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 capitalize">
                      {feature.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                    {(['admin', 'advisor', 'user'] as const).map((roleKey) => (
                      <label
                        key={roleKey}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={status[roleKey]}
                          onChange={(e) =>
                            toggleFeature(feature, roleKey, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {roleKey}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 text-xs">
                    {status.admin && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        <Eye size={12} />
                        Admin
                      </span>
                    )}
                    {status.advisor && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        <Eye size={12} />
                        Advisor
                      </span>
                    )}
                    {status.user && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                        <Eye size={12} />
                        User
                      </span>
                    )}
                    {!status.admin && !status.advisor && !status.user && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        <EyeOff size={12} />
                        Hidden from all
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How this works:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Toggle features for each role independently</li>
            <li>Changes apply instantly in your current browser</li>
            <li>Stored in your browser's localStorage (dev/test only)</li>
            <li>Test advisor & user views before releasing features</li>
            <li>Reset to defaults anytime</li>
          </ul>
        </div>
      </div>
    </CenteredLayout>
  );
};
