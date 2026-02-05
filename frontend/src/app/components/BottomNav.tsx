import React from 'react';
import { 
  Home, 
  Wallet, 
  Receipt, 
  TrendingUp, 
  PieChart,
  Plus
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const navigationItems = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'quick-add', label: '', icon: Plus, isAction: true },
  { id: 'transactions', label: 'Activity', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: PieChart },
];

interface BottomNavProps {
  onQuickAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onQuickAdd }) => {
  const { currentPage, setCurrentPage, visibleFeatures } = useApp();

  const filteredNavigationItems = navigationItems.filter(item => {
    const featureMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'accounts': 'accounts',
      'transactions': 'transactions',
      'reports': 'reports',
      'quick-add': 'quick-add',
    };
    const featureKey = featureMap[item.id];
    if (item.id === 'dashboard' || item.id === 'quick-add') return true;
    return visibleFeatures[featureKey] !== false;
  });

  const handleNavigation = async (itemId: string) => {
    // Haptic feedback on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        // Haptics not available
      }
    }

    if (itemId === 'quick-add') {
      onQuickAdd();
    } else {
      setCurrentPage(itemId);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-safe z-40 lg:hidden">
      <div className="flex items-center justify-around h-16">
        {filteredNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isAction = item.isAction;

          if (isAction) {
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className="flex items-center justify-center w-14 h-14 -mt-6 bg-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                <Icon className="w-6 h-6 text-white" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};