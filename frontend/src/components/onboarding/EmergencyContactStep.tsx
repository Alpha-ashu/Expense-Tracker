import React, { useState } from 'react';

interface EmergencyContactStepProps {
  data: {
    emergencyContactName: string;
    emergencyContactNumber: string;
    emergencyContactType: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const CONTACT_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'both', label: 'Both', icon: '📱' },
];

export const EmergencyContactStep: React.FC<EmergencyContactStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.emergencyContactName.trim()) {
      newErrors.emergencyContactName = 'Contact name is required';
    } else if (data.emergencyContactName.trim().length < 2) {
      newErrors.emergencyContactName = 'Contact name must be at least 2 characters';
    }

    if (!data.emergencyContactNumber.trim()) {
      newErrors.emergencyContactNumber = 'Contact number is required';
    } else {
      // Remove all non-digit characters for validation
      const cleanNumber = data.emergencyContactNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        newErrors.emergencyContactNumber = 'Please enter a valid phone number (10-15 digits)';
      }
    }

    if (!data.emergencyContactType) {
      newErrors.emergencyContactType = 'Contact type is required';
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

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Format based on length
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Emergency Contact
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Add an emergency contact for account recovery and important notifications.
        </p>
      </div>

      <div>
        <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-1">
          Contact Name
        </label>
        <input
          type="text"
          id="emergencyContactName"
          value={data.emergencyContactName}
          onChange={(e) => onUpdate({ emergencyContactName: e.target.value })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.emergencyContactName ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Jane Doe"
        />
        {errors.emergencyContactName && (
          <p className="mt-1 text-sm text-red-600">{errors.emergencyContactName}</p>
        )}
      </div>

      <div>
        <label htmlFor="emergencyContactNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          id="emergencyContactNumber"
          value={data.emergencyContactNumber}
          onChange={(e) => onUpdate({ emergencyContactNumber: formatPhoneNumber(e.target.value) })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.emergencyContactNumber ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="(555) 123-4567"
          maxLength={16} // Formatted length
        />
        {errors.emergencyContactNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.emergencyContactNumber}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Enter phone number with country code if outside US.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preferred Contact Method
        </label>
        <div className="space-y-2">
          {CONTACT_TYPES.map((type) => (
            <label
              key={type.value}
              className="flex items-center p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50"
            >
              <input
                type="radio"
                name="emergencyContactType"
                value={type.value}
                checked={data.emergencyContactType === type.value}
                onChange={(e) => onUpdate({ emergencyContactType: e.target.value })}
                className="mr-3 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-2xl mr-3">{type.icon}</span>
              <div>
                <div className="font-medium text-gray-900">{type.label}</div>
                <div className="text-xs text-gray-500">
                  {type.value === 'whatsapp' && 'Receive notifications via WhatsApp'}
                  {type.value === 'phone' && 'Receive notifications via SMS/Call'}
                  {type.value === 'both' && 'Receive notifications via both methods'}
                </div>
              </div>
            </label>
          ))}
        </div>
        {errors.emergencyContactType && (
          <p className="mt-1 text-sm text-red-600">{errors.emergencyContactType}</p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-amber-800 mb-2">Privacy & Security</h4>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• Your emergency contact will only be used for account recovery</li>
          <li>• We'll never share your contact information with third parties</li>
          <li>• You can update this information anytime in settings</li>
          <li>• Emergency contact may receive verification codes if needed</li>
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
          Complete Setup
        </button>
      </div>
    </form>
  );
};
