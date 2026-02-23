import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Upload, Lock, Mail, Phone, User, Calendar, Briefcase, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import supabase from '@/utils/supabase/client';

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
  const { user } = useAuth();
  const { setCurrentPage } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch profile data from Supabase
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile data');
          return;
        }

        if (data) {
          setProfileData({
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            email: data.email || user.email || '',
            mobile: data.mobile || '',
            dateOfBirth: data.date_of_birth || '',
            monthlyIncome: data.monthly_income || 0,
            jobType: data.job_type as any || '',
            profilePhoto: data.profile_photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.first_name || 'User'}`,
          });
        } else {
          // No profile data found, use basic info from auth
          setProfileData(prev => ({
            ...prev,
            email: user.email || '',
            profilePhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email || 'User'}`,
          }));
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  const [isEditingForm, setIsEditingForm] = useState(false);
  const [tempData, setTempData] = useState<ProfileData>(profileData);
  const [verification, setVerification] = useState<VerificationState>({
    type: null,
    otp: '',
    newValue: '',
    step: 'request',
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData({ ...profileData, profilePhoto: e.target?.result as string });
        toast.success('Profile photo updated');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    setProfileData(tempData);
    setIsEditingForm(false);
    toast.success('Profile updated successfully');
  };

  const handleChangeEmail = () => {
    if (!verification.newValue) {
      toast.error('Please enter new email');
      return;
    }
    setVerification({
      ...verification,
      type: 'email-change',
      step: 'otp-sent',
    });
    toast.success('OTP sent to your registered mobile number');
  };

  const handleVerifyEmailOTP = () => {
    if (verification.otp === '123456') {
      // Mock verification
      setProfileData({ ...profileData, email: verification.newValue });
      setVerification({ type: null, otp: '', newValue: '', step: 'request' });
      toast.success('Email updated successfully');
    } else {
      toast.error('Invalid OTP');
    }
  };

  const handleChangeMobile = () => {
    if (!verification.newValue) {
      toast.error('Please enter new mobile number');
      return;
    }
    setVerification({
      ...verification,
      type: 'mobile-change',
      step: 'otp-sent',
    });
    toast.success('OTP sent to your registered email');
  };

  const handleVerifyMobileOTP = () => {
    if (verification.otp === '123456') {
      // Mock verification
      setProfileData({ ...profileData, mobile: verification.newValue });
      setVerification({ type: null, otp: '', newValue: '', step: 'request' });
      toast.success('Mobile number updated successfully');
    } else {
      toast.error('Invalid OTP');
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
          {/* Profile Photo Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <div className="relative">
              <img
                src={profileData.profilePhoto}
                alt="Profile"
                className="w-32 h-32 rounded-full border-4 border-blue-500 object-cover shadow-lg"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors shadow-lg"
                aria-label="Upload profile picture"
              >
                <Upload size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                aria-label="Upload profile picture"
              />
            </div>
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
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isEditingForm
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
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg">
                      {new Date(profileData.dateOfBirth).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
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
                    >
                      <option value="">Select job type</option>
                      <option value="salaried">Salaried</option>
                      <option value="businessman">Businessman</option>
                      <option value="freelancer">Freelancer</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium text-lg capitalize">
                      {profileData.jobType || 'Not specified'}
                    </p>
                  )}
                </div>

                {/* Monthly Income */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign size={16} className="text-gray-500" />
                    Monthly Income
                  </label>
                  {isEditingForm ? (
                    <input
                      type="number"
                      value={tempData.monthlyIncome}
                      onChange={(e) => setTempData({ ...tempData, monthlyIncome: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
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

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-50 border border-blue-200 rounded-2xl p-4 lg:p-6"
          >
            <p className="text-sm text-blue-900">
              <span className="font-semibold">🔒 Security Note:</span> Email changes require mobile verification, and mobile changes require email verification. This protects your account from unauthorized changes.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
