import React from 'react';
import { Sparkles, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoSuggestTagProps {
  category: string;
  subcategory?: string;
  confidence?: number;
  onDismiss?: () => void;
  onEdit?: () => void;
  className?: string;
}

export const AutoSuggestTag: React.FC<AutoSuggestTagProps> = ({
  category, subcategory, confidence = 0, onDismiss, onEdit, className,
}) => {
  const pct = Math.round(confidence * 100);
  const hi = confidence >= 0.75;
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border',
      hi ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-amber-50 border-amber-200 text-amber-800',
      className,
    )}>
      <Sparkles size={13} className={hi ? 'text-indigo-500 shrink-0' : 'text-amber-500 shrink-0'} />
      <span className="flex items-center gap-1 flex-1 min-w-0 truncate">
        <span className="font-semibold">Detected:</span>
        <span className="truncate">{category}{subcategory ? `  ${subcategory}` : ''}</span>
        {pct > 0 && (
          <span className={cn('ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            hi ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600')}>
            {pct}%
          </span>
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button type="button" onClick={onEdit} title="Edit category"
            className={cn('flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide hover:bg-white/60 transition-colors',
              hi ? 'text-indigo-600' : 'text-amber-600')}>
            Edit <ChevronDown size={10} />
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} title="Dismiss" className="rounded-full p-0.5 hover:bg-white/60 transition-colors" aria-label="Dismiss">
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

export const CategoryBadge: React.FC<{ icon?: React.ReactNode; category: string; subcategory?: string; color?: string }> = ({
  icon, category, subcategory, color = '#6366f1',
}) => (
  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
    style={{ backgroundColor: `${color}18`, color }}>
    {icon && <span className="text-sm shrink-0">{icon}</span>}
    <span>{category}</span>
    {subcategory && <><span className="opacity-50"></span><span className="opacity-80">{subcategory}</span></>}
  </div>
);
