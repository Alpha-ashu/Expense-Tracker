import React from 'react';
import { Settings } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { sidebarMenuItems } from '@/app/constants/navigation';

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage } = useApp();
  const { role } = useAuth();

  // Filter menu items based on RBAC
  const visibleMenuItems = sidebarMenuItems.filter(item => {
    // If item has role restrictions, only show if user has that role
    if (item.roles && item.roles.length > 0) {
      return item.roles.includes(role);
    }
    // Otherwise show to everyone
    return true;
  });

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="h-full py-6 pl-4 pr-2 flex flex-col z-50"
    >
      <div className="flex-1 bg-white/80 backdrop-blur-xl border border-white/20 shadow-floating rounded-[30px] flex flex-col items-center py-6 w-24">
        <div className="mb-8">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl font-display">V</span>
          </div>
        </div>

        <nav className="flex-1 w-full px-4 space-y-4 flex flex-col items-center overflow-y-auto scrollbar-hide">
          <TooltipProvider delayDuration={0}>
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => setCurrentPage(item.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all relative group",
                        isActive
                          ? "bg-black text-white shadow-lg"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-black rounded-2xl z-0"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Icon size={24} className="relative z-10" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium bg-black text-white border-none ml-2">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        <div className="mt-auto px-4">
          <button
            onClick={() => setCurrentPage('settings')}
            className="w-12 h-12 flex items-center justify-center rounded-2xl text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};