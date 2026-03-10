import React, { useState, useEffect } from 'react';
import { ChevronRight, Shield, Cloud, Smartphone, Wallet, TrendingUp, Bell, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { OTPVerification } from './OTPVerification';
import { PINSetup } from './PINSetup';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { PrivacyPolicy } from '@/app/components/PrivacyPolicy';
import { TermsOfService } from '@/app/components/TermsOfService';
import { saveAccountWithBackendSync } from '@/lib/auth-sync-integration';

type AuthStep =
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'otp-verify'
  | 'profile-setup'
  | 'salary-setup'
  | 'pin-setup'
  | 'complete'
  | 'privacy'
  | 'terms';

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

      // Always go to PIN setup after sign-in.
      // Profile completion (onboarding) is handled by App.tsx's NewUserOnboarding gate,
      // so we don't need a separate legacy profile-setup path here.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      setIsNewUser(!profile);
      setStep('pin-setup');

      saveFlowState('pin-setup');
    } catch (error: any) {
      console.error('Sign in error:', error);
      const isNetworkError = error?.name === 'AuthRetryableFetchError' || error?.message?.includes('aborted');
      toast.error(isNetworkError ? 'Cannot connect to server. Please try again later.' : (error.message || 'Failed to sign in'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: { firstName: string; lastName: string; email: string; mobile: string; password: string }) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.mobile,
          },
        },
      });

      // SMTP misconfigured — account IS created but email failed. Non-fatal.
      const smtpFailed = error?.message?.toLowerCase().includes('sending confirmation email');
      // 500 server errors during signup — Supabase DB trigger ran but email hook failed
      const serverError = error?.status === 500 || error?.message?.toLowerCase().includes('internal server error');
      if (error && !smtpFailed && !serverError) throw error;

      setEmail(data.email);
      setUserProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        mobile: data.mobile,
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
      } else if (serverError) {
        // Supabase returned 500 — account may have been created but email sending failed
        // Route to OTP screen; resend button will recover via signInWithOtp
        setStep('otp-verify');
        saveFlowState('otp-verify');
        toast.warning('Account created, but our email server had an issue. Use \"Resend Code\" below to get your verification email.');
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
      const isNetworkError = error?.name === 'AuthRetryableFetchError' || error?.message?.includes('aborted');
      const isServerError = error?.status === 500 || error?.message?.toLowerCase().includes('internal server error');
      const isSmtpError = error?.message?.toLowerCase().includes('sending confirmation email') || error?.message?.toLowerCase().includes('smtp');
      
      let errMsg = error.message || 'Failed to create account';
      if (isNetworkError) {
        errMsg = 'Cannot connect to server. Please try again later.';
      } else if (isServerError) {
        errMsg = 'Signup is temporarily unavailable (server error). Please try again in a moment or contact support if this persists.';
      } else if (isSmtpError) {
        errMsg = "We couldn't send a verification email. Please try again later.";
      }
      
      toast.error(errMsg);
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

      toast.success('Setup complete! Welcome to Finora!');

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

      await saveAccountWithBackendSync({
        name: accountName,
        type: 'bank',
        balance,
        currency: 'INR',
        isActive: true,
        createdAt: new Date(),
      });
      toast.success('Salary account created!');
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
  const renderWelcome = () => {
    const containerVariants = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { staggerChildren: 0.12 } }
    };
    const itemVariants = {
      hidden: { opacity: 0, y: 24 },
      show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    };

    return (
      <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 flex flex-col overflow-hidden font-sans select-none">
        {/* Subtle decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[15%] -left-[10%] w-[60vw] h-[60vw] md:w-[40vw] md:h-[40vw] bg-blue-200/40 rounded-full blur-[80px]" />
          <div className="absolute top-[50%] -right-[10%] w-[50vw] h-[50vw] md:w-[35vw] md:h-[35vw] bg-indigo-200/30 rounded-full blur-[80px]" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 sm:px-8 mt-12"
        >
          {/* Logo Section */}
          <motion.div variants={itemVariants} className="mb-10 text-center w-full max-w-sm">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-[2rem] border-2 border-blue-200 border-dashed"
              />
              <div className="absolute inset-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center shadow-[0_8px_32px_rgba(37,99,235,0.25)]">
                <Wallet className="w-10 h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              Finora
            </h1>
            <p className="text-base sm:text-lg text-gray-500 font-medium max-w-[280px] sm:max-w-md mx-auto leading-relaxed">
              Experience the future of personal finance. Track, grow, and master your wealth seamlessly.
            </p>
          </motion.div>

          {/* Feature Pills */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 w-full max-w-sm mb-12">
            {[
              { icon: TrendingUp, text: 'Insights' },
              { icon: Shield, text: 'Secure' },
              { icon: Sparkles, text: 'Smart' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-default">
                <feature.icon className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">{feature.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Call To Actions */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-10 px-6 sm:px-8 pb-12 w-full max-w-md mx-auto"
        >
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep('signup')}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-2xl py-4 text-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              Create Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep('signin')}
              className="w-full bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-2xl py-4 font-semibold text-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
            >
              Sign In
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  };


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
              // Read firstName/lastName from the actual form inputs (not stale state)
              firstName: (formData.get('firstName') as string) || userProfile?.firstName || '',
              lastName: (formData.get('lastName') as string) || userProfile?.lastName || '',
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <button
                onClick={() => setStep('welcome')}
                className="text-gray-500 hover:text-gray-700 transition-colors mb-5 flex items-center gap-1.5 text-sm font-medium group"
              >
                <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 mt-1 text-sm">Sign in to continue your financial journey.</p>
            </div>
            <div className="p-6 sm:p-8 pt-6">
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <button
                onClick={() => setStep('welcome')}
                className="text-gray-500 hover:text-gray-700 transition-colors mb-5 flex items-center gap-1.5 text-sm font-medium group"
              >
                <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
              <p className="text-gray-500 mt-1 text-sm">Join Finora to start mastering your wealth.</p>
            </div>
            <div className="p-6 sm:p-8 pt-6">
              <SignUpForm
                onSwitchToSignIn={() => setStep('signin')}
                onSubmit={handleSignUp}
                onViewTerms={() => setStep('terms')}
                onViewPrivacy={() => setStep('privacy')}
              />
            </div>
          </div>
        </div>
      );
    case 'privacy':
      return <PrivacyPolicy onBack={() => setStep('signup')} />;
    case 'terms':
      return <TermsOfService onBack={() => setStep('signup')} />;
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
