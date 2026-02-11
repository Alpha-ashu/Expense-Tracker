/**
 * Example of proper role-based access control implementation
 * Shows how to use the new backend-driven permission system
 */

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  usePermissions, 
  useFeatureAccess, 
  useAdminOnly, 
  useAdvisorOnly 
} from '@/hooks/usePermissions';
import { 
  FeatureVisibility, 
  AdminOnly, 
  AdvisorOnly, 
  RoleBased 
} from '@/components/ui/FeatureVisibility';

export const RoleBasedAccessExample: React.FC = () => {
  const { 
    permissions, 
    loading, 
    role, 
    allowedFeatures,
    isAdmin,
    isAdvisor,
    isUser 
  } = usePermissions();
  const { user } = useAuth();

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Current User Info */}
      <div className="bg-card-bg p-4 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Current User Role</h3>
        <div className="space-y-2">
          <p><strong>Role:</strong> {role}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Features Allowed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            {allowedFeatures.map((feature, index) => (
              <li key={index} className="text-sm">
                ✅ {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Feature Visibility Examples */}
      <div className="bg-card-bg p-4 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Feature Visibility Examples</h3>
        
        {/* Example 1: Feature that only admins can see */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Admin Panel (Admins Only)</h4>
          <FeatureVisibility 
            feature="adminPanel" 
            role="admin"
            logAccess={true}
          >
            <div className="p-4 bg-green-100 rounded border-green-200">
              <h5 className="font-semibold text-green-800">🔐 Admin Dashboard</h5>
              <p className="text-sm text-green-700">Only visible to administrators</p>
            </div>
          </FeatureVisibility>
        </div>

        {/* Example 2: Feature for admins and advisors */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Advisor Panel (Admins + Advisors)</h4>
          <FeatureVisibility 
            feature="advisorPanel" 
            role={['admin', 'advisor']}
            logAccess={true}
          >
            <div className="p-4 bg-blue-100 rounded border-blue-200">
              <h5 className="font-semibold text-blue-800">👔 Advisor Workspace</h5>
              <p className="text-sm text-blue-700">Visible to administrators and advisors</p>
            </div>
          </FeatureVisibility>
        </div>

        {/* Example 3: Feature for all users */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Standard Features (All Users)</h4>
          <FeatureVisibility 
            feature="accounts"
            logAccess={true}
          >
            <div className="p-4 bg-gray-100 rounded border-gray-200">
              <h5 className="font-semibold text-gray-800">💳 Bank Accounts</h5>
              <p className="text-sm text-gray-700">Available to all users</p>
            </div>
          </FeatureVisibility>
        </div>

        {/* Example 4: Using role-based components */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Role-Based Components</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Admin-only content */}
            <AdminOnly fallback={
              <div className="p-4 bg-red-100 rounded border-red-200">
                <p className="text-red-700">❌ Admins only</p>
              </div>
            }>
              <div className="p-4 bg-green-100 rounded border-green-200">
                <h5 className="font-semibold text-green-800">🔐 Admin Controls</h5>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>✅ User Management</li>
                  <li>✅ Feature Control</li>
                  <li>✅ System Settings</li>
                </ul>
              </div>
            </AdminOnly>

            {/* Advisor-only content */}
            <AdvisorOnly fallback={
              <div className="p-4 bg-yellow-100 rounded border-yellow-200">
                <p className="text-yellow-700">❌ Advisors only</p>
              </div>
            }>
              <div className="p-4 bg-blue-100 rounded border-blue-200">
                <h5 className="font-semibold text-blue-800">👔 Advisor Tools</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✅ Availability Calendar</li>
                  <li>✅ Client Management</li>
                  <li>✅ Session History</li>
                </ul>
              </div>
            </AdvisorOnly>
          </div>
        </div>

        {/* Example 5: Conditional rendering based on multiple features */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Multiple Feature Check</h4>
          <div className="space-y-2">
            {useFeatureAccess('adminPanel') && useFeatureAccess('advisorPanel') && (
              <div className="p-4 bg-purple-100 rounded border-purple-200">
                <h5 className="font-semibold text-purple-800">🎯 Special Access</h5>
                <p className="text-sm text-purple-700">
                  User has both admin and advisor panel access
                </p>
              </div>
            )}
            
            {!useFeatureAccess('premiumFeature') && (
              <div className="p-4 bg-orange-100 rounded border-orange-200">
                <h5 className="font-semibold text-orange-800">💎 Premium Feature</h5>
                <p className="text-sm text-orange-700">
                  This feature requires premium access
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Example 6: Using RoleBased component */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Role-Based Rendering</h4>
          <RoleBased
            roles={{
              admin: (
                <div className="p-4 bg-red-100 rounded">
                  <h5 className="font-semibold text-red-800">Admin View</h5>
                  <p>Full system access and controls</p>
                </div>
              ),
              advisor: (
                <div className="p-4 bg-blue-100 rounded">
                  <h5 className="font-semibold text-blue-800">Advisor View</h5>
                  <p>Client management and scheduling tools</p>
                </div>
              ),
              user: (
                <div className="p-4 bg-gray-100 rounded">
                  <h5 className="font-semibold text-gray-800">User View</h5>
                  <p>Personal finance management tools</p>
                </div>
              )
            }}
          >
            <div className="p-4 bg-yellow-100 rounded">
              <h5 className="font-semibold text-yellow-800">Default View</h5>
              <p>Fallback content for unknown roles</p>
            </div>
          </RoleBased>
        </div>

        {/* Permission Debug Info */}
        <div className="bg-card-bg p-4 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Debug Information</h3>
          <div className="space-y-2 text-xs">
            <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
            <p><strong>Is Advisor:</strong> {isAdvisor ? 'Yes' : 'No'}</p>
            <p><strong>Is User:</strong> {isUser ? 'Yes' : 'No'}</p>
            <p><strong>Can Access Admin Panel:</strong> {useFeatureAccess('adminPanel') ? 'Yes' : 'No'}</p>
            <p><strong>Can Access Advisor Panel:</strong> {useFeatureAccess('advisorPanel') ? 'Yes' : 'No'}</p>
            <p><strong>Can Book Advisor:</strong> {useFeatureAccess('bookAdvisor') ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleBasedAccessExample;
