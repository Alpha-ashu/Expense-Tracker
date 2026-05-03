import React from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
    children: React.ReactNode;
    className?: string;
    /** If true, removes horizontal padding EUR" use for full-bleed sections */
    noPadding?: boolean;
}

/**
 * Standard page wrapper EUR" applied to every top-level page component.
 * Provides consistent:
 *  - Max content width (capped at 1400px, centered)
 *  - Horizontal padding (responsive: 16px ' 24px ' 32px ' 48px)
 *  - Bottom padding (for mobile bottom nav)
 *  - Background color
 */
export const PageWrapper: React.FC<PageWrapperProps> = ({ children, className, noPadding }) => (
    <div className={cn('w-full min-h-screen bg-white overflow-x-hidden', className)}>
        <div
            className={cn(
                'mx-auto w-full max-w-[1400px] pb-28 lg:pb-10',
                !noPadding && 'px-4 sm:px-6 lg:px-8 xl:px-10',
            )}
        >
            {children}
        </div>
    </div>
);

/**
 * Standard content section inside a page EUR" provides consistent top spacing.
 */
export const PageSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={cn('mt-6', className)}>
        {children}
    </div>
);

