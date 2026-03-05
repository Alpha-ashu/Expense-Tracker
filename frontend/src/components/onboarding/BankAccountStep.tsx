import React, { useState } from 'react';

interface BankAccountStepProps {
  data: {
    country: string;
    bankName: string;
    accountHolderName: string;
    currentBalance: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const BANK_LISTS: Record<string, string[]> = {
  'India': ['State Bank of India (SBI)', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank (PNB)', 'Bank of Baroda', 'Canara Bank', 'Other'],
  'United States': ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One', 'Other'],
  'United Kingdom': ['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Other'],
  'Canada': ['RBC Royal Bank', 'TD Bank', 'Scotiabank', 'BMO', 'CIBC', 'Other'],
  'Australia': ['Commonwealth Bank', 'Westpac', 'ANZ', 'NAB', 'Other'],
  'Default': ['Primary Local Bank', 'International Bank', 'Other']
};

export const BankAccountStep: React.FC<BankAccountStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.bankName) {
      newErrors.bankName = 'Bank name is required';
    }

    if (!data.accountHolderName.trim()) {
      newErrors.accountHolderName = 'Account holder name is required';
    } else if (data.accountHolderName.trim().length < 2) {
      newErrors.accountHolderName = 'Account holder name must be at least 2 characters';
    }

    if (data.currentBalance && isNaN(Number(data.currentBalance))) {
      newErrors.currentBalance = 'Please enter a valid amount';
    } else if (data.currentBalance && Number(data.currentBalance) < 0) {
      newErrors.currentBalance = 'Balance cannot be negative';
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

  const availableBanks = BANK_LISTS[data.country] || BANK_LISTS['Default'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Bank Account Setup
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Set up your primary account details for tracking.
        </p>
      </div>

      <div>
        <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">
          Bank Name
        </label>
        <select
          id="bankName"
          value={data.bankName}
          onChange={(e) => onUpdate({ bankName: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bankName ? 'border-red-500' : 'border-gray-300'
            }`}
        >
          <option value="">Select your bank</option>
          {availableBanks.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
        {errors.bankName && (
          <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>
        )}
      </div>

      <div>
        <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 mb-1">
          Account Name
        </label>
        <input
          type="text"
          id="accountHolderName"
          value={data.accountHolderName}
          onChange={(e) => onUpdate({ accountHolderName: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.accountHolderName ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Main checking, Savings, etc."
        />
        {errors.accountHolderName && (
          <p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>
        )}
      </div>

      <div>
        <label htmlFor="currentBalance" className="block text-sm font-medium text-gray-700 mb-1">
          Current Balance
        </label>
        <input
          type="number"
          id="currentBalance"
          value={data.currentBalance}
          onChange={(e) => onUpdate({ currentBalance: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.currentBalance ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="0"
          min="0"
          step="0.01"
        />
        {errors.currentBalance && (
          <p className="mt-1 text-sm text-red-600">{errors.currentBalance}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          The amount currently in this bank account.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Almost Done!</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Set up your starting balance</li>
          <li>• Provide insights on your spending patterns</li>
          <li>• Your bank information is encrypted and secure</li>
        </ul>
      </div>

      <div className="flex space-x-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Back
        </button>
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Submit
        </button>
      </div>
    </form>
  );
};
