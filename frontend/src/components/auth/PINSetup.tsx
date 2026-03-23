import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { backupPINKeys, isPINSet, restorePINKeys, storeMasterKey, verifyPIN } from '@/lib/encryption';
import { pinService } from '@/services/pinService';

interface PINSetupProps {
  onComplete: (pin: string) => void;
  onBack?: () => void;
  isExistingUser?: boolean;
  existingPinRequired?: boolean;
}

export const PINSetup: React.FC<PINSetupProps> = ({
  onComplete,
  onBack,
  existingPinRequired = false,
}) => {
  const [step, setStep] = useState<'create' | 'confirm' | 'enter'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinStrength, setPinStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  useEffect(() => {
    // Check if user already has a PIN (existing user on new device)
    if (existingPinRequired) {
      setStep('enter');
    }
  }, [existingPinRequired]);

  // Check PIN strength
  useEffect(() => {
    if (pin.length === 6) {
      // Check for common patterns
      const isSequential = /012|123|234|345|456|567|678|789/.test(pin) || /987|876|765|654|543|432|321|210/.test(pin);
      const isRepeating = /(.)\1{2,}/.test(pin); // 3 or more repeating like 111, 222
      const isPattern = /^(121212|101010|010101|212121|112233|223344)$/.test(pin);
      const hasUniqueDigits = new Set(pin.split('')).size >= 4;

      if (isSequential || isRepeating || isPattern) {
        setPinStrength('weak');
      } else if (hasUniqueDigits) {
        setPinStrength('strong');
      } else {
        setPinStrength('medium');
      }
    }
  }, [pin]);

  const handlePinInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      if (step === 'create') {
        setPin(value);
        setError(null);
      } else if (step === 'confirm') {
        setConfirmPin(value);
        setError(null);
      } else {
        setPin(value);
        setError(null);
      }
    }
  };

  const handleContinue = () => {
    if (step === 'create') {
      if (pin.length !== 6) {
        setError('PIN must be 6 digits');
        return;
      }
      if (pinStrength === 'weak') {
        setError('PIN is too weak. Avoid sequential (123), repeating (111), or common patterns.');
        return;
      }
      setStep('confirm');
      setConfirmPin('');
    } else if (step === 'confirm') {
      if (confirmPin.length !== 6) {
        setError('Please enter 6 digits');
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        return;
      }
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const candidatePin = step === 'enter' ? pin : confirmPin;
      const result = step === 'enter'
        ? await pinService.verifyPin({ pin: candidatePin })
        : await pinService.createPin(candidatePin);

      if (!result.success) {
        setError(result.message || 'PIN request failed. Please try again.');
        return;
      }

      if (step === 'enter' && !isPINSet()) {
        const keyBackupResult = await pinService.getKeyBackup();
        if (keyBackupResult.success && keyBackupResult.backup) {
          const [hash, salt] = keyBackupResult.backup.split('|');
          if (hash && salt) {
            restorePINKeys({ hash, salt });
          }
        }
      }

      const localResult = verifyPIN(candidatePin);
      if (!localResult.isValid) {
        storeMasterKey(candidatePin);
      }

      const backup = backupPINKeys();
      if (backup.hash && backup.salt) {
        const backupResult = await pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`);
        if (!backupResult.success) {
          console.warn('PIN key backup refresh failed during setup:', backupResult.message);
        }
      }

      // Store PIN metadata
      localStorage.setItem('pin_created_at', new Date().toISOString());
      localStorage.setItem('pin_expiry', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()); // 90 days

      toast.success(step === 'enter' ? 'PIN verified successfully!' : 'PIN created successfully!');
      onComplete(candidatePin);
    } catch (err) {
      setError('Failed to save PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterPin = async () => {
    if (pin.length !== 6) {
      setError('Please enter 6 digits');
      return;
    }
    handleSubmit();
  };

  const renderPinDots = (value: string) => (
    <div className="flex justify-center gap-3 mb-4">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-200 ${value.length > i
              ? 'bg-blue-600 scale-110'
              : 'bg-gray-300 border-2 border-gray-300'
            }`}
        />
      ))}
    </div>
  );

  const getStrengthColor = () => {
    switch (pinStrength) {
      case 'weak': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'strong': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 text-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-4 top-4 text-white/80 hover:text-white"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 'create' && 'Create Security PIN'}
            {step === 'confirm' && 'Confirm Your PIN'}
            {step === 'enter' && 'Enter Your PIN'}
          </h1>
          <p className="text-sm text-gray-600">
            {step === 'create' && 'Set a 6-digit PIN to secure your app'}
            {step === 'confirm' && 'Re-enter your PIN to confirm'}
            {step === 'enter' && 'Enter your existing PIN to continue'}
          </p>
        </div>

        {/* PIN Input */}
        <div className="px-6 pb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          <div className="relative mb-4">
            <input
              type={showPin ? 'text' : 'password'}
              value={step === 'confirm' ? confirmPin : pin}
              onChange={(e) => handlePinInput(e.target.value)}
              className="w-full px-4 py-4 text-center text-3xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              aria-label="PIN input"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            >
              {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {renderPinDots(step === 'confirm' ? confirmPin : pin)}

          {/* PIN Strength Indicator (only for create step) */}
          {step === 'create' && pin.length === 6 && (
            <div className="text-center mb-4">
              <span className={`text-sm font-medium ${getStrengthColor()}`}>
                PIN Strength: {pinStrength.charAt(0).toUpperCase() + pinStrength.slice(1)}
              </span>
            </div>
          )}

          {/* Progress Steps */}
          {step !== 'enter' && (
            <div className="flex justify-center gap-2 mb-6">
              <div className={`w-3 h-3 rounded-full ${step === 'create' ? 'bg-blue-600' : 'bg-green-500'}`} />
              <div className={`w-3 h-3 rounded-full ${step === 'confirm' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          )}

          <button
            onClick={step === 'enter' ? handleEnterPin : handleContinue}
            disabled={isLoading || (step === 'confirm' ? confirmPin.length !== 6 : pin.length !== 6)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : step === 'enter' ? (
              'Verify PIN'
            ) : step === 'create' ? (
              'Continue'
            ) : (
              'Create PIN'
            )}
          </button>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Your PIN is secure</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Financial data stays encrypted on this device</li>
                  <li>• Used for app unlock and sensitive actions</li>
                  <li>• Valid for 90 days, same across all devices</li>
                  <li>• Server stores PIN verification data and encrypted recovery metadata only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
