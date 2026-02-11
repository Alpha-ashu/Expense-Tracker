import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/app/components/ui/button';
import { Search, Bell, Menu, ChevronLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { headerMenuItems } from '@/app/constants/navigation';
import { NotificationPopup } from '@/app/components/ui/NotificationPopup';
import { motion } from 'framer-motion';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children?: React.ReactNode; // For custom actions like "Add Account" if we choose to put them here
    showBack?: boolean; // Show back button
    backTo?: string; // Page to navigate to when back is clicked
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, children, showBack = false, backTo = 'dashboard' }) => {
    const { currentPage, setCurrentPage } = useApp();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notificationPopupOpen, setNotificationPopupOpen] = useState(false);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(3);

    // Mock recent notifications
    const [recentNotifications] = useState([
        {
            id: '1',
            type: 'transaction' as const,
            title: 'Transaction Recorded',
            description: 'Your expense of ₹500 for groceries has been recorded.',
            timestamp: new Date(Date.now() - 15 * 60000),
            icon: <span>📉</span>,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            id: '2',
            type: 'emi' as const,
            title: 'EMI Due Reminder',
            description: 'Your monthly EMI of ₹2,500 is due on Feb 10.',
            timestamp: new Date(Date.now() - 2 * 3600000),
            icon: <span>⚠️</span>,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
        {
            id: '3',
            type: 'investment' as const,
            title: 'Investment Update',
            description: 'Your mutual fund SIP of ₹5,000 has been invested.',
            timestamp: new Date(Date.now() - 8 * 3600000),
            icon: <span>📈</span>,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
    ]);

    // Play notification sound
    const playNotificationSound = () => {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.error('Failed to play notification sound:', error);
        }
    };

    // Handle notification popup open
    const handleNotificationClick = () => {
        setNotificationPopupOpen(true);
        // Clear unread count and play sound on first open
        if (unreadNotificationsCount > 0) {
            playNotificationSound();
            setUnreadNotificationsCount(0);
        }
    };

    // Handle profile click - navigate to user profile
    const handleProfileClick = () => {
        setCurrentPage('user-profile');
    };

    // Handle View All notifications
    const handleViewAllNotifications = () => {
        setCurrentPage('notifications');
    };

    const handleMenuItemClick = (itemId: string) => {
        setCurrentPage(itemId);
        setMobileMenuOpen(false);
    };

    return (
        <>
            {/* Notification Popup */}
            <NotificationPopup
                isOpen={notificationPopupOpen}
                onClose={() => setNotificationPopupOpen(false)}
                onViewAll={handleViewAllNotifications}
                notifications={recentNotifications}
            />

            {/* Top Header Row - Menu, Search, Bell, Profile */}
            <div className="flex items-center justify-between gap-3 lg:gap-4 mb-4">
                {/* Left: Menu and Search */}
                <div className="flex items-center gap-2 md:gap-3 lg:gap-4 flex-1">
                    {/* Mobile Menu Button */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <button className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Menu size={24} className="text-gray-900" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[280px] p-0 bg-white border-r border-gray-100 text-gray-900 z-[100]">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-gray-100">
                                    <h1 className="text-2xl font-bold font-display text-gray-900">FinanceLife</h1>
                                    <p className="text-sm text-gray-500 mt-1">Your Financial OS</p>
                                </div>

                                <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
                                    {headerMenuItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = currentPage === item.id;

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleMenuItemClick(item.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-colors ${isActive
                                                    ? 'bg-black text-white shadow-lg'
                                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                                    }`}
                                            >
                                                <Icon size={20} />
                                                <span className="font-bold text-sm">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Search */}
                    <div className="relative flex-1 group hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-hover:text-gray-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="pl-10 pr-4 py-3 bg-white rounded-2xl border-none shadow-inner w-full focus:ring-2 focus:ring-black/5 outline-none transition-all placeholder:text-gray-400 font-medium"
                        />
                    </div>
                </div>

                {/* Right: Bell and Profile */}
                <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
                    {/* Notification Bell */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleNotificationClick}
                        className="relative rounded-2xl bg-black text-white hover:bg-black/80 shadow-lg w-10 h-10 lg:w-12 lg:h-12 shrink-0 flex items-center justify-center transition-colors"
                    >
                        <Bell size={20} />
                        {/* Unread Badge */}
                        {unreadNotificationsCount > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-white shadow-lg"
                            />
                        )}
                    </motion.button>

                    {/* Profile Avatar */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleProfileClick}
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-gray-200 overflow-hidden border-2 border-white shadow-lg shrink-0 hover:shadow-xl transition-shadow"
                    >
                        <img
                            src="https://ui-avatars.com/api/?name=Jude+Kylian&background=0D8ABC&color=fff"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </motion.button>
                </div>
            </div>

            {/* Bottom Header Row - Title and Action Button */}
            <header className="flex items-center justify-between gap-4 mb-6 lg:mb-8">
                {/* Left: Title Section */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        {showBack && (
                            <button
                                onClick={() => setCurrentPage(backTo)}
                                className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors"
                                aria-label="Go back"
                            >
                                <ChevronLeft size={24} className="text-gray-900" />
                            </button>
                        )}
                        {icon && <div className="text-gray-900">{icon}</div>}
                        <h1 className="text-2xl lg:text-3xl font-display font-bold text-gray-900 tracking-tight">{title}</h1>
                    </div>
                    {subtitle && <p className={`text-gray-500 font-medium text-sm lg:text-base ${showBack ? 'ml-10' : ''}`}>{subtitle}</p>}
                </div>

                {/* Right: Action Button */}
                {children && (
                    <div className="flex-shrink-0">
                        {children}
                    </div>
                )}
            </header>
        </>
    );
};
