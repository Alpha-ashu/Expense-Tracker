import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, KeyRound, AlertCircle, ChevronLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { FinoraLogo } from './ui/FinoraLogo';
import { clearSecurityData, isPINSet, verifyPIN, storeMasterKey, backupPINKeys, restorePINKeys } from '@/lib/encryption';
import { isPinMissing, isPinServiceUnavailable, pinService } from '@/services/pinService';
import { toast } from 'sonner';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { isGuestMode } from '@/lib/guestMode';

interface PINAuthProps {
  onAuthenticated: (encryptionKey: string) => void;
}

/* ─── Digit Box Component ─── */
const DigitBox: React.FC<{
  filled: boolean;
  active: boolean;
  shake: boolean;
  revealed?: string;
  error?: boolean;
}> = ({ filled, active, shake, revealed, error }) => (
  <div
    className={[
      'relative w-12 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-150',
      shake ? 'animate-[shake_0.4s_ease]' : '',
      error
        ? 'border-red-400 bg-red-50'
        : filled
        ? active
          ? 'border-blue-500 bg-blue-50 scale-105 shadow-md shadow-blue-100'
          : 'border-blue-400 bg-white'
        : active
        ? 'border-blue-400 bg-blue-50/60 shadow-sm'
        : 'border-gray-200 bg-gray-50',
    ].join(' ')}
  >
    {filled ? (
      revealed ? (
        <span className="text-xl font-bold text-gray-800 font-mono">{revealed}</span>
      ) : (
        <div className={`w-3 h-3 rounded-full ${error ? 'bg-red-400' : 'bg-blue-500'}`} />
      )
    ) : active ? (
      <div className="w-0.5 h-6 bg-blue-400 animate-[blink_1s_step-end_infinite] rounded-full" />
    ) : null}
  </div>
);

/* ─── Number Pad Button ─── */
const PadBtn: React.FC<{
  label: React.ReactNode;
  sublabel?: string;
  onClick: () => void;
  variant?: 'default' | 'action';
  disabled?: boolean;
}> = ({ label, sublabel, onClick, variant = 'default', disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      'flex flex-col items-center justify-center rounded-2xl h-16 w-full select-none transition-all duration-100 active:scale-95',
      variant === 'action'
        ? 'bg-transparent text-blue-600 hover:bg-blue-50 disabled:opacity-30'
        : 'bg-white border border-gray-100 shadow-sm hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 disabled:opacity-30',
    ].join(' ')}
  >
    <span className={`font-semibold leading-none ${variant === 'action' ? 'text-base' : 'text-2xl text-gray-800'}`}>
      {label}
    </span>
    {sublabel && <span className="text-[10px] text-gray-400 mt-0.5 tracking-widest uppercase">{sublabel}</span>}
  </button>
);

