import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Fingerprint, Shield } from 'lucide-react';
import { isPINSet, verifyPIN, storeMasterKey, backupPINKeys, restorePINKeys } from '@/lib/encryption';
import supabase from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

interface PINAuthProps {
  onAuthenticated: (encryptionKey: string) => void;
}

const USER_PINS_UNAVAILABLE_KEY = 'supabase_user_pins_unavailable';

let userPinsUnavailableInMemory = false;
let userPinsUnavailableLogged = false;
const remotePinLookupCache = new Map<string, Promise<{ pinHash: string | null; tableUnavailable: boolean }>>();

const isUserPinsTableMissingError = (error: any) => {
  const errorText = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return error?.status === 404 ||
    error?.code === 'PGRST205' ||
    errorText.includes('user_pins') ||
    errorText.includes('relation') ||
    errorText.includes('not found');
};

const isUserPinsTableUnavailable = () => {
  if (userPinsUnavailableInMemory) return true;

  try {
    userPinsUnavailableInMemory = sessionStorage.getItem(USER_PINS_UNAVAILABLE_KEY) === 'true';
  } catch {
    userPinsUnavailableInMemory = false;
  }

  return userPinsUnavailableInMemory;
};

const markUserPinsTableUnavailable = () => {
  userPinsUnavailableInMemory = true;

  try {
    sessionStorage.setItem(USER_PINS_UNAVAILABLE_KEY, 'true');
  } catch {
    // Ignore storage failures and keep the in-memory flag.
  }

  if (!userPinsUnavailableLogged) {
    console.info('ℹ️ user_pins table unavailable — using local PIN only.');
    userPinsUnavailableLogged = true;
  }
};

const loadRemotePinHash = async (userId: string) => {
  if (isUserPinsTableUnavailable()) {
    return { pinHash: null, tableUnavailable: true };
  }

  const cachedLookup = remotePinLookupCache.get(userId);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookupPromise = (async () => {
    const { data, error } = await supabase
      .from('user_pins')
      .select('pin_hash')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isUserPinsTableMissingError(error)) {
        markUserPinsTableUnavailable();
        return { pinHash: null, tableUnavailable: true };
      }

      console.warn('PIN lookup from Supabase failed; continuing with local PIN only.', error);
      return { pinHash: null, tableUnavailable: false };
    }

    return { pinHash: data?.pin_hash ?? null, tableUnavailable: false };
  })();

  remotePinLookupCache.set(userId, lookupPromise);
  return lookupPromise;
};

export const PINAuth: React.FC<PINAuthProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initPin = async () => {
      // If PIN is already set locally, just prompt for verification
      if (isPINSet()) {
        if (isMounted) setIsCreating(false);
      } else {
        // Cache was cleared OR this is a brand new user/device.
        // Attempt to fetch existing PIN from Supabase `user_pins`
        setIsLoading(true);
        try {
          if (isUserPinsTableUnavailable()) {
            if (isMounted) {
              setIsCreating(true);
              setIsLoading(false);
            }
            return;
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { pinHash, tableUnavailable } = await loadRemotePinHash(session.user.id);

            if (tableUnavailable) {
              if (isMounted) {
                setIsCreating(true);
                setIsLoading(false);
              }
              return;
            }

            if (pinHash && isMounted) {
              const [hash, salt] = pinHash.split('|');
              if (hash && salt) {
                restorePINKeys({ hash, salt });
                setIsCreating(false);
                setIsLoading(false);
                return;
              }
            }
          }
        } catch (error: any) {
          console.error('Failed to restore PIN from backend:', error);
        }
        if (isMounted) {
          setIsCreating(true);
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
        
        // Backup to Supabase so it survives cache clear
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id && !isUserPinsTableUnavailable()) {
            const backup = backupPINKeys(); 
            if (backup.hash && backup.salt) {
              const pinHashValue = `${backup.hash}|${backup.salt}`;
              const { error: backupError } = await supabase.from('user_pins').upsert({
                user_id: session.user.id,
                pin_hash: pinHashValue,
                expires_at: new Date('2099-01-01').toISOString(), // Required NOT NULL column
              });

              if (backupError) {
                if (isUserPinsTableMissingError(backupError)) {
                  markUserPinsTableUnavailable();
                } else {
                  console.warn('PIN backup to Supabase failed (working locally).', backupError);
                }
              }
            }
          }
        } catch (e) {
          console.warn("PIN backup to server failed (working locally)", e);
        }

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
          <h1 className="text-3xl font-bold text-white mb-2">Finora</h1>
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
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-contacts-auto-fill-button]:hidden [&::-ms-reveal]:hidden"
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
