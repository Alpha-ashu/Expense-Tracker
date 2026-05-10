import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    showBack?: boolean;
    backTo?: string;
    onBack?: () => void;
    className?: string;
}

export const PageHeaderCard: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon,
    children,
    showBack = false,
    backTo = 'dashboard',
    onBack,
    className
}) => {
    const { setCurrentPage } = useApp();

    const handleBackClick = () => {
        if (onBack) {
            onBack();
        } else {
            setCurrentPage(backTo);
        }
    };

    return (
        <header className={cn(
            "relative mb-8 w-full",
            className
        )}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    {showBack && (
                        <button
                            onClick={handleBackClick}
                            className="lg:hidden w-12 h-12 flex items-center justify-center bg-white shadow-md border border-slate-100 hover:bg-slate-50 rounded-2xl transition-all shrink-0 active:scale-95 group"
                            aria-label="Go back"
                        >
                            <ChevronLeft size={22} className="text-slate-700 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                    )}
                    <div className="flex items-center gap-5">
                        {icon && (
                            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 shrink-0">
                                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 28 }) : icon}
                            </div>
                        )}
                        <div>
                            <h1 className="text-3xl lg:text-[32px] font-black text-slate-900 tracking-tight leading-tight mb-1">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-sm font-bold text-slate-500 tracking-wide opacity-80">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {children && (
                    <div className="flex-shrink-0 w-full xl:w-auto overflow-x-auto hide-scrollbar pb-1 xl:pb-0">
                        {children}
                    </div>
                )}
            </div>
        </header>
    );
};

export const HeaderActions = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("flex flex-nowrap md:flex-wrap items-center gap-3", className)}>
        {children}
    </div>
);

export const SegmentedTabs = ({ tabs, activeTab, onChange }: { tabs: { id: string, label: string, icon?: React.ReactNode }[], activeTab: string, onChange: (id: string) => void }) => (
    <div className="p-1.5 bg-slate-100/60 backdrop-blur-md rounded-[20px] flex items-center gap-1 border border-slate-200/40 w-full md:w-auto overflow-x-auto hide-scrollbar shrink-0">
        {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "flex items-center justify-center gap-2 px-6 py-3 rounded-[16px] text-sm font-black transition-all whitespace-nowrap flex-1 md:flex-none uppercase tracking-wider",
                        isActive 
                            ? "bg-white text-indigo-700 shadow-[0_10px_20px_rgba(0,0,0,0.05)] border border-slate-100/50" 
                            : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                    )}
                >
                    {tab.icon && <span className={isActive ? "text-indigo-600" : "text-slate-400"}>{tab.icon}</span>}
                    {tab.label}
                </button>
            );
        })}
    </div>
);

export const PrimaryActionButton = ({ onClick, children, icon, className, variant = 'primary' }: { onClick?: () => void, children: React.ReactNode, icon?: React.ReactNode, className?: string, variant?: 'primary' | 'secondary' }) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-2 px-8 py-4 rounded-[20px] font-black transition-all active:scale-95 whitespace-nowrap shadow-xl shrink-0 uppercase tracking-widest text-[11px]",
                variant === 'primary' 
                    ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                    : "bg-white border-2 border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                className
            )}
        >
            {icon && <span>{icon}</span>}
            <span>{children}</span>
        </button>
    );
};

export const SearchHeader = ({ value, onChange, placeholder = "Search..." }: { value: string, onChange: (val: string) => void, placeholder?: string }) => (
    <div className="relative group min-w-[240px] md:min-w-[320px] shrink-0">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <Search size={18} strokeWidth={3} />
        </div>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-14 pl-14 pr-6 bg-slate-50 border-none rounded-[20px] focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold text-slate-900 placeholder:text-slate-400 transition-all shadow-inner"
        />
    </div>
);

// Lucide icon helper for internal use
const Search = ({ size, className, strokeWidth }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth={strokeWidth || 2} 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

// Alias PageHeader to PageHeaderCard for backward compatibility
export const PageHeader = PageHeaderCard;
