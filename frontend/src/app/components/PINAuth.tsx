import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Fingerprint, Shield } from 'lucide-react';
import { isPINSet, verifyPIN, storeMasterKey } from '@/lib/encryption';
import { toast } from 'sonner';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

interface PINAuthProps {
  onAuthenticated: (encryptionKey: string) => void;
}

export const PINAuth: React.FC<PINAuthProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    const pinExists = isPINSet();
    setIsCreating(!pinExists);
    
    // Check biometric availability on native platforms
    if (Capacitor.isNativePlatform()) {
      checkBiometricAvailability();
    }
  }, []);

  const checkBiometricAvailability = async () => {
    // This will be implemented with native biometric plugin
    // For now, set to false
    setBiometricAvailable(false);
  };

  const handlePINInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      if (isCreating && pin.length === 6) {
        setConfirmPin(value);
      } else {
        setPin(value);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isCreating) {
        // Creating new PIN
        if (pin.length !== 6) {
          toast.error('PIN must be 6 digits');
          setIsLoading(false);
          return;
        }

        if (confirmPin.length === 0) {
          toast.info('Please confirm your PIN');
          setIsLoading(false);
          return;
        }

        if (pin !== confirmPin) {
          toast.error('PINs do not match');
          setConfirmPin('');
          setIsLoading(false);
          return;
        }

        // Store PIN and generate encryption key
        const key = storeMasterKey(pin);
        
        // Store in Capacitor Preferences for native platforms
        if (Capacitor.isNativePlatform()) {
          await Preferences.set({
            key: 'user_authenticated',
            value: 'true',
          });
        }

        toast.success('PIN created successfully');
        onAuthenticated(key);
      } else {
        // Verifying existing PIN
        if (pin.length !== 6) {
          toast.error('PIN must be 6 digits');
          setIsLoading(false);
          return;
        }

        const result = verifyPIN(pin);
        
        if (result.isValid && result.key) {
          // Store in Capacitor Preferences for native platforms
          if (Capacitor.isNativePlatform()) {
            await Preferences.set({
              key: 'user_authenticated',
              value: 'true',
            });
          }

          toast.success('Authentication successful');
          onAuthenticated(result.key);
        } else {
          toast.error('Invalid PIN');
          setPin('');
          setIsLoading(false);
        }
      }
    } catch (error) {
      toast.error('An error occurred');
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    // TODO: Implement biometric authentication
    toast.info('Biometric authentication coming soon');
  };

  return (
    <div className="fixed inset-0 bg-blue-600 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FinanceLife</h1>
          <p className="text-blue-100">
            {isCreating ? 'Create your secure PIN' : 'Enter your PIN to continue'}
          </p>
        </div>

        {/* PIN Input Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PIN Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isCreating && confirmPin.length === 0 ? 'Create 6-digit PIN' : isCreating ? 'Confirm PIN' : 'Enter PIN'}
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={isCreating && pin.length === 6 ? confirmPin : pin}
                  onChange={(e) => handlePINInput(e.target.value)}
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* PIN Dots Indicator */}
            <div className="flex justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    (isCreating && pin.length === 6 ? confirmPin : pin).length > i
                      ? 'bg-blue-600 scale-110'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Progress indicator for PIN creation */}
            {isCreating && (
              <div className="text-center text-sm text-gray-600">
                {pin.length === 0 && 'Enter a 6-digit PIN'}
                {pin.length > 0 && pin.length < 6 && `${pin.length}/6 digits entered`}
                {pin.length === 6 && confirmPin.length === 0 && 'Now confirm your PIN'}
                {pin.length === 6 && confirmPin.length > 0 && confirmPin.length < 6 && `${confirmPin.length}/6 digits confirmed`}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (isCreating ? pin.length !== 6 || confirmPin.length !== 6 : pin.length !== 6)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : isCreating ? (
                'Create PIN'
              ) : (
                'Unlock'
              )}
            </button>

            {/* Biometric Option */}
            {!isCreating && biometricAvailable && (
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Fingerprint size={20} />
                Use Biometric
              </button>
            )}
          </form>

          {/* Security Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Your data is secure</p>
                <p className="text-blue-700">
                  All your financial data is encrypted and stored locally on your device. 
                  Your PIN is never sent to any server.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-blue-100 text-sm">
          <p>Privacy-first financial management</p>
        </div>
      </div>
    </div>
  );
};