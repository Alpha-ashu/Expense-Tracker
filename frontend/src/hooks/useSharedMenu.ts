import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarMenuItems, NavigationItem } from '@/app/constants/navigation';

const MENU_ORDER_KEY = 'sidebar_menu_order';

export const useSharedMenu = () => {
  const { currentPage, setCurrentPage, visibleFeatures } = useApp();
  const { role } = useAuth();
  const [orderedItems, setOrderedItems] = useState<NavigationItem[]>([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Listen for admin feature updates to refresh menu
  useEffect(() => {
    const handleAdminUpdate = () => {
      console.log('🔄 useSharedMenu: Admin feature update detected, refreshing menu');
      setUpdateTrigger(prev => prev + 1);
    };

    // BroadcastChannel for cross-tab sync
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('feature_settings_channel');
      broadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'FEATURE_UPDATE') {
          handleAdminUpdate();
        }
      });
    } catch {
      // BroadcastChannel not supported
    }

    window.addEventListener('adminFeatureUpdate', handleAdminUpdate);
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_global_feature_settings') {
        handleAdminUpdate();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('adminFeatureUpdate', handleAdminUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, []);

  // Filter menu items based on RBAC and user's feature visibility preferences
  const visibleMenuItems = useMemo(() => {
    console.log('🔍 useSharedMenu filtering - role:', role, 'visibleFeatures:', visibleFeatures, 'updateTrigger:', updateTrigger);
    
    return sidebarMenuItems.filter(item => {
      // If item has specific roles defined, check if user's role is in the list FIRST
      // This ensures role-based items are shown to authorized users regardless of feature toggle
      if (item.roles && item.roles.length > 0) {
        const hasRole = item.roles.includes(role);
        console.log(`📋 Role check for ${item.id}: roles=${item.roles.join(',')}, userRole=${role}, hasRole=${hasRole}`);
        return hasRole;
      }
      
      // For non-role-restricted items, check user's feature visibility preference
      const featureKey = item.feature as keyof typeof visibleFeatures;
      if (visibleFeatures[featureKey] === false) {
        return false;
      }
      
      // Items without roles are visible to everyone
      return true;
    });
  }, [role, visibleFeatures, updateTrigger]);

  // Load saved order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem(MENU_ORDER_KEY);
    if (savedOrder) {
      try {
        const orderIds: string[] = JSON.parse(savedOrder);
        // Reorder visible items based on saved order
        const reordered = [...visibleMenuItems].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          // If item not in saved order, put it at the end
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        setOrderedItems(reordered);
      } catch {
        setOrderedItems(visibleMenuItems);
      }
    } else {
      setOrderedItems(visibleMenuItems);
    }
  }, [visibleMenuItems]);

  // Save order to localStorage whenever it changes
  const handleReorder = useCallback((newOrder: NavigationItem[]) => {
    setOrderedItems(newOrder);
    const orderIds = newOrder.map(item => item.id);
    localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(orderIds));
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('menuOrderChanged', { detail: newOrder }));
  }, []);

  // Listen for order changes from other components
  useEffect(() => {
    const handleOrderChange = (event: CustomEvent<NavigationItem[]>) => {
      setOrderedItems(event.detail);
    };

    window.addEventListener('menuOrderChanged', handleOrderChange as EventListener);
    return () => {
      window.removeEventListener('menuOrderChanged', handleOrderChange as EventListener);
    };
  }, []);

  const handleNavigate = useCallback((id: string) => {
    setCurrentPage(id);
  }, [setCurrentPage]);

  return {
    orderedItems,
    handleReorder,
    handleNavigate,
    currentPage,
  };
};
