import React, { useState } from 'react';

interface BankAccountStepProps {
  data: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    salaryCreditDate: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const BANKS = [
  'Bank of America',
  'Chase',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'US Bank',
  'PNC Bank',
  'TD Bank',
  'Bank of the West',
  'Other',
];

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

    if (!data.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d{8,17}$/.test(data.accountNumber.replace(/\s/g, ''))) {
      newErrors.accountNumber = 'Please enter a valid account number (8-17 digits)';
    }

    if (!data.accountHolderName.trim()) {
      newErrors.accountHolderName = 'Account holder name is required';
    } else if (data.accountHolderName.trim().length < 2) {
      newErrors.accountHolderName = 'Account holder name must be at least 2 characters';
    }

    if (!data.salaryCreditDate) {
      newErrors.salaryCreditDate = 'Salary credit date is required';
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

  const formatAccountNumber = (value: string) => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    // Format with spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Bank Account Setup
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Set up your salary account details for automatic tracking.
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.bankName ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select your bank</option>
          {BANKS.map((bank) => (
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
          Account Holder Name
        </label>
        <input
          type="text"
          id="accountHolderName"
          value={data.accountHolderName}
          onChange={(e) => onUpdate({ accountHolderName: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.accountHolderName ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
        />
        {errors.accountHolderName && (
          <p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>
        )}
      </div>

      <div>
        <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Account Number
        </label>
        <input
          type="text"
          id="accountNumber"
          value={data.accountNumber}
          onChange={(e) => onUpdate({ accountNumber: formatAccountNumber(e.target.value) })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.accountNumber ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="1234 5678 9012 3456"
          maxLength={21} // 17 digits + 4 spaces
        />
        {errors.accountNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.accountNumber}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Enter your account number (8-17 digits). Spaces will be added automatically.
        </p>
      </div>

      <div>
        <label htmlFor="salaryCreditDate" className="block text-sm font-medium text-gray-700 mb-1">
          Salary Credit Date
        </label>
        <select
          id="salaryCreditDate"
          value={data.salaryCreditDate}
          onChange={(e) => onUpdate({ salaryCreditDate: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.salaryCreditDate ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select salary credit date</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <option key={day} value={day.toString()}>
              {day}{day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'} of each month
            </option>
          ))}
        </select>
        {errors.salaryCreditDate && (
          <p className="mt-1 text-sm text-red-600">{errors.salaryCreditDate}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Select the day of the month when your salary is typically credited.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Why we need this information</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Automatically track your salary deposits</li>
          <li>• Set up monthly budget based on your income</li>
          <li>• Provide insights on your spending patterns</li>
          <li>• Your bank information is encrypted and secure</li>
        </ul>
      </div>

      <div className="flex space-x-3">
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
          Continue to Emergency Contact
        </button>
      </div>
    </form>
  );
};