export const PINAuth: React.FC<PINAuthProps> = ({ onAuthenticated }) => {
  const { signOut, user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [createStage, setCreateStage] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // stores first entry during create
  const [showReveal, setShowReveal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);  // loading while checking server
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [resetError, setResetError] = useState('');

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Guest mode: no server calls — PIN is local only
        if (isGuestMode()) {
          if (mounted) {
            setIsCreating(!isPINSet());
            setIsLoading(false);
          }
          return;
        }

        const status = await pinService.getStatus();
        const hasLocalPin = isPINSet();

        if (status.success && !hasLocalPin) {
          const kbr = await pinService.getKeyBackup();
          if (kbr.success && kbr.backup) {
            const [hash, salt] = kbr.backup.split('|');
            if (hash && salt) restorePINKeys({ hash, salt });
          }
        }

        if (mounted) {
          const serverHasNoPin = isPinMissing(status) || !status.success;
          setIsCreating(serverHasNoPin && !hasLocalPin);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setIsCreating(!isPINSet());
          setIsLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Always focus hidden input on mount & when pin changes
  useEffect(() => {
    if (!isLoading) hiddenInputRef.current?.focus();
  }, [isLoading, isCreating, createStage]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 500);
  };

  const finalizeAuth = useCallback(async (key: string, msg: string) => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: 'user_authenticated', value: 'true' });
    }
    toast.success(msg);
    onAuthenticated(key);
  }, [onAuthenticated]);

  // ── PIN input handler (hidden input + numpad both write here) ──────────
  const appendDigit = (d: string) => {
    if (isSubmitting) return;
    setErrorMsg('');
    setPin(prev => prev.length < 6 ? prev + d : prev);
  };

  const deleteDigit = () => {
    if (isSubmitting) return;
    setErrorMsg('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleHiddenKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') { e.preventDefault(); deleteDigit(); }
    else if (/^\d$/.test(e.key)) { e.preventDefault(); appendDigit(e.key); }
    else if (e.key === 'Enter' && pin.length === 6) { e.preventDefault(); handleSubmit(); }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (pin.length === 6 && !isSubmitting) {
      const t = setTimeout(handleSubmit, 120);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // ── Submit logic ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (pin.length !== 6 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isCreating) {
        if (createStage === 'enter') {
          // Move to confirm stage
          setFirstPin(pin);
          setPin('');
          setCreateStage('confirm');
          setIsSubmitting(false);
          return;
        }

        // Confirm stage — check match
        if (pin !== firstPin) {
          triggerShake("PINs don't match. Try again.");
          setCreateStage('enter');
          setFirstPin('');
          setIsSubmitting(false);
          return;
        }

        // Server sync is best-effort — always proceed after PINs match.
        // Guest mode: skip server entirely.
        if (!isGuestMode()) {
          pinService.createPin(pin)
            .then(result => {
              if (result.success) {
                const backup = backupPINKeys();
                if (backup.hash && backup.salt) {
                  pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`).catch(() => {});
                }
              }
            })
            .catch(() => {});
        }

        const key = storeMasterKey(pin);
        await finalizeAuth(key, 'PIN created! Welcome to Kanakku 🎉');

      } else {
        // ── Verify existing PIN (local-first) ───────────────────────────────
        // Guest mode: verify locally only, no server call.
        const localResult = verifyPIN(pin);

        if (localResult.isValid && localResult.key) {
          // Local PIN correct — in non-guest mode also sync to server background
          if (!isGuestMode()) {
            pinService.verifyPin({ pin })
              .then(async serverResult => {
                if (!serverResult.success && isPinMissing(serverResult)) {
                  const repair = await pinService.createPin(pin);
                  if (repair.success) {
                    const backup = backupPINKeys();
                    if (backup.hash && backup.salt) {
                      pinService.saveKeyBackup(`${backup.hash}|${backup.salt}`).catch(() => {});
                    }
                  }
                }
              })
              .catch(() => {});
          }

          await finalizeAuth(localResult.key, 'Welcome back!');
          return;
        }

        // ── Local hash missing or mismatched — fall back to server ──────
        // (e.g. user cleared storage, or PIN was set on another device)
        const serverResult = await pinService.verifyPin({ pin });

        if (!serverResult.success) {
          if (isPinServiceUnavailable(serverResult)) {
            // Server down AND local failed → no way to verify
            triggerShake('Unable to verify PIN right now. Please try again.');
          } else {
            triggerShake('Incorrect PIN. Please try again.');
          }
          setIsSubmitting(false);
          return;
        }

        // Server verified → restore local keys from backup so future locks work
        const kbr = await pinService.getKeyBackup();
        if (kbr.success && kbr.backup) {
          const [hash, salt] = kbr.backup.split('|');
          if (hash && salt) restorePINKeys({ hash, salt });
        }
        const key = storeMasterKey(pin); // re-derive and store locally
        await finalizeAuth(key, 'Welcome back!');
      }
    } catch {
      triggerShake('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      setShowResetModal(false);
      pinService.clearPinData();
      clearSecurityData();
      await signOut();
    } catch {
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleForgotPin = () => { setResetError(''); setShowResetModal(true); };

  const handleConfirmReset = async () => {
    setIsResettingPin(true);
    try {
      const result = await pinService.resetCurrentUserPin();
      if (!result.success) { setResetError(result.message || 'Failed to reset PIN'); return; }
      clearSecurityData();
      await signOut();
      toast.success('PIN reset. Sign in again to set a new PIN.');
    } catch {
      setResetError('Failed to reset PIN. Please try again.');
    } finally {
      setIsResettingPin(false);
    }
  };

  // ── Derived display ────────────────────────────────────────────────────
  const currentStepLabel = isCreating
    ? createStage === 'enter' ? 'Create your PIN' : 'Confirm your PIN'
    : 'Enter your PIN';

  const currentStepSub = isCreating
    ? createStage === 'enter'
      ? 'Choose a 6-digit PIN to secure your account'
      : 'Re-enter the same PIN to confirm'
    : 'Enter your PIN to access Kanakku';

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a56f0]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <FinoraLogo className="w-9 h-9" />
          </div>
          <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#1a56f0] flex flex-col"
      onClick={() => hiddenInputRef.current?.focus()}
    >
      {/* Hidden form — captures keyboard input, visually invisible, no aria-hidden (would block focus/keyboard) */}
      <form
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}
        autoComplete="off"
        onSubmit={e => e.preventDefault()}
      >
        {/* Hidden username field — required by Chromium password manager heuristics */}
        <input
          type="text"
          name="username"
          value={user?.email || ''}
          readOnly
          autoComplete="username"
          tabIndex={-1}
        />
        {/* Actual PIN capture input — NOT aria-hidden so keyboard events are not blocked */}
        <input
          ref={hiddenInputRef}
          type="password"
          name="pin"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={() => {}}
          onKeyDown={handleHiddenKeyDown}
          tabIndex={0}
        />
      </form>

      {/* Header */}
      <div className="flex-none pt-10 pb-6 flex flex-col items-center px-6">
        {/* Logo */}
        <div className="w-20 h-20 rounded-[1.5rem] bg-white/15 backdrop-blur-sm flex items-center justify-center mb-5 shadow-lg shadow-blue-900/20">
          <FinoraLogo className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Kanakku</h1>
        <p className="text-blue-100 text-base text-center">{currentStepSub}</p>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col">
        <div className="mx-auto w-full max-w-sm px-4 flex flex-col gap-6">

          {/* Step label + back button for confirm stage */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-0.5">
                {isCreating ? `Step ${createStage === 'enter' ? '1' : '2'} of 2` : 'Secure Unlock'}
              </p>
              <h2 className="text-xl font-bold text-white">{currentStepLabel}</h2>
            </div>
            {isCreating && createStage === 'confirm' && (
              <button
                type="button"
                onClick={() => { setCreateStage('enter'); setPin(''); setFirstPin(''); setErrorMsg(''); }}
                className="flex items-center gap-1 text-blue-200 hover:text-white text-sm font-medium transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>

          {/* PIN digit boxes */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <DigitBox
                key={i}
                filled={i < pin.length}
                active={i === pin.length}
                shake={shake}
                error={!!errorMsg && shake}
                revealed={showReveal && i < pin.length ? pin[i] : undefined}
              />
            ))}
          </div>

          {/* Show/hide toggle + error */}
          <div className="flex items-center justify-between -mt-2 px-1">
            <div className="h-5">
              {errorMsg && (
                <p className="text-red-300 text-sm font-medium flex items-center gap-1.5">
                  <AlertCircle size={13} /> {errorMsg}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowReveal(r => !r)}
              className="flex items-center gap-1 text-blue-200 hover:text-white text-xs font-medium transition-colors"
            >
              {showReveal ? <EyeOff size={13} /> : <Eye size={13} />}
              {showReveal ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <PadBtn key={n} label={n} onClick={() => appendDigit(String(n))} disabled={isSubmitting} />
            ))}
            {/* Bottom row */}
            {!isCreating ? (
              <PadBtn
                label={<KeyRound size={20} />}
                onClick={handleForgotPin}
                variant="action"
                disabled={isSubmitting}
              />
            ) : (
              <div /> /* empty cell */
            )}
            <PadBtn label={0} onClick={() => appendDigit('0')} disabled={isSubmitting} />
            <PadBtn
              label={
                isSubmitting
                  ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  : '⌫'
              }
              onClick={deleteDigit}
              variant="action"
              disabled={isSubmitting}
            />
          </div>

          {/* Sign out / different account */}
          {!isCreating && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut || isSubmitting}
              className="flex items-center justify-center gap-2 text-blue-200 hover:text-white text-sm font-medium transition-colors py-1"
            >
              <LogOut size={15} />
              {isLoggingOut ? 'Signing out…' : 'Use a different account'}
            </button>
          )}

          {/* Security banner */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex gap-3">
            <ShieldCheck className="text-blue-200 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-white text-sm font-semibold mb-0.5">Your data is secure</p>
              <p className="text-blue-200 text-xs leading-relaxed">
                Financial data stays encrypted on this device. Only PIN verification metadata is stored on the server.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none py-5 text-center">
        <p className="text-blue-300 text-xs">Privacy-first financial management</p>
      </div>

      {/* ── Forgot PIN modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
              <KeyRound className="text-amber-600" size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reset your PIN?</h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              This will clear your current PIN, sign you out, and let you create a new one after signing back in.
            </p>

            {resetError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                {resetError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetError(''); }}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResettingPin}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
              >
                {isResettingPin ? 'Resetting…' : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
