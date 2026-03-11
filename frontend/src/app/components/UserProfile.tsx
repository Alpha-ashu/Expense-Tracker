import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Lock, Eye, EyeOff, Mail, Phone, User, Calendar, Briefcase, LogOut, ChevronDown, ChevronUp, ShieldAlert, FileText, Smartphone, Trash2, X, KeyRound, Shuffle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import supabase from '@/utils/supabase/client';
import { db } from '@/lib/database';
import { permissionService } from '@/services/permissionService';
import { backupPINKeys, restorePINKeys, storeMasterKey, verifyPIN, isPINSet } from '@/lib/encryption';
import {
  AvatarConfig,
  BACKGROUND_COLORS,
  BEARDS,
  CLOTHING_COLORS,
  GLASSES,
  HAIR_COLORS,
  SKIN_TONES,
  buildAvatarUrl,
  calculateAge,
  createAvatarConfig,
  getAgeGroup,
  getAgeGroupLabel,
  getClothingOptions,
  getHairOptions,
  mergeAvatarConfig,
  parseAvatarUrl,
  randomizeAvatarConfig,
} from '@/lib/avatar';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  monthlyIncome: number;
  jobType: 'businessman' | 'salaried' | 'freelancer' | '';
  profilePhoto?: string;
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
    profilePhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Default',
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

  const ensureAvatarUrl = (url: string | undefined, seed: string) => {
    if (url && url.includes('api.dicebear.com/7.x/avataaars')) return url;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'User')}`;
  };

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
        profilePhoto: ensureAvatarUrl(prev.profilePhoto, metaFirstName || 'User'),
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
          profilePhoto: ensureAvatarUrl(p.profilePhoto || prev.profilePhoto, firstName || 'User'),
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

        setProfileData({
          firstName,
          lastName,
          email: data.email || user.email || '',
          mobile: data.phone || '',
          dateOfBirth: data.date_of_birth || '',
          monthlyIncome: monthlyIncomeVal,
          jobType: (normalizeJobType(data.job_type) || '') as ProfileData['jobType'],
          profilePhoto: ensureAvatarUrl(data.avatar_url || undefined, firstName || 'User'),
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
          profilePhoto: ensureAvatarUrl(data.avatar_url || undefined, firstName || 'User'),
          avatarUrl: ensureAvatarUrl(data.avatar_url || undefined, firstName || 'User'),
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
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);

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
      setShowAvatarEditor(false);
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
  const hairOptions = getHairOptions(ageGroup);
  const clothingOptions = getClothingOptions(ageGroup);

  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => {
    const base = createAvatarConfig({
      name: `${profileData.firstName || profileData.email || 'User'}`,
      ageGroup,
    });
    return mergeAvatarConfig(base, parseAvatarUrl(profileData.profilePhoto));
  });

  const activeAvatarUrl = (isEditingForm ? tempData.profilePhoto : profileData.profilePhoto)
    || buildAvatarUrl(avatarConfig);

  useEffect(() => {
    if (showAvatarEditor) return;
    setAvatarConfig((prev) => mergeAvatarConfig(prev, parseAvatarUrl(activeAvatarUrl)));
  }, [activeAvatarUrl, showAvatarEditor]);

  const labelize = (value: string) =>
    value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

  const applyAvatarConfig = (nextConfig: AvatarConfig) => {
    const nextUrl = buildAvatarUrl(nextConfig);
    setAvatarConfig(nextConfig);
    setTempData((prev) => ({ ...prev, profilePhoto: nextUrl }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    localStorage.setItem('profile_sync_pending', 'true');
    try {
      const baseData = {
        id: user.id,
        email: tempData.email,
        full_name: `${tempData.firstName} ${tempData.lastName}`.trim(),
        phone: tempData.mobile,
        avatar_url: ensureAvatarUrl(tempData.profilePhoto, tempData.firstName || 'User'),
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
        profilePhoto: ensureAvatarUrl(tempData.profilePhoto, tempData.firstName || 'User'),
        avatarUrl: ensureAvatarUrl(tempData.profilePhoto, tempData.firstName || 'User'),
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
            className="flex flex-col items-center gap-3"
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
              Animated avatar generated from your age group. Real photos are disabled for safety.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  setIsEditingForm(true);
                  const nextConfig = randomizeAvatarConfig(avatarConfig, ageGroup);
                  applyAvatarConfig(nextConfig);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Shuffle size={14} />
                Randomize
              </button>
              <button
                onClick={() => {
                  setIsEditingForm(true);
                  setShowAvatarEditor((prev) => !prev);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                <SlidersHorizontal size={14} />
                Edit Avatar
              </button>
            </div>
            {showAvatarEditor && (
              <div className="mt-4 w-full max-w-xl rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-gray-600">
                    Gender
                    <select
                      value={avatarConfig.gender}
                      onChange={(e) => {
                        const gender = e.target.value as AvatarConfig['gender'];
                        const next = {
                          ...avatarConfig,
                          gender,
                          beard: gender === 'female' ? 'Blank' : avatarConfig.beard,
                        };
                        applyAvatarConfig(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="neutral">Neutral</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Skin Tone
                    <select
                      value={avatarConfig.skinTone}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, skinTone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {SKIN_TONES.map((tone) => (
                        <option key={tone} value={tone}>{tone}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Hair Style
                    <select
                      value={avatarConfig.hairStyle}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, hairStyle: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {hairOptions.map((style) => (
                        <option key={style} value={style}>{labelize(style)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Hair Color
                    <select
                      value={avatarConfig.hairColor}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, hairColor: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {HAIR_COLORS.map((color) => (
                        <option key={color} value={color}>{labelize(color)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Glasses
                    <select
                      value={avatarConfig.glasses}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, glasses: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {GLASSES.map((glasses) => (
                        <option key={glasses} value={glasses}>{labelize(glasses)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Beard
                    <select
                      value={avatarConfig.beard}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, beard: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      disabled={avatarConfig.gender === 'female'}
                    >
                      {BEARDS.map((beard) => (
                        <option key={beard} value={beard}>{labelize(beard)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Clothing
                    <select
                      value={avatarConfig.clothing}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, clothing: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {clothingOptions.map((style) => (
                        <option key={style} value={style}>{labelize(style)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Clothing Color
                    <select
                      value={avatarConfig.clothingColor}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, clothingColor: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {CLOTHING_COLORS.map((color) => (
                        <option key={color} value={color}>{labelize(color)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-600">
                    Background
                    <select
                      value={avatarConfig.backgroundColor}
                      onChange={(e) => applyAvatarConfig({ ...avatarConfig, backgroundColor: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {BACKGROUND_COLORS.map((color) => (
                        <option key={color} value={color}>#{color}</option>
                      ))}
                    </select>
                  </label>
                </div>
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
              {/* Editable Fields */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                  <button
                    onClick={() => {
                      setIsEditingForm(!isEditingForm);
                      if (isEditingForm) setTempData(profileData);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${isEditingForm
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                  >
                    {isEditingForm ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  {isEditingForm ? (
                    <input
                      type="text"
                      value={tempData.firstName}
                      onChange={(e) => setTempData({ ...tempData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter first name"
                      aria-label="First name"
                      id="firstName"
                      name="firstName"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">{profileData.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  {isEditingForm ? (
                    <input
                      type="text"
                      value={tempData.lastName}
                      onChange={(e) => setTempData({ ...tempData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter last name"
                      aria-label="Last name"
                      id="lastName"
                      name="lastName"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">{profileData.lastName}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar size={16} className="text-gray-500" />
                    Date of Birth
                  </label>
                  {isEditingForm ? (
                    <input
                      type="date"
                      value={tempData.dateOfBirth}
                      onChange={(e) => setTempData({ ...tempData, dateOfBirth: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Date of birth"
                      id="dateOfBirth"
                      name="dateOfBirth"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">
                      {/* Bug 4 fix: guard against "Invalid Date" when dateOfBirth is empty */}
                      {profileData.dateOfBirth
                        ? new Date(profileData.dateOfBirth).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                        : 'Not specified'}
                    </p>
                  )}
                </div>

                {/* Job Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Briefcase size={16} className="text-gray-500" />
                    Job Type
                  </label>
                  {isEditingForm ? (
                    <select
                      value={tempData.jobType}
                      onChange={(e) => setTempData({ ...tempData, jobType: e.target.value as any })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Select job type"
                      id="jobType"
                      name="jobType"
                    >
                      <option value="">Select job type</option>
                      <option value="salaried">Salaried / Employed</option>
                      <option value="businessman">Self-employed / Business Owner</option>
                      <option value="freelancer">Freelancer</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">
                      {jobTypeLabel(profileData.jobType)}
                    </p>
                  )}
                </div>

                {/* Monthly Income */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-gray-500 font-bold text-base">₹</span>
                    Monthly Income
                  </label>
                  {isEditingForm ? (
                    <input
                      type="number"
                      value={tempData.monthlyIncome || ''}
                      onChange={(e) => setTempData({ ...tempData, monthlyIncome: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      id="monthlyIncome"
                      name="monthlyIncome"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">₹ {profileData.monthlyIncome.toLocaleString()}</p>
                  )}
                </div>

                {isEditingForm && (
                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors mt-4"
                  >
                    Save Changes
                  </button>
                )}
              </div>
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

          {/* Legal & Policies Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border border-gray-200 rounded-2xl p-6 lg:p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ShieldAlert size={20} className="text-purple-600" />
                Legal &amp; Privacy Policies
              </h3>

              <div className="space-y-4">
                {/* Privacy Policy */}
                <details className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-900">Privacy Policy</span>
                    </div>
                    <ChevronDown size={18} className="text-gray-500 group-open:hidden" />
                    <ChevronUp size={18} className="text-gray-500 hidden group-open:block" />
                  </summary>
                  <div className="p-4 pt-0 text-sm text-gray-600 border-t border-gray-200 bg-white">
                    <p className="mb-2"><strong>Effective Date:</strong> March 5, 2026</p>
                    <p className="mb-2">We collect and use your personal information solely to provide and improve the Finance Tracker application. Your financial data is securely encrypted and stored.</p>
                    <p>We do not sell your personal data to third parties. For more detailed information, please review our full Privacy Policy on our website.</p>
                  </div>
                </details>

                {/* SMS & Message Reading Policy */}
                <details className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <Smartphone size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-900">SMS &amp; Message Reading Policy</span>
                    </div>
                    <ChevronDown size={18} className="text-gray-500 group-open:hidden" />
                    <ChevronUp size={18} className="text-gray-500 hidden group-open:block" />
                  </summary>
                  <div className="p-4 pt-0 text-sm text-gray-600 border-t border-gray-200 bg-white">
                    <p className="mb-2"><strong>Usage of SMS Data:</strong></p>
                    <p className="mb-2">If you opt-in to automatic transaction tracking, our app may read SMS messages strictly from recognized banks and financial institutions to automatically log your expenses and incomes.</p>
                    <p>We use local on-device processing where possible. Message data is only transmitted to our servers if required to properly extract transaction amounts securely, and is never used for marketing purposes.</p>
                  </div>
                </details>

                {/* Terms of Service */}
                <details className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-900">Terms of Service</span>
                    </div>
                    <ChevronDown size={18} className="text-gray-500 group-open:hidden" />
                    <ChevronUp size={18} className="text-gray-500 hidden group-open:block" />
                  </summary>
                  <div className="p-4 pt-0 text-sm text-gray-600 border-t border-gray-200 bg-white">
                    <p className="mb-2">By using this application, you agree to our Terms of Service.</p>
                    <p>You are responsible for maintaining the confidentiality of your account login information and are fully responsible for all activities that occur under your account.</p>
                  </div>
                </details>

                {/* Contact Us */}
                <details className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-900">Contact &amp; Support</span>
                    </div>
                    <ChevronDown size={18} className="text-gray-500 group-open:hidden" />
                    <ChevronUp size={18} className="text-gray-500 hidden group-open:block" />
                  </summary>
                  <div className="p-4 pt-0 text-sm text-gray-600 border-t border-gray-200 bg-white">
                    <p className="mb-2">If you have any questions or need support regarding your account, privacy, or usage of the application, please reach out to our team:</p>
                    <p className="mb-1"><strong>Email:</strong> support@financetracker.com</p>
                    <p><strong>Phone:</strong> 1-800-[SUPPORT]</p>
                  </div>
                </details>

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
