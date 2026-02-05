// PWA Registration and Setup
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', registration.scope);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
              
              // Show update notification
              if (window.confirm('New version available! Reload to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

// Check if app is installed
export const isAppInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

// PWA Install Prompt
let deferredPrompt: any = null;

export const setupPWAInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    console.log('PWA install prompt available');
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
  });
};

export const showInstallPrompt = async (): Promise<boolean> => {
  if (!deferredPrompt) {
    console.log('Install prompt not available');
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User response to the install prompt: ${outcome}`);

  // We've used the prompt, can't use it again
  deferredPrompt = null;

  return outcome === 'accepted';
};

// Check if install prompt is available
export const canInstallPWA = (): boolean => {
  return deferredPrompt !== null;
};

// Network status detection
export const setupNetworkListener = (
  onOnline: () => void,
  onOffline: () => void
) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

export const isOnline = (): boolean => {
  return navigator.onLine;
};

// App lifecycle hooks
export const setupAppLifecycle = (callbacks: {
  onVisibilityChange?: (isVisible: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) => {
  const handleVisibilityChange = () => {
    if (callbacks.onVisibilityChange) {
      callbacks.onVisibilityChange(!document.hidden);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (callbacks.onFocus) {
    window.addEventListener('focus', callbacks.onFocus);
  }

  if (callbacks.onBlur) {
    window.addEventListener('blur', callbacks.onBlur);
  }

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (callbacks.onFocus) {
      window.removeEventListener('focus', callbacks.onFocus);
    }
    if (callbacks.onBlur) {
      window.removeEventListener('blur', callbacks.onBlur);
    }
  };
};
