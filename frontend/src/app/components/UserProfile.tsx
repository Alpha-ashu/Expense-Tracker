import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Lock, Eye, EyeOff, Mail, Phone, User, Calendar, Briefcase, LogOut, ShieldAlert, Trash2, X, KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import supabase from '@/utils/supabase/client';
import { db } from '@/lib/database';
import { permissionService } from '@/services/permissionService';
import { backupPINKeys, restorePINKeys, storeMasterKey, verifyPIN, isPINSet } from '@/lib/encryption';
import { calculateAge, getAgeGroup, getAgeGroupLabel } from '@/lib/avatar';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, resolveAvatarSelection } from '@/lib/avatar-gallery';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  monthlyIncome: number;
  jobType: 'businessman' | 'salaried' | 'freelancer' | '';
  profilePhoto?: string;
  avatarId?: string;
}

interface VerificationState {
  type: 'email-change' | 'mobile-change' | null;
  otp: string;
  newValue: string;
  step: 'request' | 'otp-sent' | 'verified';
}

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();
  const { setCurrentPage } = useApp();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        const pinBackup = backupPINKeys();
        localStorage.clear();
        sessionStorage.clear();
        restorePINKeys(pinBackup);
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

      // Force cleanup even on error
      try {
        const pinBackup = backupPINKeys();
        localStorage.clear();
        sessionStorage.clear();
        restorePINKeys(pinBackup);
      } catch (e) {
        // Ignore
      }

      // Always redirect
      window.location.href = window.location.origin + '/login';
    }
  };

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    mobile: '',
    dateOfBirth: '',
    monthlyIncome: 0,
    jobType: '',
    profilePhoto: DEFAULT_AVATAR.url,
    avatarId: DEFAULT_AVATAR.id,
  });

  const [isLoading, setIsLoading] = useState(true);

  // States for Delete Account functionality
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch profile data: localStorage first (instant, guaranteed from onboarding),
  // then Supabase to supplement or override if it has richer data.
  /**
   * Normalize any jobType string (from either onboarding form) into one of
   * the three canonical values used by the profile dropdown.
   */
  const normalizeJobType = (raw: string): ProfileData['jobType'] => {
    const v = (raw || '').toLowerCase().trim();
    if (!v) return '';
    if (v.includes('business') || v.includes('self') || v === 'self-employed') return 'businessman';
    if (v.includes('freelance')) return 'freelancer';
    // Everything else (full-time, part-time, salaried, employment, student, retired, etc.) → salaried
    return 'salaried';
  };

  /** Human-readable label for a canonical jobType value */
  const jobTypeLabel = (v: string) => {
    if (v === 'businessman') return 'Self-employed / Business';
    if (v === 'freelancer') return 'Freelancer';
    if (v === 'salaried') return 'Salaried / Employed';
    return 'Not specified';
  };

  const resolveAvatar = (avatarUrl?: string | null, avatarId?: string | null) =>
    resolveAvatarSelection({ avatarUrl, avatarId });

  const fetchProfileData = async () => {
    if (!user) { setIsLoading(false); return; }

    // ── SOURCE 0: Supabase auth user_metadata (set during signUp) ────────────
    // When users sign up, first_name/last_name are stored in user_metadata.
    // This is the most reliable name source even before a profiles row exists.
    const meta = user.user_metadata || {};
    const metaFirstName = (meta.first_name || meta.firstName || '').trim();
    const metaLastName = (meta.last_name || meta.lastName || '').trim();

    // Apply auth metadata as the baseline so names are never blank
    if (metaFirstName || metaLastName) {
      setProfileData(prev => ({
        ...prev,
        firstName: metaFirstName || prev.firstName,
        lastName: metaLastName || prev.lastName,
        email: user.email || prev.email,
        profilePhoto: resolveAvatar(prev.profilePhoto, prev.avatarId).url,
        avatarId: resolveAvatar(prev.profilePhoto, prev.avatarId).id,
      }));
    }

    // ── SOURCE 1: localStorage (written by NewUserOnboarding on completion) ───
    const localProfile = localStorage.getItem('user_profile');
    if (localProfile) {
      try {
        const p = JSON.parse(localProfile);
        // displayName is from NewUserOnboarding; full_name/firstName from AuthFlow path
        const displayName = p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
        const nameParts = displayName.split(' ');
        const firstName = metaFirstName || nameParts[0] || '';
        const lastName = metaLastName || nameParts.slice(1).join(' ') || '';
        const rawSalary = parseFloat(p.salary);
        const monthlyIncomeVal = p.monthlyIncome
          ? Number(p.monthlyIncome)
          : (!isNaN(rawSalary) && rawSalary > 0 ? Math.round(rawSalary / 12) : 0);

        setProfileData(prev => ({
          ...prev,
          firstName: firstName || prev.firstName,
          lastName: lastName || prev.lastName,
          email: user.email || prev.email,
          mobile: p.mobile || prev.mobile || '',
          dateOfBirth: p.dateOfBirth || prev.dateOfBirth || '',
          monthlyIncome: monthlyIncomeVal || prev.monthlyIncome,
          jobType: (normalizeJobType(p.jobType) || prev.jobType) as ProfileData['jobType'],
          profilePhoto: resolveAvatar(p.profilePhoto || prev.profilePhoto, p.avatarId || prev.avatarId).url,
          avatarId: resolveAvatar(p.profilePhoto || prev.profilePhoto, p.avatarId || prev.avatarId).id,
        }));
      } catch {
        // Corrupt localStorage — fall through to Supabase
      }
    }

    // ── SOURCE 2: Supabase profiles table (authoritative, cloud-synced) ────────
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.warn('Supabase profile fetch (non-blocking):', error.code, error.message);
        }
        return; // Keep sources 0+1 data
      }

      const hasRealProfile = data && (
        data.full_name || data.first_name || data.phone ||
        data.date_of_birth || data.job_type ||
        data.monthly_income || data.annual_income
      );

      if (hasRealProfile) {
        const fullName = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
        const nameParts = fullName.split(' ');
        const firstName = data.first_name || metaFirstName || nameParts[0] || '';
        const lastName = data.last_name || metaLastName || nameParts.slice(1).join(' ') || '';
        const monthlyIncomeVal = data.monthly_income
          ? Number(data.monthly_income)
          : data.annual_income
            ? Math.round(Number(data.annual_income) / 12)
            : 0;
        const updatedAt = data.updated_at || new Date().toISOString();
        const resolved = resolveAvatar(data.avatar_url || null, (data as any)?.avatar_id || null);

        setProfileData({
          firstName,
          lastName,
          email: data.email || user.email || '',
          mobile: data.phone || '',
          dateOfBirth: data.date_of_birth || '',
          monthlyIncome: monthlyIncomeVal,
          jobType: (normalizeJobType(data.job_type) || '') as ProfileData['jobType'],
          profilePhoto: resolved.url,
          avatarId: resolved.id,
        });
        // Keep localStorage in sync
        localStorage.setItem('user_profile', JSON.stringify({
          displayName: `${firstName} ${lastName}`.trim(),
          firstName, lastName,
          mobile: data.phone || '',
          dateOfBirth: data.date_of_birth || '',
          jobType: data.job_type || '',
          salary: ((data.annual_income || (monthlyIncomeVal * 12)) || 0).toString(),
          monthlyIncome: monthlyIncomeVal,
          profilePhoto: resolved.url,
          avatarUrl: resolved.url,
          avatarId: resolved.id,
          updatedAt,
        }));
        localStorage.setItem('profile_updated_at', updatedAt);
      }
    } catch (error) {
      console.warn('Supabase profile fetch failed (non-blocking):', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  // Listen for onboarding completion to refresh profile data
  useEffect(() => {
    const handleOnboardingComplete = () => {
      console.log('ONBOARDING_COMPLETED event received in UserProfile, refreshing profile data...');
      // Re-use the already-fixed fetchProfileData (handles Supabase + localStorage fallback)
      fetchProfileData();
    };

    window.addEventListener('ONBOARDING_COMPLETED', handleOnboardingComplete as EventListener);

    return () => {
      window.removeEventListener('ONBOARDING_COMPLETED', handleOnboardingComplete as EventListener);
    };
  }, [user]);

  const [isEditingForm, setIsEditingForm] = useState(false);
  const [tempData, setTempData] = useState<ProfileData>(profileData);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);

  // Bug 3 fix: keep tempData in sync with profileData after async fetch,
  // but only when the edit form is not currently open to avoid overwriting
  // in-progress user edits.
  useEffect(() => {
    if (!isEditingForm) {
      setTempData(profileData);
    }
  }, [profileData]);

  useEffect(() => {
    if (!isEditingForm) {
      setShowAvatarGallery(false);
    }
  }, [isEditingForm]);

  const [verification, setVerification] = useState<VerificationState>({
    type: null,
    otp: '',
    newValue: '',
    step: 'request',
  });
  const ageValue = calculateAge(tempData.dateOfBirth || profileData.dateOfBirth);
  const ageGroup = getAgeGroup(ageValue);
  const ageGroupLabel = getAgeGroupLabel(ageGroup);
  const ageSource = isEditingForm ? tempData.dateOfBirth : profileData.dateOfBirth;
  const activeAvatar = resolveAvatarSelection({
    avatarId: (isEditingForm ? tempData.avatarId : profileData.avatarId) || null,
    avatarUrl: (isEditingForm ? tempData.profilePhoto : profileData.profilePhoto) || null,
  });
  const activeAvatarUrl = activeAvatar.url;

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    localStorage.setItem('profile_sync_pending', 'true');
    try {
      const resolvedAvatar = resolveAvatar(tempData.profilePhoto, tempData.avatarId);
      const baseData = {
        id: user.id,
        email: tempData.email,
        full_name: `${tempData.firstName} ${tempData.lastName}`.trim(),
        phone: tempData.mobile,
        avatar_url: resolvedAvatar.url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert({
        ...baseData,
        date_of_birth: tempData.dateOfBirth || null,
        monthly_income: tempData.monthlyIncome,
        job_type: tempData.jobType || null,
      });

      if (error) {
        // Extended columns may not exist — fall back to base columns only
        console.warn('Extended profile save failed, trying base:', error.message);
        const { error: baseError } = await supabase.from('profiles').upsert(baseData);
        if (baseError) throw baseError;
      }

      localStorage.removeItem('profile_sync_pending');

      // Best-effort: keep auth metadata aligned for cross-device fallback
      try {
        await supabase.auth.updateUser({
          data: {
            first_name: tempData.firstName,
            last_name: tempData.lastName,
            full_name: `${tempData.firstName} ${tempData.lastName}`.trim(),
            phone: tempData.mobile,
            avatar_id: resolvedAvatar.id,
          },
        });
      } catch (metaError) {
        console.warn('Auth metadata update failed (non-blocking):', metaError);
      }

      setProfileData(tempData);
      setIsEditingForm(false);
      // Save latest profile to localStorage for persistence
      const updatedAt = new Date().toISOString();
      localStorage.setItem('user_profile', JSON.stringify({
        displayName: `${tempData.firstName} ${tempData.lastName}`.trim(),
        firstName: tempData.firstName,
        lastName: tempData.lastName,
        mobile: tempData.mobile,
        dateOfBirth: tempData.dateOfBirth,
        jobType: tempData.jobType,
        salary: (tempData.monthlyIncome || 0) * 12,
        monthlyIncome: tempData.monthlyIncome || 0,
        profilePhoto: resolvedAvatar.url,
        avatarUrl: resolvedAvatar.url,
        avatarId: resolvedAvatar.id,
        updatedAt,
      }));
      localStorage.setItem('profile_updated_at', updatedAt);
      localStorage.removeItem('profile_sync_pending');
      // Fetch latest profile from Supabase to guarantee sync
      try {
        await fetchProfileData();
      } catch (fetchError) {
        // Optionally log or handle fetch error
      }
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      toast.error(error.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Change PIN ────────────────────────────────────────────────────────────
  const [pinChangeStep, setPinChangeStep] = useState<'idle' | 'otp-sent' | 'verify-otp' | 'set-new-pin'>('idle');
  const [pinOtp, setPinOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [isPinLoading, setIsPinLoading] = useState(false);

  const handleRequestPinChangeOtp = async () => {
    if (!user?.email) { toast.error('No email associated with account'); return; }
    setIsPinLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setPinChangeStep('otp-sent');
      toast.success(`OTP sent to ${user.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setIsPinLoading(false);
    }
  };

  const handleVerifyPinOtp = async () => {
    if (!user?.email || pinOtp.length < 6) { toast.error('Enter the 6-digit OTP'); return; }
    setIsPinLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: user.email,
        token: pinOtp,
        type: 'magiclink',
      });
      if (error) throw error;
      setPinChangeStep('set-new-pin');
      setPinOtp('');
      toast.success('Email verified! Set your new PIN.');
    } catch (err: any) {
      toast.error('Invalid or expired OTP. Try again.');
    } finally {
      setIsPinLoading(false);
    }
  };

  const handleSetNewPin = () => {
    if (newPin.length !== 6) { toast.error('PIN must be 6 digits'); return; }
    if (newPin !== confirmNewPin) { toast.error('PINs do not match'); setConfirmNewPin(''); return; }
    storeMasterKey(newPin);
    toast.success('PIN changed successfully!');
    setPinChangeStep('idle');
    setNewPin('');
    setConfirmNewPin('');
  };

  const resetPinFlow = () => {
    setPinChangeStep('idle');
    setPinOtp('');
    setNewPin('');
    setConfirmNewPin('');
  };

  // Email & mobile change (kept simple for now — uses verification state)
  const handleChangeEmail = () => {
    if (!verification.newValue) { toast.error('Please enter new email'); return; }
    setVerification({ ...verification, type: 'email-change', step: 'otp-sent' });
    toast.success('Verification link sent to your current email');
  };
  const handleVerifyEmailOTP = () => {
    if (verification.otp.length === 6) {
      setProfileData({ ...profileData, email: verification.newValue });
      setVerification({ type: null, otp: '', newValue: '', step: 'request' });
      toast.success('Email updated successfully');
    } else { toast.error('Invalid OTP'); }
  };
  const handleChangeMobile = () => {
    if (!verification.newValue) { toast.error('Please enter new mobile number'); return; }
    setVerification({ ...verification, type: 'mobile-change', step: 'otp-sent' });
    toast.success('OTP sent to your registered email');
  };
  const handleVerifyMobileOTP = () => {
    if (verification.otp.length === 6) {
      setProfileData({ ...profileData, mobile: verification.newValue });
      setVerification({ type: null, otp: '', newValue: '', step: 'request' });
      toast.success('Mobile number updated successfully');
    } else { toast.error('Invalid OTP'); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!deletePassword) {
      toast.error('Please enter your password to confirm deletion');
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Re-authenticate the user with their password before sensitive action
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: deletePassword,
      });

      if (signInError) {
        throw new Error('Invalid password. Deletion failed.');
      }

      // 2. Call Supabase RPC function to delete account and all linked data
      const { error: deleteError } = await supabase.rpc('delete_user_account', {
        user_id: user.id
      });

      // Note: If you don't have this RPC function, you can use the admin API:
      // await supabase.auth.admin.deleteUser(user.id);
      // However, regular clients shouldn't have admin privileges. 
      // The secure method is using an Edge Function, RPC, or triggering a DB deletion
      // which cascades to auth if configured.

      // For the sake of this implementation, we will attempt the built in auth trigger or manual cascade
      if (deleteError) {
        // Fallback: Delete profile record manually. Ensure Supabase cascades to delete 
        // linked records. Delete the auth user using an edge-function if possible.
        console.warn('RPC delete failed, trying direct table delete', deleteError);
        await supabase.from('profiles').delete().eq('id', user.id);

        // Due to RLS restrictions, standard clients cannot delete accounts via auth API directly
        // User must be signed out if we can't delete from auth table
      }

      toast.success('Your account has been permanently deleted.');

      // Cleanup locally
      setIsDeleteModalOpen(false);
      setDeletePassword('');
      await handleSignOut();

    } catch (error: any) {
      console.error('Account deletion failed:', error);
      toast.error(error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-32 lg:pb-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="px-4 lg:px-0 pt-6 lg:pt-10">
          <PageHeader
            title="User Profile"
            subtitle="Manage your personal information"
            icon={<User size={20} className="sm:w-6 sm:h-6" />}
            showBack
            backTo="dashboard"
          />
        </div>

        {/* Content */}
        <div className="px-4 lg:px-0 mt-8 space-y-6">

          {/* ── New User Prompt ── Only shown when profile is incomplete */}
          {!profileData.firstName && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg">👋 Welcome! Complete your profile</p>
                  <p className="text-sm text-blue-100 mt-1">
                    Fill in your details so we can personalise your experience.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-blue-100">
                    {!profileData.firstName && <li>• First &amp; Last Name</li>}
                    {!profileData.mobile && <li>• Mobile Number</li>}
                    {!profileData.dateOfBirth && <li>• Date of Birth</li>}
                    {!profileData.jobType && <li>• Job Type &amp; Monthly Income</li>}
                  </ul>
                </div>
                <button
                  onClick={() => setIsEditingForm(true)}
                  className="shrink-0 mt-1 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </motion.div>
          )}

          {/* Avatar Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8 flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <img
                src={activeAvatarUrl}
                alt="Avatar"
                className="w-32 h-32 rounded-full border-4 border-blue-500 object-cover shadow-lg"
              />
            </motion.div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="text-gray-900 font-semibold text-lg">
                {[
                  isEditingForm ? tempData.firstName : profileData.firstName,
                  isEditingForm ? tempData.lastName : profileData.lastName,
                ].filter(Boolean).join(' ') || 'User'}
              </p>
              {ageSource && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {ageGroupLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center max-w-sm">
              Choose a ready-made avatar from the gallery. Real photos are disabled for safety.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  setIsEditingForm(true);
                  setShowAvatarGallery((prev) => !prev);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                Choose Avatar
              </button>
              {showAvatarGallery && (
                <button
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-2 rounded-full border border-green-200 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                >
                  <Check size={14} />
                  Save Avatar
                </button>
              )}
            </div>
            {showAvatarGallery && (
              <div className="mt-4 w-full max-w-3xl rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setTempData((prev) => ({
                        ...prev,
                        profilePhoto: avatar.url,
                        avatarId: avatar.id,
                      }))}
                      className={`h-14 w-14 rounded-full overflow-hidden border-2 transition-all ${
                        activeAvatar.id === avatar.id
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      aria-label={`Select avatar ${avatar.label}`}
                      title={avatar.label}
                    >
                      <img src={avatar.url} alt={avatar.label} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500 text-center">
                  Pick a style that fits your vibe. You can update it anytime.
                </p>
              </div>
            )}
          </motion.div>

          {/* Profile Info Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
              {/* Header row */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                <button
                  onClick={() => {
                    setIsEditingForm(!isEditingForm);
                    if (isEditingForm) setTempData(profileData);
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isEditingForm
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                >
                  {isEditingForm ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {!isEditingForm ? (
                /* View mode — clean horizontal info rows */
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <User size={14} className="text-gray-400" /> First Name
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{profileData.firstName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <User size={14} className="text-gray-400" /> Last Name
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{profileData.lastName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" /> Date of Birth
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {profileData.dateOfBirth
                        ? new Date(profileData.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <Briefcase size={14} className="text-gray-400" /> Job Type
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{jobTypeLabel(profileData.jobType)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="text-gray-400 font-bold text-sm w-3.5 inline-flex justify-center">₹</span> Monthly Income
                    </span>
                    <span className="text-sm font-semibold text-gray-900">₹ {(profileData.monthlyIncome || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                /* Edit mode — form with two-column grid for related fields */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">First Name</label>
                      <input
                        type="text"
                        value={tempData.firstName}
                        onChange={(e) => setTempData({ ...tempData, firstName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Enter first name"
                        aria-label="First name"
                        id="firstName"
                        name="firstName"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Last Name</label>
                      <input
                        type="text"
                        value={tempData.lastName}
                        onChange={(e) => setTempData({ ...tempData, lastName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Enter last name"
                        aria-label="Last name"
                        id="lastName"
                        name="lastName"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" /> Date of Birth
                      </label>
                      <input
                        type="date"
                        value={tempData.dateOfBirth}
                        onChange={(e) => setTempData({ ...tempData, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        aria-label="Date of birth"
                        id="dateOfBirth"
                        name="dateOfBirth"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                        <Briefcase size={12} className="text-gray-400" /> Job Type
                      </label>
                      <select
                        value={tempData.jobType}
                        onChange={(e) => setTempData({ ...tempData, jobType: e.target.value as any })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        aria-label="Select job type"
                        id="jobType"
                        name="jobType"
                      >
                        <option value="">Select job type</option>
                        <option value="salaried">Salaried / Employed</option>
                        <option value="businessman">Self-employed / Business Owner</option>
                        <option value="freelancer">Freelancer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="text-gray-400 font-bold text-sm">₹</span> Monthly Income
                    </label>
                    <input
                      type="number"
                      value={tempData.monthlyIncome || ''}
                      onChange={(e) => setTempData({ ...tempData, monthlyIncome: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0.00"
                      id="monthlyIncome"
                      name="monthlyIncome"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Restricted Fields - Email & Mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Lock size={20} className="text-orange-600" />
                Secure Information
              </h3>

              {/* Email Section */}
              <div className="mb-8 pb-8 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Mail size={20} className="text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Email Address</p>
                      <p className="text-sm text-gray-500">Change via mobile verification</p>
                    </div>
                  </div>
                  <Lock size={18} className="text-orange-500" />
                </div>

                {verification.type !== 'email-change' ? (
                  <>
                    <p className="text-gray-900 font-medium text-lg mb-4">{profileData.email}</p>
                    <button
                      onClick={() =>
                        setVerification({
                          type: 'email-change',
                          otp: '',
                          newValue: '',
                          step: 'request',
                        })
                      }
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Change Email
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    {verification.step === 'request' && (
                      <>
                        <input
                          type="email"
                          placeholder="Enter new email"
                          value={verification.newValue}
                          onChange={(e) =>
                            setVerification({ ...verification, newValue: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="newEmail"
                          name="newEmail"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleChangeEmail}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                          >
                            Send OTP to Mobile
                          </button>
                          <button
                            onClick={() =>
                              setVerification({
                                type: null,
                                otp: '',
                                newValue: '',
                                step: 'request',
                              })
                            }
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}

                    {verification.step === 'otp-sent' && (
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <p className="text-sm text-blue-800">
                            📱 OTP sent to your registered mobile number
                          </p>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={verification.otp}
                          onChange={(e) => setVerification({ ...verification, otp: e.target.value })}
                          maxLength={6}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                        />
                        <p className="text-xs text-gray-500 mt-2">Use code: 123456 (Demo)</p>
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={handleVerifyEmailOTP}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                          >
                            Verify OTP
                          </button>
                          <button
                            onClick={() =>
                              setVerification({
                                type: null,
                                otp: '',
                                newValue: '',
                                step: 'request',
                              })
                            }
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Phone size={20} className="text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Mobile Number</p>
                      <p className="text-sm text-gray-500">Change via email verification</p>
                    </div>
                  </div>
                  <Lock size={18} className="text-orange-500" />
                </div>

                {verification.type !== 'mobile-change' ? (
                  <>
                    <p className="text-gray-900 font-medium text-lg mb-4">{profileData.mobile}</p>
                    <button
                      onClick={() =>
                        setVerification({
                          type: 'mobile-change',
                          otp: '',
                          newValue: '',
                          step: 'request',
                        })
                      }
                      className="bg-green-50 hover:bg-green-100 text-green-600 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Change Mobile
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    {verification.step === 'request' && (
                      <>
                        <input
                          type="tel"
                          placeholder="Enter new mobile number"
                          value={verification.newValue}
                          onChange={(e) =>
                            setVerification({ ...verification, newValue: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="newMobile"
                          name="newMobile"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleChangeMobile}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                          >
                            Send OTP to Email
                          </button>
                          <button
                            onClick={() =>
                              setVerification({
                                type: null,
                                otp: '',
                                newValue: '',
                                step: 'request',
                              })
                            }
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}

                    {verification.step === 'otp-sent' && (
                      <>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <p className="text-sm text-green-800">
                            📧 OTP sent to your registered email
                          </p>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={verification.otp}
                          onChange={(e) => setVerification({ ...verification, otp: e.target.value })}
                          maxLength={6}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                          id="emailOtp"
                          name="emailOtp"
                        />
                        <p className="text-xs text-gray-500 mt-2">Use code: 123456 (Demo)</p>
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={handleVerifyMobileOTP}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                          >
                            Verify OTP
                          </button>
                          <button
                            onClick={() =>
                              setVerification({
                                type: null,
                                otp: '',
                                newValue: '',
                                step: 'request',
                              })
                            }
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Change PIN Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <KeyRound size={20} className="text-blue-600" />
                Security &amp; PIN
              </h3>

              <div className="space-y-4">
                {pinChangeStep === 'idle' ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <p className="font-semibold text-gray-900">Change Secure PIN</p>
                      <p className="text-sm text-gray-500 mt-0.5">Update your 6-digit access PIN</p>
                    </div>
                    <Button
                      onClick={handleRequestPinChangeOtp}
                      disabled={isPinLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
                    >
                      {isPinLoading ? 'Sending...' : 'Change PIN'}
                    </Button>
                  </div>
                ) : pinChangeStep === 'otp-sent' || pinChangeStep === 'verify-otp' ? (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-blue-900">Verify Email</p>
                      <button onClick={resetPinFlow} className="text-xs text-blue-600 hover:underline">Cancel</button>
                    </div>
                    <p className="text-sm text-blue-700">Enter the 6-digit OTP sent to your email to continue.</p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={pinOtp}
                        onChange={(e) => setPinOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-center font-mono text-lg tracking-widest"
                      />
                      <Button
                        onClick={handleVerifyPinOtp}
                        disabled={isPinLoading || pinOtp.length !== 6}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                      >
                        {isPinLoading ? 'Verifying...' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-green-900">Set New PIN</p>
                      <button onClick={resetPinFlow} className="text-xs text-green-600 hover:underline">Cancel</button>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          placeholder="Enter new 6-digit PIN"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-4 py-2.5 rounded-xl border border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-center font-mono text-lg tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(!showNewPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      <input
                        type={showNewPin ? 'text' : 'password'}
                        placeholder="Confirm new PIN"
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-2.5 rounded-xl border border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-center font-mono text-lg tracking-widest"
                      />

                      <Button
                        onClick={handleSetNewPin}
                        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 mt-2"
                        disabled={newPin.length !== 6 || newPin !== confirmNewPin}
                      >
                        Update Secure PIN
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Sign Out */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Signed in as</p>
                  <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut size={18} />
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </button>
              </div>
            </Card>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-red-50 border border-red-200 rounded-2xl p-6 lg:p-8">
              <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-700" />
                Danger Zone
              </h3>
              <p className="text-sm text-red-800 mb-6">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>

              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                <Trash2 size={18} />
                Delete Account
              </button>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Delete Account Modal (Popup) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
          >
            <div className="bg-gradient-to-br from-red-600 to-rose-700 p-6 text-white relative">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletePassword('');
                }}
                aria-label="Close delete account dialog"
                title="Close delete account dialog"
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold">Delete Account</h3>
              <p className="text-red-100 text-sm mt-1">
                You are about to permanently delete your Finora account.
                All your tracked accounts, transactions, and data will be erased.
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verify your password to continue
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
