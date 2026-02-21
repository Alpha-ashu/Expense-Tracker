// Service Worker Management Utilities
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
        console.log('Service worker unregistered:', registration.scope);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }
  return false;
};

export const clearServiceWorkerCache = async (): Promise<boolean> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log('Cache deleted:', cacheName);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to clear service worker cache:', error);
      return false;
    }
  }
  return false;
};

export const resetServiceWorker = async (): Promise<boolean> => {
  console.log('Resetting service worker...');
  
  const unregistered = await unregisterServiceWorker();
  const cacheCleared = await clearServiceWorkerCache();
  
  if (unregistered && cacheCleared) {
    console.log('Service worker reset successfully');
    // Reload the page to ensure clean state
    window.location.reload();
    return true;
  }
  
  return false;
};

// Check if service worker is causing issues
export const diagnoseServiceWorkerIssues = (): {
  hasServiceWorker: boolean;
  hasCache: boolean;
  isDevMode: boolean;
  recommendations: string[];
} => {
  const recommendations: string[] = [];
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasCache = 'caches' in window;
  const isDevMode = import.meta.env.DEV;
  
  if (isDevMode && hasServiceWorker) {
    recommendations.push('Consider disabling service worker in development');
  }
  
  if (window.location.search.includes('confirm-email') && hasServiceWorker) {
    recommendations.push('Service worker may interfere with email confirmation');
  }
  
  return {
    hasServiceWorker,
    hasCache,
    isDevMode,
    recommendations,
  };
};

// Force reload without service worker
export const reloadWithoutServiceWorker = (): void => {
  // Unregister service worker and reload
  unregisterServiceWorker().then(() => {
    window.location.reload();
  });
};
