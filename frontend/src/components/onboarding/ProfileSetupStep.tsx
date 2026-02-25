import React, { useState } from 'react';

interface ProfileSetupStepProps {
  data: {
    displayName: string;
    dateOfBirth: string;
    jobType: string;
    salary: string;
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
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Profile Information
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Let's set up your profile with basic information about you.
        </p>
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.displayName ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.jobType ? 'border-red-500' : 'border-gray-300'
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
          Annual Salary ($)
        </label>
        <input
          type="number"
          id="salary"
          value={data.salary}
          onChange={(e) => onUpdate({ salary: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.salary ? 'border-red-500' : 'border-gray-300'
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
