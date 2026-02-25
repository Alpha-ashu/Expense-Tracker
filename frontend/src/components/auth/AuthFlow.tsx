import React, { useState, useEffect } from 'react';
import { ChevronRight, Shield, Cloud, Smartphone, Wallet, TrendingUp, Bell } from 'lucide-react';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { OTPVerification } from './OTPVerification';
import { PINSetup } from './PINSetup';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { useApp } from '@/contexts/AppContext';

type AuthStep =
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'otp-verify'
  | 'profile-setup'
  | 'salary-setup'
  | 'pin-setup'
  | 'complete';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  jobType: string;
  jobIndustry: string;
  monthlyIncome: string;
}

interface SalaryAccount {
  bankName: string;
  accountName: string;
  accountType: string;
  openingBalance: string;
  salaryCreditDate: string;
  isPrimary: boolean;
}

export const AuthFlow: React.FC = () => {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [email, setEmail] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [salaryAccount, setSalaryAccount] = useState<SalaryAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentPage } = useApp();

  // Check if user is already partially through the flow
  useEffect(() => {
    const checkFlowState = async () => {
      const pendingEmail = localStorage.getItem('pending_auth_email');
      const flowStep = localStorage.getItem('auth_flow_step');

      if (pendingEmail && flowStep) {
        setEmail(pendingEmail);
        setStep(flowStep as AuthStep);
      }
    };
    checkFlowState();
  }, []);

  const saveFlowState = (currentStep: AuthStep) => {
    localStorage.setItem('auth_flow_step', currentStep);
    if (email) {
      localStorage.setItem('pending_auth_email', email);
    }
  };

  const handleSignIn = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      setEmail(credentials.email);

      // Check if user has completed profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        // Existing user - go directly to PIN
        setIsNewUser(false);
        setStep('pin-setup');
      } else {
        // No profile - need to complete setup
        setIsNewUser(true);
        setStep('profile-setup');
      }

      saveFlowState(step);
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      // SMTP misconfigured — account IS created but email failed. Non-fatal.
      const smtpFailed = error?.message?.toLowerCase().includes('sending confirmation email');
      if (error && !smtpFailed) throw error;

      setEmail(data.email);
      setUserProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        mobile: '',
        dateOfBirth: '',
        jobType: '',
        jobIndustry: '',
        monthlyIncome: '',
      });
      setIsNewUser(true);

      // Auto-detect: if Supabase "Confirm email" is OFF, the user is already confirmed
      // immediately after signUp (email_confirmed_at is set). Skip OTP in that case.
      const alreadyConfirmed = !!authData?.user?.email_confirmed_at;

      if (alreadyConfirmed) {
        // Email confirmation disabled in Supabase — go straight to profile setup
        setStep('profile-setup');
        saveFlowState('profile-setup');
        toast.success('Account created! Let\'s set up your profile.');
      } else if (smtpFailed) {
        // Account created but email not sent — go to OTP screen with warning
        setStep('otp-verify');
        saveFlowState('otp-verify');
        toast.warning('Account created! Email delivery failed — fix SMTP in Supabase dashboard, then click Resend Code.');
      } else {
        // Normal flow — email sent, user must verify
        setStep('otp-verify');
        saveFlowState('otp-verify');
        toast.success('Verification code sent to your email!');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerified = () => {
    if (isNewUser) {
      setStep('profile-setup');
    } else {
      setStep('pin-setup');
    }
    saveFlowState(isNewUser ? 'profile-setup' : 'pin-setup');
  };

  const handleOTPSkip = () => {
    // Limited mode - still allow entry
    if (isNewUser) {
      setStep('profile-setup');
    } else {
      setStep('pin-setup');
    }
    toast.info('You can verify your email later in Settings');
  };

  const handleProfileComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setStep('salary-setup');
    saveFlowState('salary-setup');
  };

  const handleSalarySetupComplete = async (account: SalaryAccount) => {
    setIsLoading(true);
    setSalaryAccount(account);

    try {
      // Store profile data
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Save profile — try full upsert first, fallback to base columns if migration not run
        const baseProfile = {
          id: user.id,
          email: userProfile?.email,
          full_name: `${userProfile?.firstName ?? ''} ${userProfile?.lastName ?? ''}`.trim(),
          phone: userProfile?.mobile ?? null,
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase.from('profiles').upsert({
          ...baseProfile,
          date_of_birth: userProfile?.dateOfBirth || null,
          job_type: userProfile?.jobType || null,
          job_industry: userProfile?.jobIndustry || null,
          monthly_income: parseFloat(userProfile?.monthlyIncome || '0'),
        });

        if (profileError) {
          // Likely missing extended columns — fall back to base columns only
          console.warn('Extended profile upsert failed, trying base:', profileError.message);
          const { error: baseError } = await supabase.from('profiles').upsert(baseProfile);
          if (baseError) {
            console.error('Base profile save also failed:', baseError);
          }
        }

        // Register device
        const deviceId = localStorage.getItem('device_id') || generateDeviceId();
        await supabase.from('user_devices').upsert({
          user_id: user.id,
          device_id: deviceId,
          device_name: navigator.userAgent,
          last_used: new Date().toISOString(),
        });
      }

      setStep('pin-setup');
      saveFlowState('pin-setup');
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePINComplete = async (pin: string) => {
    setIsLoading(true);
    try {
      // Auto-provision accounts and setup
      await autoProvisionAccounts();

      // Mark onboarding complete
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('onboarding_date', new Date().toISOString());
      localStorage.removeItem('auth_flow_step');
      localStorage.removeItem('pending_auth_email');

      toast.success('Setup complete! Welcome to FinanceLife!');

      // Dispatch global event for other modules
      window.dispatchEvent(new CustomEvent('PROFILE_SETUP_COMPLETED', {
        detail: { profile: userProfile, salaryAccount }
      }));

      setStep('complete');
    } catch (error) {
      console.error('Failed to complete setup:', error);
      toast.error('Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const autoProvisionAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || !salaryAccount) return;

      const accountName = `${salaryAccount.bankName} - ${salaryAccount.accountName}`;
      const balance = parseFloat(salaryAccount.openingBalance) || 0;

      // 1. Save to local Dexie DB immediately (guaranteed to work)
      await db.accounts.add({
        name: accountName,
        type: 'bank',
        balance,
        currency: 'INR',
        isActive: true,
        createdAt: new Date(),
      });

      // 2. Sync to Supabase — only use guaranteed base columns
      const { error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: accountName,
        type: 'bank',
        balance,
        currency: 'INR',
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to sync account to Supabase:', error.message);
        // Local save succeeded — not a blocking error
      } else {
        toast.success('Salary account created and synced!');
      }
    } catch (error) {
      console.error('Auto-provisioning failed:', error);
      toast.error('Failed to create account. Please try again.');
    }
  };

  const generateDeviceId = (): string => {
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
    return deviceId;
  };

  // Welcome Screen
  const renderWelcome = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-sm rounded-3xl mb-6">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            FinanceLife
          </h1>
          <p className="text-xl text-blue-100 max-w-md">
            Your personal finance companion. Track expenses, manage budgets, and achieve your financial goals.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm">
          {[
            { icon: TrendingUp, text: 'Track Spending' },
            { icon: Cloud, text: 'Cloud Sync' },
            { icon: Shield, text: 'Bank-level Security' },
            { icon: Bell, text: 'Bill Reminders' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <feature.icon className="w-5 h-5 text-blue-200" />
              <span className="text-sm text-white">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 pb-12 space-y-4">
        <button
          onClick={() => setStep('signup')}
          className="w-full py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          Get Started
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => setStep('signin')}
          className="w-full py-4 bg-white/10 text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          I already have an account
        </button>
      </div>
    </div>
  );

  // Profile Setup Step
  const renderProfileSetup = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Complete Your Profile</h2>
          <p className="text-sm text-gray-600 mt-1">Tell us a bit about yourself</p>
        </div>
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handleProfileComplete({
              firstName: userProfile?.firstName || '',
              lastName: userProfile?.lastName || '',
              email: email,
              mobile: '',
              dateOfBirth: formData.get('dob') as string,
              jobType: formData.get('jobType') as string,
              jobIndustry: formData.get('jobIndustry') as string,
              monthlyIncome: formData.get('income') as string,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ps-firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                id="ps-firstName"
                name="firstName"
                defaultValue={userProfile?.firstName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="ps-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                id="ps-lastName"
                name="lastName"
                defaultValue={userProfile?.lastName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="ps-dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              id="ps-dob"
              name="dob"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ps-jobType" className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
              <select
                id="ps-jobType"
                name="jobType"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select...</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="self-employed">Self-employed</option>
                <option value="freelance">Freelance</option>
                <option value="student">Student</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label htmlFor="ps-jobIndustry" className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select
                id="ps-jobIndustry"
                name="jobIndustry"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select...</option>
                <option value="it">IT / Technology</option>
                <option value="finance">Finance</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="retail">Retail</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ps-income" className="block text-sm font-medium text-gray-700 mb-1">Monthly Income (₹)</label>
            <input
              type="number"
              id="ps-income"
              name="income"
              placeholder="50000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );

  // Salary Setup Step
  const renderSalarySetup = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Salary Account Setup</h2>
          <p className="text-sm text-gray-600 mt-1">Link your salary account for automatic tracking</p>
        </div>
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handleSalarySetupComplete({
              bankName: formData.get('bankName') as string,
              accountName: formData.get('accountName') as string,
              accountType: 'bank',
              openingBalance: formData.get('balance') as string,
              salaryCreditDate: formData.get('creditDate') as string,
              isPrimary: formData.get('isPrimary') === 'on',
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <select
              name="bankName"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select your bank</option>
              <option value="SBI">State Bank of India</option>
              <option value="HDFC">HDFC Bank</option>
              <option value="ICICI">ICICI Bank</option>
              <option value="Axis">Axis Bank</option>
              <option value="Kotak">Kotak Mahindra Bank</option>
              <option value="PNB">Punjab National Bank</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              name="accountName"
              placeholder="As per bank records"
              defaultValue={`${userProfile?.firstName} ${userProfile?.lastName}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
            <input
              type="number"
              name="balance"
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Optional - current balance in this account</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Credit Date</label>
            <select
              name="creditDate"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select date</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>
                  {day}{day === 1 || day === 21 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'} of every month
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPrimary"
              id="isPrimary"
              defaultChecked
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="isPrimary" className="text-sm text-gray-700">
              Set as primary account
            </label>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your account will be automatically set up after PIN creation.
              You can add more accounts later.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Continue to PIN Setup'}
          </button>
        </form>
      </div>
    </div>
  );

  // Completion Screen
  const renderComplete = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full mb-6">
          <Shield className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          You're All Set!
        </h1>
        <p className="text-blue-100 mb-8 max-w-md">
          Your account has been set up successfully. Start tracking your finances now!
        </p>
        <button
          onClick={() => window.location.reload()}
          className="py-3 px-8 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  // Main render
  switch (step) {
    case 'welcome':
      return renderWelcome();
    case 'signin':
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => setStep('welcome')}
                className="text-gray-600 hover:text-gray-800 mb-4 flex items-center gap-2"
              >
                ← Back
              </button>
              <h2 className="text-xl font-semibold text-gray-800">Sign In</h2>
            </div>
            <div className="p-6">
              <SignInForm
                onSwitchToSignUp={() => setStep('signup')}
                onSubmit={handleSignIn}
              />
            </div>
          </div>
        </div>
      );
    case 'signup':
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => setStep('welcome')}
                className="text-gray-600 hover:text-gray-800 mb-4 flex items-center gap-2"
              >
                ← Back
              </button>
              <h2 className="text-xl font-semibold text-gray-800">Create Account</h2>
            </div>
            <div className="p-6">
              <SignUpForm
                onSwitchToSignIn={() => setStep('signin')}
                onSubmit={handleSignUp}
              />
            </div>
          </div>
        </div>
      );
    case 'otp-verify':
      return (
        <OTPVerification
          email={email}
          isNewUser={isNewUser}
          mandatory={true}
          onVerified={handleOTPVerified}
          onBack={() => setStep('signup')}
        />
      );
    case 'profile-setup':
      return renderProfileSetup();
    case 'salary-setup':
      return renderSalarySetup();
    case 'pin-setup':
      return (
        <PINSetup
          onComplete={handlePINComplete}
          existingPinRequired={!isNewUser}
        />
      );
    case 'complete':
      return renderComplete();
    default:
      return renderWelcome();
  }
};