import React, { useState } from 'react';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';

interface OnboardingCompleteStepProps {
  data: {
    displayName: string;
    dateOfBirth: string;
    jobType: string;
    salary: string;
    bankName: string;
    accountHolderName: string;
    currentBalance: string;
    country: string;
    language: string;
    avatarUrl?: string;
  };
  onComplete: () => void;
  onBack: () => void;
}

export const OnboardingCompleteStep: React.FC<OnboardingCompleteStepProps> = ({
  data,
  onComplete,
  onBack,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Only start processing when user clicks 'Complete Setup'
  const startProcessing = async () => {
    setIsProcessing(true);
    setError(null);

    // ── PERSIST TO LOCALSTORAGE FIRST (synchronous, before any await) ─────────
    // This guarantees profile data is saved even if Supabase calls fail with
    // AbortError, CORS issues, or network timeouts. Supabase is purely a cloud
    // backup — the source of truth for this session is localStorage.
    const nowIso = new Date().toISOString();
    const nameParts = data.displayName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const userProfile = {
      displayName: data.displayName,
      firstName,
      lastName,
      dateOfBirth: data.dateOfBirth,
      jobType: data.jobType,
      salary: data.salary,
      monthlyIncome: Math.round(parseFloat(data.salary) / 12),
      country: data.country,
      language: data.language,
      profilePhoto: data.avatarUrl || '',
      avatarUrl: data.avatarUrl || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    localStorage.setItem('user_profile', JSON.stringify(userProfile));
    localStorage.setItem('profile_updated_at', nowIso);
    localStorage.setItem('profile_sync_pending', 'true');

    const userSettings = {
      defaultCurrency: 'INR',
      monthlyBudget: Math.round(parseFloat(data.salary) / 12),
      language: data.language,
      country: data.country
    };
    localStorage.setItem('user_settings', JSON.stringify(userSettings));
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('user_setup_date', new Date().toISOString());

    try {
      // Step 1: Try to save profile to Supabase (non-blocking — localStorage is the backup)
      setProgress(15);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const nameParts = data.displayName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          const profileData = {
            id: user.id,
            email: user.email,
            full_name: data.displayName,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: data.dateOfBirth || null,
            job_type: data.jobType?.toLowerCase() || null,
            annual_income: parseFloat(data.salary) || null,
            monthly_income: Math.round(parseFloat(data.salary) / 12) || null,
            avatar_url: data.avatarUrl || null,
            updated_at: new Date().toISOString(),
          };
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' });
          if (profileError) {
            console.warn('Full profile save failed, trying base columns:', profileError.message);
            const baseProfile = {
              id: user.id,
              email: user.email,
              full_name: data.displayName,
              updated_at: new Date().toISOString(),
            };
            const { error: baseError } = await supabase
              .from('profiles')
              .upsert(baseProfile, { onConflict: 'id' });
            if (baseError) {
              console.warn('Base profile save also failed (localStorage is the backup):', baseError.message);
            } else {
              localStorage.removeItem('profile_sync_pending');
            }
          } else {
            localStorage.removeItem('profile_sync_pending');
          }
        }
      } catch (supabaseError) {
        // AbortError / CORS / network timeout — non-critical, localStorage already saved
        console.warn('Supabase profile save skipped (non-blocking):', supabaseError);
      }
      // Step 2: Create initial account entry in Dexie database
      setProgress(35);
      const accountData = {
        name: `${data.bankName} - ${data.accountHolderName}`,
        type: 'bank' as const,
        balance: parseFloat(data.currentBalance) || 0,
        currency: 'INR',
        isActive: true,
        createdAt: new Date(),
      };
      const savedAccount = await saveAccountWithBackendSync(accountData);
      const accountId = savedAccount.id!;
      console.log('Created account with ID:', accountId);
      // Step 3 (Removed Salary Template)
      setProgress(55);

      // Step 4: Mark onboarding as complete (re-affirm in case top-level write was skipped)
      setProgress(75);
      // Step 5: Dispatch ONBOARDING_COMPLETED event for global state update
      setProgress(90);
      window.dispatchEvent(new CustomEvent('ONBOARDING_COMPLETED', {
        detail: {
          profile: userProfile,
          account: { ...accountData, id: accountId },
        },
      }));
      // Step 6: Force refresh of all components by updating localStorage timestamp
      localStorage.setItem('onboarding_refresh_timestamp', Date.now().toString());
      // Step 7: Final processing
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Account setup complete!');
      onComplete();
    } catch (err) {
      console.error('Onboarding completion failed:', err);
      setError(err instanceof Error ? err.message : 'Setup failed');
      setIsProcessing(false);
    }
  };

  const retrySetup = () => {
    setProgress(0);
    startProcessing();
  };

  if (error) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">
            Setup Failed
          </h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back
          </button>
          <button
            onClick={retrySetup}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Setting Up Your Account
        </h3>
        <p className="text-sm text-gray-600">
          We're configuring your profile and setting up your accounts. This will only take a moment.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            {progress < 15 && 'Initializing...'}
            {progress >= 15 && progress < 35 && 'Saving your profile...'}
            {progress >= 35 && progress < 55 && 'Creating bank account...'}
            {progress >= 55 && progress < 75 && 'Setting up salary tracking...'}
            {progress >= 75 && progress < 90 && 'Finalizing setup...'}
            {progress >= 90 && progress < 100 && 'Completing...'}
            {progress === 100 && 'Setup complete!'}
          </span>
          <span>{progress}%</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Summary of what's being set up */}
      <div className="bg-gray-50 rounded-lg p-4 text-left">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Setting up:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>✓ Profile: {data.displayName}</li>
          <li>✓ Location: {data.country} ({data.language})</li>
          <li>✓ Job: {data.jobType}</li>
          <li>✓ Salary: ₹{parseFloat(data.salary).toLocaleString()}/year</li>
          <li>✓ Bank: {data.bankName} account</li>
          {data.currentBalance && (
            <li>✓ Current Balance: ₹{parseFloat(data.currentBalance).toLocaleString()}</li>
          )}
        </ul>
      </div>

      {/* Success Message */}
      {progress === 100 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-green-800 mb-2">
            All Set! 🎉
          </h3>
          <p className="text-green-700 text-sm">
            Your account is ready. You'll be redirected to your dashboard shortly.
          </p>
        </div>
      )}

      {/* Loading Spinner */}
      {isProcessing && progress < 100 && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {!isProcessing && progress === 0 && (
          <button
            onClick={startProcessing}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Complete Setup
          </button>
        )}
      </div>
    </div>
  );
};
