import React, { useState } from 'react';
import { ProfileSetupStep } from './ProfileSetupStep';
import { BankAccountStep } from './BankAccountStep';
import { OnboardingCompleteStep } from './OnboardingCompleteStep';

interface OnboardingData {
  displayName: string;
  dateOfBirth: string;
  jobType: string;
  salary: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  salaryCreditDate: string;
}

export const NewUserOnboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    displayName: '',
    dateOfBirth: '',
    jobType: '',
    salary: '',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    salaryCreditDate: '',
  });

  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ProfileSetupStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={nextStep}
          />
        );
      case 2:
        return (
          <BankAccountStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <OnboardingCompleteStep
            data={onboardingData}
            onComplete={() => {
              // Handle onboarding completion
              console.log('New onboarding completed:', onboardingData);
              // Save to localStorage and redirect to dashboard
              localStorage.setItem('user_profile', JSON.stringify(onboardingData));
              localStorage.setItem('onboarding_completed', 'true');
              // Dispatch custom event for global state update
              window.dispatchEvent(new CustomEvent('ONBOARDING_COMPLETED', { 
                detail: onboardingData 
              }));
              window.location.href = '/dashboard';
            }}
            onBack={prevStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Progress Indicator */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Complete Your Profile</h2>
            <span className="text-sm text-gray-500">Step {currentStep} of 3</span>
          </div>
          <div className="flex space-x-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};
