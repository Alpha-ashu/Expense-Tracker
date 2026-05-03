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
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 mb-6 lg:mb-8 pt-4">
            <div className="min-w-0">
                <div className="flex items-center gap-3">
                    {showBack && (
                        <button
                            onClick={handleBackClick}
                            className="lg:hidden p-2 -ml-2 hover:bg-gray-200 rounded-xl transition-colors shrink-0"
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
            </div>

            {children && (
                <div className="justify-self-end self-start flex-shrink-0">
                    {children}
                </div>
            )}

            {subtitle && (
                <p className={`col-span-full text-gray-500 font-medium text-sm lg:text-base ${showBack ? 'ml-10' : ''}`}>
                    {subtitle}
                </p>
            )}
        </header>
    );
};
