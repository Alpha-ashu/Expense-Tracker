import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    showBack?: boolean;
    backTo?: string;
    onBack?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon,
    children,
    showBack = false,
    backTo = 'dashboard',
    onBack
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
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-8 pt-4">
            {/* Left: Title Section */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    {showBack && (
                        <button
                            onClick={handleBackClick}
                            className="p-2 -ml-2 hover:bg-gray-200 rounded-xl transition-colors shrink-0"
                            aria-label="Go back"
                        >
                            <ChevronLeft size={24} className="text-gray-900" />
                        </button>
                    )}
                    {icon && <div className="text-gray-900 shrink-0">{icon}</div>}
                    <h1 className="text-2xl lg:text-3xl font-display font-bold text-gray-900 tracking-tight truncate">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className={`text-gray-500 font-medium text-sm lg:text-base truncate ${showBack ? 'ml-10' : ''}`}>
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Right: Action Button */}
            {children && (
                <div className="flex-shrink-0">
                    {children}
                </div>
            )}
        </header>
    );
};
