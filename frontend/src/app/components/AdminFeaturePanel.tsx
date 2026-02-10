import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { ChevronLeft, Settings, ToggleRight, ToggleLeft, Shield } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin Feature Control Panel
 * Only accessible to admin role (shake.job.atgmail.com)
 */
interface FeatureControl {
  name: string;
  key: string;
  readiness: 'unreleased' | 'beta' | 'released' | 'deprecated';
  description: string;
  lastUpdated: Date;
}

const FEATURES: FeatureControl[] = [
  {
    name: 'Book Advisor',
    key: 'bookAdvisor',
    readiness: 'released',
    description: 'Users can book financial advisors for sessions',
    lastUpdated: new Date(),
  },
  {
    name: 'Todo Lists',
    key: 'todoLists',
    readiness: 'released',
    description: 'Task management and collaboration features',
    lastUpdated: new Date(),
  },
  {
    name: 'Tax Calculator',
    key: 'taxCalculator',
    readiness: 'released',
    description: 'Estimate tax liability for different countries',
    lastUpdated: new Date(),
  },
  {
    name: 'Advanced Reports',
    key: 'advancedReports',
    readiness: 'beta',
    description: 'Enhanced analytics and custom report generation',
    lastUpdated: new Date(),
  },
  {
    name: 'AI Insights',
    key: 'aiInsights',
    readiness: 'unreleased',
    description: 'AI-powered spending insights and recommendations',
    lastUpdated: new Date(),
  },
];

export const AdminFeaturePanel: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { role, user } = useAuth();
  const [features, setFeatures] = useState<FeatureControl[]>(FEATURES);

  // Only allow admin access
  if (role !== 'admin') {
    return (
      <CenteredLayout>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">Only administrators can access this panel</p>
        </div>
      </CenteredLayout>
    );
  }

  const handleToggleFeature = (key: string, newReadiness: FeatureControl['readiness']) => {
    setFeatures(
      features.map((f) =>
        f.key === key
          ? { ...f, readiness: newReadiness, lastUpdated: new Date() }
          : f
      )
    );
    toast.success(`Feature "${key}" updated to "${newReadiness}"`);
  };

  const getReadinessBadgeColor = (readiness: FeatureControl['readiness']) => {
    switch (readiness) {
      case 'unreleased':
        return 'bg-gray-100 text-gray-700';
      case 'beta':
        return 'bg-blue-100 text-blue-700';
      case 'released':
        return 'bg-green-100 text-green-700';
      case 'deprecated':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gray-50 lg:bg-transparent">
      <div className="max-w-[1400px] mx-auto pb-32 lg:pb-24 w-full">
        <div className="px-4 lg:px-8 pt-6 lg:pt-10 pb-4 lg:pb-6">
          <PageHeader 
            title="Admin Panel" 
            subtitle="Feature flags & access control" 
            icon={<Shield size={20} className="sm:w-6 sm:h-6" />} 
          />
        </div>
        <div className="px-4 lg:px-8 space-y-6">
          {/* Admin Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
            <p className="text-purple-900">
              <span className="font-semibold">Logged in as:</span> {user?.email}
            </p>
            <p className="text-purple-700 mt-2 text-sm">
              You can control feature visibility across all user roles from this panel.
            </p>
          </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                  <p className="text-gray-600 text-sm mt-1">{feature.description}</p>
                </div>
                <Settings size={20} className="text-gray-400" />
              </div>

              {/* Readiness Status */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Readiness Status
                </label>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getReadinessBadgeColor(feature.readiness)}`}>
                  {feature.readiness.toUpperCase()}
                </span>
              </div>

              {/* Status Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['unreleased', 'beta', 'released', 'deprecated'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleToggleFeature(feature.key, status)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      feature.readiness === status
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'unreleased' ? '🔒 Unreleased' : ''}
                    {status === 'beta' ? '🧪 Beta' : ''}
                    {status === 'released' ? '✅ Released' : ''}
                    {status === 'deprecated' ? '⚠️ Deprecated' : ''}
                  </button>
                ))}
              </div>

              {/* Last Updated */}
              <p className="text-xs text-gray-500">
                Last updated: {feature.lastUpdated.toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Feature Readiness Guide */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Feature Readiness Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900 mb-1">🔒 Unreleased</p>
              <p className="text-gray-600">Only visible to admin for testing</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">🧪 Beta</p>
              <p className="text-gray-600">Visible to admin and advisors for feedback</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">✅ Released</p>
              <p className="text-gray-600">Available to all users</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">⚠️ Deprecated</p>
              <p className="text-gray-600">Hidden from all users, scheduled for removal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default AdminFeaturePanel;
