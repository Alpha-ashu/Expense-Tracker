import crypto from 'crypto';

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

  // Generate new device ID
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const deviceId = `device_${timestamp}_${random}`;

  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('device_id', deviceId);
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
    appVersion: process.env.REACT_APP_VERSION || '1.0.0',
  };
}

/**
 * Clear device ID from localStorage
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('device_id');
  }
}
