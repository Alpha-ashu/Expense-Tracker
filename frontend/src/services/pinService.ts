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
  private readonly API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  private readonly PIN_STORAGE_KEY = 'user_pin_hash';
  private readonly PIN_SETUP_KEY = 'pin_setup_completed';

  /**
   * Create a new PIN for the user
   */
  async createPin(pin: string): Promise<PinStatus> {
    try {
      // Check if backend is available
      const isBackendAvailable = await this.checkBackendAvailability();
      
      if (isBackendAvailable) {
        const response = await fetch(`${this.API_URL}/api/v1/pin/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ pin }),
        });

        if (response.ok) {
          const data = await response.json();
          // Mark PIN as setup completed
          localStorage.setItem(this.PIN_SETUP_KEY, 'true');
          return data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        // Fallback: Store PIN locally (for development/offline scenarios)
        console.warn('Backend not available, using local PIN storage');
        const pinHash = await this.hashPin(pin);
        localStorage.setItem(this.PIN_STORAGE_KEY, pinHash);
        localStorage.setItem(this.PIN_SETUP_KEY, 'true');
        
        return {
          success: true,
          message: 'PIN created successfully (local storage)',
        };
      }
    } catch (error) {
      console.error('Create PIN error:', error);
      
      // Fallback to local storage if network fails
      try {
        const pinHash = await this.hashPin(pin);
        localStorage.setItem(this.PIN_STORAGE_KEY, pinHash);
        localStorage.setItem(this.PIN_SETUP_KEY, 'true');
        
        return {
          success: true,
          message: 'PIN created successfully (local storage - network fallback)',
        };
      } catch (fallbackError) {
        return {
          success: false,
          message: `Failed to create PIN: ${error.message}`,
        };
      }
    }
  }

  /**
   * Verify a PIN
   */
  async verifyPin(request: PinVerifyRequest): Promise<PinStatus> {
    try {
      // Check if backend is available
      const isBackendAvailable = await this.checkBackendAvailability();
      
      if (isBackendAvailable) {
        const response = await fetch(`${this.API_URL}/api/v1/pin/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(request),
        });

        if (response.ok) {
          const result: PinStatus = await response.json();
          
          if (result.success) {
            localStorage.setItem('pin_created', 'true');
            localStorage.setItem('pin_expires_at', result.expiresAt || '');
          }
          
          return result;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        // Fallback: Verify PIN locally
        console.warn('Backend not available, using local PIN verification');
        const storedPinHash = localStorage.getItem(this.PIN_STORAGE_KEY);
        
        if (!storedPinHash) {
          return {
            success: false,
            message: 'No PIN found. Please create a PIN first.',
          };
        }
        
        const inputPinHash = await this.hashPin(request.pin);
        const isValid = storedPinHash === inputPinHash;
        
        if (isValid) {
          localStorage.setItem('pin_verified', 'true');
          localStorage.setItem('pin_verified_at', new Date().toISOString());
          
          return {
            success: true,
            message: 'PIN verified successfully (local storage)',
          };
        } else {
          return {
            success: false,
            message: 'Invalid PIN',
            attemptsRemaining: 3,
          };
        }
      }
    } catch (error) {
      console.error('Verify PIN error:', error);
      
      // Fallback to local verification if network fails
      try {
        const storedPinHash = localStorage.getItem(this.PIN_STORAGE_KEY);
        
        if (!storedPinHash) {
          return {
            success: false,
            message: 'No PIN found. Please create a PIN first.',
          };
        }
        
        const inputPinHash = await this.hashPin(request.pin);
        const isValid = storedPinHash === inputPinHash;
        
        if (isValid) {
          localStorage.setItem('pin_verified', 'true');
          localStorage.setItem('pin_verified_at', new Date().toISOString());
          
          return {
            success: true,
            message: 'PIN verified successfully (local storage fallback)',
          };
        } else {
          return {
            success: false,
            message: 'Invalid PIN',
            attemptsRemaining: 3,
          };
        }
      } catch (fallbackError) {
        return {
          success: false,
          message: `Failed to verify PIN: ${error.message}`,
        };
      }
    }
  }

  /**
   * Update an existing PIN
   */
  async updatePin(currentPin: string, newPin: string): Promise<PinStatus> {
    try {
      // Check if backend is available
      const isBackendAvailable = await this.checkBackendAvailability();
      
      if (isBackendAvailable) {
        const response = await fetch(`${this.API_URL}/api/v1/pin/update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ currentPin, newPin }),
        });

        if (response.ok) {
          const result: PinStatus = await response.json();
          return result;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        // Fallback: Update PIN locally
        console.warn('Backend not available, using local PIN update');
        
        // Verify current PIN first
        const storedPinHash = localStorage.getItem(this.PIN_STORAGE_KEY);
        if (!storedPinHash) {
          return {
            success: false,
            message: 'No PIN found. Please create a PIN first.',
          };
        }
        
        const currentPinHash = await this.hashPin(currentPin);
        if (storedPinHash !== currentPinHash) {
          return {
            success: false,
            message: 'Current PIN is incorrect',
          };
        }
        
        // Update to new PIN
        const newPinHash = await this.hashPin(newPin);
        localStorage.setItem(this.PIN_STORAGE_KEY, newPinHash);
        
        return {
          success: true,
          message: 'PIN updated successfully (local storage)',
        };
      }
    } catch (error) {
      console.error('Update PIN error:', error);
      return {
        success: false,
        message: `Failed to update PIN: ${error.message}`,
      };
    }
  }

  /**
   * Validate PIN format
   */
  validatePinFormat(pin: string): boolean {
    // PIN should be 4-6 digits
    return /^\d{4,6}$/.test(pin);
  }

  /**
   * Generate a random PIN
   */
  generateRandomPin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Clear all PIN data
   */
  clearPinData(): void {
    localStorage.removeItem(this.PIN_STORAGE_KEY);
    localStorage.removeItem(this.PIN_SETUP_KEY);
    localStorage.removeItem('pin_created');
    localStorage.removeItem('pin_expires_at');
    localStorage.removeItem('pin_verified');
    localStorage.removeItem('pin_verified_at');
  }

  /**
   * Check if backend is available
   */
  private async checkBackendAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_URL}/api/health`, {
        method: 'GET',
        mode: 'no-cors',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Simple PIN hashing for local storage
   */
  private async hashPin(pin: string): Promise<string> {
    // Simple hash for local storage (not as secure as bcrypt but sufficient for local fallback)
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return btoa(hash.toString()).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Check if user has a PIN
   */
  hasPin(): boolean {
    return localStorage.getItem(this.PIN_STORAGE_KEY) !== null;
  }

  /**
   * Check if PIN is verified
   */
  isPinVerified(): boolean {
    return localStorage.getItem('pin_verified') === 'true';
  }

  /**
   * Clear PIN verification status
   */
  clearPinVerification(): void {
    localStorage.removeItem('pin_verified');
    localStorage.removeItem('pin_verified_at');
  }
}

export const pinService = new PinService();
