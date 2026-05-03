import React from 'react';
import { cn } from '@/lib/utils';

interface FormContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Optional right-side panel (desktop only) */
  sidePanel?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthMap = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
};

/**
 * Centered card layout for all Add/Input pages.
 * On desktop: white card, 600-800px wide, centered, shadow.
 * When sidePanel is provided: 2-column layout (form | panel).
 */
export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  className,
  sidePanel,
  maxWidth = 'md',
}) => {
  if (sidePanel) {
    return (
      <div className={cn('w-full mx-auto px-4 py-8', maxWidthMap[maxWidth === 'md' ? 'lg' : maxWidth], className)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/40 overflow-hidden">
            {children}
          </div>
          <div className="lg:sticky lg:top-6 space-y-4">
            {sidePanel}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full mx-auto px-4 py-8', maxWidthMap[maxWidth], className)}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/40 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

/** Sticky header for form pages */
export const FormHeader: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
}> = ({ icon, title, subtitle, actions, onBack }) => (
  <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10">
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shrink-0"
        aria-label="Go back"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
    )}
    {icon && (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
  </div>
);

/** Form body with consistent padding */
export const FormBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('p-6 space-y-5', className)}>{children}</div>
);

/** Form footer with action buttons */
export const FormFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/50', className)}>
    {children}
  </div>
);

/** Section divider with label */
export const FormSection: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <div className={cn('space-y-4', className)}>
    {title && (
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
    )}
    {children}
  </div>
);
