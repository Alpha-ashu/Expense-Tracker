export interface PinStatus {
  success: boolean;
  message: string;
  expiresAt?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
}

export interface PinVerifyRequest {
  pin: string;
  deviceId?: string;
}

class PinService {
  private readonly API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  /**
   * Create a new PIN for the user
   */
  async createPin(pin: string): Promise<PinStatus> {
    try {
      const response = await fetch(`${this.API_URL}/api/v1/pin/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ pin }),
      });

      const result: PinStatus = await response.json();
      
      if (result.success) {
        localStorage.setItem('pin_created', 'true');
        localStorage.setItem('pin_expires_at', result.expiresAt || '');
      }
      
      return result;
    } catch (error) {
      console.error('Create PIN error:', error);
      return {
        success: false,
        message: 'Failed to create PIN',
      };
    }
  }

  /**
   * Verify a user's PIN
   */
  async verifyPin(request: PinVerifyRequest): Promise<PinStatus> {
    try {
      const response = await fetch(`${this.API_URL}/api/v1/pin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(request),
      });

      const result: PinStatus = await response.json();
      
      if (result.success) {
        localStorage.setItem('pin_verified', 'true');
        localStorage.setItem('pin_last_verified', new Date().toISOString());
      }
      
      return result;
    } catch (error) {
      console.error('Verify PIN error:', error);
      return {
        success: false,
        message: 'Failed to verify PIN',
      };
    }
  }

  /**
   * Update an existing PIN
   */
  async updatePin(currentPin: string, newPin: string): Promise<PinStatus> {
    try {
      const response = await fetch(`${this.API_URL}/api/v1/pin/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const result: PinStatus = await response.json();
      
      if (result.success) {
        localStorage.setItem('pin_expires_at', result.expiresAt || '');
      }
      
      return result;
    } catch (error) {
      console.error('Update PIN error:', error);
      return {
        success: false,
        message: 'Failed to update PIN',
      };
    }
  }

  /**
   * Get PIN status and expiry information
   */
  async getPinStatus(): Promise<PinStatus> {
    try {
      const response = await fetch(`${this.API_URL}/api/v1/pin/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Get PIN status error:', error);
      return {
        success: false,
        message: 'Failed to get PIN status',
      };
    }
  }

  /**
   * Check if PIN is expiring soon (within 7 days)
   */
  async isPinExpiringSoon(): Promise<{ isExpiringSoon: boolean; daysRemaining: number }> {
    try {
      const response = await fetch(`${this.API_URL}/api/v1/pin/expiring-soon`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      const result = await response.json();
      return {
        isExpiringSoon: result.isExpiringSoon,
        daysRemaining: result.daysRemaining,
      };
    } catch (error) {
      console.error('Check PIN expiry error:', error);
      return {
        isExpiringSoon: false,
        daysRemaining: 0,
      };
    }
  }

  /**
   * Check if user has created a PIN locally
   */
  hasPin(): boolean {
    return localStorage.getItem('pin_created') === 'true';
  }

  /**
   * Check if PIN is currently verified (for session)
   */
  isPinVerified(): boolean {
    const lastVerified = localStorage.getItem('pin_last_verified');
    if (!lastVerified) return false;
    
    // PIN verification expires after 30 minutes of inactivity
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return new Date(lastVerified) > thirtyMinutesAgo;
  }

  /**
   * Clear PIN verification (force re-verification)
   */
  clearPinVerification(): void {
    localStorage.removeItem('pin_verified');
    localStorage.removeItem('pin_last_verified');
  }

  /**
   * Validate PIN format (6 digits)
   */
  static validatePinFormat(pin: string): boolean {
    return /^\d{6}$/.test(pin);
  }

  /**
   * Generate random PIN for testing
   */
  static generateRandomPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get days remaining until PIN expires
   */
  getPinDaysRemaining(): number {
    const expiresAt = localStorage.getItem('pin_expires_at');
    if (!expiresAt) return 0;
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Check if PIN has expired
   */
  isPinExpired(): boolean {
    return this.getPinDaysRemaining() <= 0;
  }

  /**
   * Clear all PIN data (logout)
   */
  clearPinData(): void {
    localStorage.removeItem('pin_created');
    localStorage.removeItem('pin_verified');
    localStorage.removeItem('pin_last_verified');
    localStorage.removeItem('pin_expires_at');
  }
}

export const pinService = new PinService();
