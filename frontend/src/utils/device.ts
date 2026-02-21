/**
 * Generate a unique device identifier based on browser/system information
 */
export function generateDeviceId(): string {
  // Try to get existing device ID from localStorage first
  if (typeof window !== 'undefined') {
    const existingId = localStorage.getItem('device_id');
    if (existingId) {
      return existingId;
    }
  }

  // Generate new device ID using browser-compatible crypto
  const timestamp = Date.now().toString();
  let random = '';
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      // Use browser crypto API
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      random = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback to Math.random() if crypto API not available
      random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  } catch (error) {
    console.warn('Crypto API not available, using fallback random generation');
    random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  const deviceId = `device_${timestamp}_${random}`;

  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('device_id', deviceId);
    } catch (error) {
      console.warn('Failed to store device ID in localStorage:', error);
    }
  }

  return deviceId;
}

/**
 * Get device information for registration
 */
export function getDeviceInfo(): {
  deviceId: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  platform?: string;
  appVersion?: string;
} {
  try {
    const deviceId = generateDeviceId();
    
    let deviceName = 'Unknown Device';
    let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    let platform = 'unknown';
    
    if (typeof navigator !== 'undefined') {
      deviceName = navigator.userAgent.includes('Mobile') 
        ? 'Mobile Device' 
        : 'Desktop Device';
      
      // Detect device type
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        if (/iPad/i.test(navigator.userAgent)) {
          deviceType = 'tablet';
        } else {
          deviceType = 'mobile';
        }
      } else {
        deviceType = 'desktop';
      }
      
      // Detect platform
      if (navigator.userAgent.includes('Windows')) platform = 'windows';
      else if (navigator.userAgent.includes('Mac')) platform = 'macos';
      else if (navigator.userAgent.includes('Linux')) platform = 'linux';
      else if (navigator.userAgent.includes('Android')) platform = 'android';
      else if (navigator.userAgent.includes('iOS')) platform = 'ios';
      else if (navigator.userAgent.includes('iPhone')) platform = 'ios';
      else platform = 'web';
    }

    return {
      deviceId,
      deviceName,
      deviceType,
      platform,
      appVersion: import.meta.env?.VITE_APP_VERSION || '1.0.0',
    };
  } catch (error) {
    console.warn('Error getting device info:', error);
    // Return fallback device info
    return {
      deviceId: `device_fallback_${Date.now()}`,
      deviceName: 'Unknown Device',
      deviceType: 'desktop',
      platform: 'web',
      appVersion: '1.0.0',
    };
  }
}

/**
 * Clear device ID from localStorage
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('device_id');
  }
}
