import React from 'react';
import { cn } from '@/lib/utils';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  required?: boolean;
}

/**
 * Standard labeled input with validation, prefix/suffix slots.
 */
export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, startAdornment, endAdornment, required, className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 leading-none">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        <div
          className={cn(
            'flex items-center gap-2 w-full rounded-lg border bg-gray-50 px-3 py-2.5 transition-all',
            'focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400 focus-within:bg-white',
            error ? 'border-rose-400 bg-rose-50/50' : 'border-gray-200 hover:border-gray-300',
          )}
        >
          {startAdornment && <span className="text-gray-400 shrink-0 text-sm">{startAdornment}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 bg-transparent text-gray-900 text-sm font-medium outline-none placeholder:text-gray-400 placeholder:font-normal',
              className,
            )}
            {...props}
          />
          {endAdornment && <span className="text-gray-400 shrink-0 text-sm">{endAdornment}</span>}
        </div>
        {error && (
          <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  },
);
InputField.displayName = 'InputField';

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const TextAreaField = React.forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, required, className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 leading-none">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900',
            'placeholder:text-gray-400 placeholder:font-normal outline-none resize-none transition-all',
            'focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 focus:bg-white',
            error ? 'border-rose-400 bg-rose-50/50' : 'border-gray-200 hover:border-gray-300',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  },
);
TextAreaField.displayName = 'TextAreaField';

interface AmountFieldProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  currency: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

export const AmountField: React.FC<AmountFieldProps> = ({
  label = 'Amount',
  value,
  onChange,
  currency,
  error,
  placeholder = '0.00',
  required,
}) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-gray-700 leading-none">
      {label}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-gray-50 px-3 py-2.5 transition-all',
        'focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400 focus-within:bg-white',
        error ? 'border-rose-400' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <span className="text-sm font-bold text-gray-500 shrink-0">{currency}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
        required={required}
      />
    </div>
    {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
  </div>
);
