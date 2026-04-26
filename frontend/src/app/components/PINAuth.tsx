import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Fingerprint, LogOut, KeyRound, AlertCircle } from 'lucide-react';
import { FinoraLogo } from './ui/FinoraLogo';
import { clearSecurityData, isPINSet, verifyPIN, storeMasterKey, backupPINKeys, restorePINKeys } from '@/lib/encryption';
import { isPinMissing, pinService } from '@/services/pinService';
import { toast } from 'sonner';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';

interface PINAuthProps {
  onAuthenticated: (encryptionKey: string) => void;
}

export const PINAuth: React.FC<PINAuthProps> = ({ onAuthenticated }) => {
  const { signOut, user } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const pinMismatch = isCreating && confirmPin.length > 0 && pin !== confirmPin;

  const finalizeAuthentication = async (key: string, successMessage: string) => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({
        key: 'user_authenticated',
        value: 'true',
      });
    }

    toast.success(successMessage);
    onAuthenticated(key);
  };

  useEffect(() => {
    let isMounted = true;

    const initPin = async () => {
      setIsLoading(true);
      try {
        const status = await pinService.getStatus();
        const hasServerPin = status.success;
        const hasLocalPin = isPINSet();

        if (hasServerPin && !hasLocalPin) {
          const keyBackupResult = await pinService.getKeyBackup();
          if (keyBackupResult.success && keyBackupResult.backup) {
            const [hash, salt] = keyBackupResult.backup.split('|');
            if (hash && salt) {
              restorePINKeys({ hash, salt });
            }
          }
        }

        if (isMounted) {
          const shouldCreatePin = !hasLocalPin && isPinMissing(status);
          setIsCreating(shouldCreatePin);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Failed to initialize PIN auth:', error);
        if (isMounted) {
          setIsCreating(!isPINSet());
          setIsLoading(false);
        }
      }
    };

    initPin();

    // Check biometric availability on native platforms
    if (Capacitor.isNativePlatform()) {
      checkBiometricAvailability();
    }

    return () => { isMounted = false; };
  }, []);

  const checkBiometricAvailability = async () => {
    // This will be implemented with native biometric plugin
    // For now, set to false
    setBiometricAvailable(false);
  };

  const handlePINInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setPin(value);
    }
  };

  const handleConfirmPINInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setConfirmPin(value);
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

        const createResult = await pinService.createPin(pin);
        if (!createResult.success) {
          toast.error(createResult.message || 'Failed to create PIN');
          setIsLoading(false);
          return;
        }

        const key = storeMasterKey(pin);

        const backup = backupPINKeys();
        if (backup.hash && backup.salt) {
          const backupResult = await pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`);
          if (!backupResult.success) {
            console.warn('PIN key backup refresh failed after PIN creation:', backupResult.message);
          }
        }
        await finalizeAuthentication(key, 'PIN created successfully');
      } else {
        // Verifying existing PIN
        if (pin.length !== 6) {
          toast.error('PIN must be 6 digits');
          setIsLoading(false);
          return;
        }

        const verifyResult = await pinService.verifyPin({ pin });
        if (!verifyResult.success) {
          if (isPinMissing(verifyResult)) {
            const localResult = verifyPIN(pin);

            if (localResult.isValid) {
              const repairResult = await pinService.createPin(pin);
              if (repairResult.success) {
                const backup = backupPINKeys();
                if (backup.hash && backup.salt) {
                  const backupResult = await pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`);
                  if (!backupResult.success) {
                    console.warn('PIN key backup refresh failed after server repair:', backupResult.message);
                  }
                }

                if (localResult.key) {
                  await finalizeAuthentication(localResult.key, 'PIN restored successfully');
                  return;
                }
              }
            }
          }

          toast.error(verifyResult.message || 'Invalid PIN');
          setPin('');
          setIsLoading(false);
          return;
        }

        const localResult = verifyPIN(pin);

        if (verifyResult.success && !isPINSet()) {
          const keyBackupResult = await pinService.getKeyBackup();
          if (keyBackupResult.success && keyBackupResult.backup) {
            const [hash, salt] = keyBackupResult.backup.split('|');
            if (hash && salt) {
              restorePINKeys({ hash, salt });
            }
          }
        }

        const key = localResult.isValid && localResult.key
          ? localResult.key
          : storeMasterKey(pin);

        if (!localResult.isValid) {
          const backup = backupPINKeys();
          if (backup.hash && backup.salt) {
            const backupResult = await pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`);
            if (!backupResult.success) {
              console.warn('PIN key backup refresh failed after fallback key creation:', backupResult.message);
            }
          }
        }

        if (key) {
          await finalizeAuthentication(key, 'Authentication successful');
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

  const handleUseDifferentAccount = async () => {
    setIsLoggingOut(true);
    try {
      setShowResetConfirmation(false);
      setResetErrorMessage(null);
      pinService.clearPinData();
      clearSecurityData();
      await signOut();
    } catch (error) {
      console.error('Failed to sign out from PIN screen:', error);
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleForgotPin = async () => {
    setResetErrorMessage(null);
    setShowResetConfirmation(true);
  };

  const handleCancelReset = () => {
    setResetErrorMessage(null);
    setShowResetConfirmation(false);
  };

  const handleConfirmResetPin = async () => {
    setIsResettingPin(true);

    try {
      const result = await pinService.resetCurrentUserPin();
      if (!result.success) {
        setResetErrorMessage(result.message || 'Failed to reset PIN');
        return;
      }

      setResetErrorMessage(null);
      setShowResetConfirmation(false);
      clearSecurityData();
      await signOut();
      toast.success('PIN reset. Sign in again to create a new PIN.');
    } catch (error) {
      console.error('Failed to reset PIN:', error);
      setResetErrorMessage('Failed to reset PIN. Please try again.');
    } finally {
      setIsResettingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-blue-600 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-full w-full max-w-[34rem] flex-col justify-center">
        {/* Logo and Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <FinoraLogo className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white sm:text-[3rem]">Finora</h1>
          <p className="text-lg text-blue-100 sm:text-xl">
            {isCreating ? 'Create your secure PIN' : 'Enter your PIN to continue'}
          </p>
        </div>

        {/* PIN Input Card */}
        <div className="rounded-[2rem] bg-white px-6 py-7 shadow-2xl sm:px-8 sm:py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              name="username"
              value={user?.email || ''}
              readOnly
              autoComplete="username"
              tabIndex={-1}
              className="sr-only"
              aria-hidden="true"
            />
            {/* PIN Input */}
            <div>
              {isCreating ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="finora-pin-entry" className="mb-2 block text-sm font-medium text-gray-700">
                      Enter 6-digit PIN
                    </label>
                    <div className="relative">
                      <input
                        id="finora-pin-entry"
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => handlePINInput(e.target.value)}
                        className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-contacts-auto-fill-button]:hidden [&::-ms-reveal]:hidden"
                        placeholder="••••••"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label="Enter 6-digit PIN"
                        aria-required="true"
                        autoComplete="new-password"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="finora-pin-confirm" className="mb-2 block text-sm font-medium text-gray-700">
                      Confirm 6-digit PIN
                    </label>
                    <div className="relative">
                      <input
                        id="finora-pin-confirm"
                        type={showPin ? 'text' : 'password'}
                        value={confirmPin}
                        onChange={(e) => handleConfirmPINInput(e.target.value)}
                        className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-contacts-auto-fill-button]:hidden [&::-ms-reveal]:hidden"
                        placeholder="••••••"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label="Confirm 6-digit PIN"
                        aria-invalid={pinMismatch}
                        aria-required="true"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPin ? 'Hide PIN value' : 'Show PIN value'}
                      >
                        {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="finora-pin-entry" className="mb-2 block text-sm font-medium text-gray-700">
                    Enter PIN
                  </label>
                  <div className="relative">
                    <input
                      id="finora-pin-entry"
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => handlePINInput(e.target.value)}
                      className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-contacts-auto-fill-button]:hidden [&::-ms-reveal]:hidden"
                      placeholder="••••••"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Enter PIN"
                      aria-required="true"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPin ? 'Hide PIN value' : 'Show PIN value'}
                    >
                      {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-center gap-2" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all ${pin.length > i ? 'bg-blue-600 scale-110' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
              {isCreating && (
                <div className="flex justify-center gap-2" aria-hidden="true">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all ${confirmPin.length > i ? 'bg-green-600 scale-110' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {isCreating && (
              <div className="text-center text-sm text-gray-600" role="status" aria-live="polite">
                {pinMismatch ? 'PINs do not match' : 'Create and confirm the same 6-digit PIN to continue'}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (isCreating ? pin.length !== 6 || confirmPin.length !== 6 : pin.length !== 6)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2" role="status" aria-live="polite">
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

            {!isCreating && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleForgotPin}
                  disabled={isResettingPin || isLoggingOut || isLoading}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <KeyRound size={18} />
                  {isResettingPin ? 'Resetting PIN...' : 'Forgot PIN'}
                </button>
                <button
                  type="button"
                  onClick={handleUseDifferentAccount}
                  disabled={isResettingPin || isLoggingOut || isLoading}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:text-gray-400"
                >
                  <LogOut size={18} />
                  {isLoggingOut ? 'Signing out...' : 'Different account'}
                </button>
              </div>
            )}

            {!isCreating && showResetConfirmation && (
              <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="text-sm text-amber-900">
                  <p className="text-base font-semibold">Reset this account PIN?</p>
                  <p className="mt-1 leading-7 text-amber-800">
                    This will remove the current PIN, sign you out, and require a fresh login before creating a new PIN.
                  </p>
                </div>
                {resetErrorMessage && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{resetErrorMessage}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmResetPin}
                    disabled={isResettingPin || isLoggingOut || isLoading}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-amber-700 disabled:bg-amber-300"
                  >
                    <KeyRound size={18} />
                    {isResettingPin ? 'Resetting PIN...' : 'Confirm reset'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelReset}
                    disabled={isResettingPin || isLoggingOut || isLoading}
                    className="min-h-14 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Security Info */}
          <div className="mt-6 rounded-2xl bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="mb-1 font-medium">Your data is secure</p>
                <p className="leading-7 text-blue-700">
                  Financial data stays encrypted on this device, and the server only stores
                  PIN verification data plus encrypted recovery metadata for your devices.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-blue-100">
          <p>Privacy-first financial management</p>
        </div>
      </div>
    </div>
  );
};
