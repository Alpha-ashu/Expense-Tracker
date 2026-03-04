import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileSetupStepProps {
  data: {
    displayName: string;
    dateOfBirth: string;
    jobType: string;
    salary: string;
    avatarUrl?: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
}

const JOB_TYPES = [
  'Full-time Employment',
  'Part-time Employment',
  'Self-employed',
  'Freelance',
  'Business Owner',
  'Student',
  'Retired',
  'Unemployed',
  'Other',
];

export const ProfileSetupStep: React.FC<ProfileSetupStepProps> = ({
  data,
  onUpdate,
  onNext,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);

  const DEFAULT_AVATARS = [
    { id: 'man-1', url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4", label: "Man 1" },
    { id: 'man-2', url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&backgroundColor=c0aede", label: "Man 2" },
    { id: 'woman-1', url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&backgroundColor=ffdfbf", label: "Woman 1" },
    { id: 'woman-2', url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=d1d4f9", label: "Woman 2" },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (data.displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

    if (!data.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const dob = new Date(data.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 18 || age > 120) {
        newErrors.dateOfBirth = 'You must be between 18 and 120 years old';
      }
    }

    if (!data.jobType) {
      newErrors.jobType = 'Job type is required';
    }

    if (!data.salary) {
      newErrors.salary = 'Salary is required';
    } else if (isNaN(Number(data.salary)) || Number(data.salary) < 0) {
      newErrors.salary = 'Please enter a valid salary amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          Profile Information
        </h3>
        <p className="text-sm text-gray-500">
          Let's set up your profile with basic information about you.
        </p>
      </div>

      {/* Avatar Selection Area */}
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-blue-500 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-3xl font-bold">
                {data.displayName ? data.displayName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAvatarSelect(!showAvatarSelect)}
            className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm hover:bg-blue-700 transition-colors z-10"
          >
            <Upload size={14} />
          </button>
        </div>
        {!data.avatarUrl && (
          <p className="text-xs text-gray-400 mt-2">Select an avatar or use initials</p>
        )}

        <AnimatePresence>
          {showAvatarSelect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden"
            >
              <div className="pt-4 pb-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">Choose an Avatar</span>
                  {data.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ avatarUrl: '' })}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <X size={12} /> Remove
                    </button>
                  )}
                </div>
                <div className="flex gap-3 justify-center">
                  {DEFAULT_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        onUpdate({ avatarUrl: avatar.url });
                        setShowAvatarSelect(false);
                      }}
                      className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${data.avatarUrl === avatar.url ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent hover:border-gray-300'
                        }`}
                    >
                      <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover bg-gray-50" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
          Display Name
        </label>
        <input
          type="text"
          id="displayName"
          value={data.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.displayName ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="John Doe"
        />
        {errors.displayName && (
          <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>
        )}
      </div>

      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
          Date of Birth
        </label>
        <input
          type="date"
          id="dateOfBirth"
          value={data.dateOfBirth}
          onChange={(e) => onUpdate({ dateOfBirth: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
            }`}
        />
        {errors.dateOfBirth && (
          <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
        )}
      </div>

      <div>
        <label htmlFor="jobType" className="block text-sm font-medium text-gray-700 mb-1">
          Job Type
        </label>
        <select
          id="jobType"
          value={data.jobType}
          onChange={(e) => onUpdate({ jobType: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jobType ? 'border-red-500' : 'border-gray-300'
            }`}
        >
          <option value="">Select job type</option>
          {JOB_TYPES.map((job) => (
            <option key={job} value={job}>
              {job}
            </option>
          ))}
        </select>
        {errors.jobType && (
          <p className="mt-1 text-sm text-red-600">{errors.jobType}</p>
        )}
      </div>

      <div>
        <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-1">
          Annual Salary (₹)
        </label>
        <input
          type="number"
          id="salary"
          value={data.salary}
          onChange={(e) => onUpdate({ salary: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.salary ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="50000"
        />
        {errors.salary && (
          <p className="mt-1 text-sm text-red-600">{errors.salary}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Continue to Bank Account Setup
      </button>
    </form>
  );
};
