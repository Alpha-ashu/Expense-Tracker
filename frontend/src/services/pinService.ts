export interface PinStatus {
  success: boolean;
  message: string;
  expiresAt?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
  backup?: string;
}

export interface PinVerifyRequest {
  pin: string;
  deviceId?: string;
}

class PinService {
  private readonly API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
  private readonly PIN_SETUP_KEY = 'pin_setup_completed';
  private readonly PIN_CREATED_KEY = 'pin_created';
  private readonly PIN_EXPIRES_KEY = 'pin_expires_at';
  private readonly PIN_VERIFIED_KEY = 'pin_verified';
  private readonly PIN_VERIFIED_AT_KEY = 'pin_verified_at';

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private async parseResponse(response: Response): Promise<PinStatus> {
    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message =
      payload?.message ||
      payload?.error ||
      (response.ok ? 'Request completed successfully' : `HTTP ${response.status}: ${response.statusText}`);

    return {
      success: Boolean(payload?.success ?? response.ok),
      message,
      expiresAt: payload?.expiresAt,
      attemptsRemaining: payload?.attemptsRemaining,
      lockedUntil: payload?.lockedUntil,
      backup: payload?.backup,
    };
  }

  private async get(path: string): Promise<PinStatus> {
    if (!localStorage.getItem('auth_token')) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    try {
      const response = await fetch(`${this.API_URL}/pin/${path}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      return await this.parseResponse(response);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error while contacting PIN service',
      };
    }
  }

  private persistPinState(result: PinStatus, markSetup = false): void {
    if (!result.success) {
      return;
    }

    if (markSetup) {
      localStorage.setItem(this.PIN_SETUP_KEY, 'true');
      localStorage.setItem(this.PIN_CREATED_KEY, 'true');
    }

    if (result.expiresAt) {
      localStorage.setItem(this.PIN_EXPIRES_KEY, result.expiresAt);
    }
  }

  private async post(path: string, body: object): Promise<PinStatus> {
    if (!localStorage.getItem('auth_token')) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    try {
      const response = await fetch(`${this.API_URL}/pin/${path}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      return await this.parseResponse(response);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error while contacting PIN service',
      };
    }
  }

  private async delete(path: string): Promise<PinStatus> {
    if (!localStorage.getItem('auth_token')) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    try {
      const response = await fetch(`${this.API_URL}/pin/${path}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      return await this.parseResponse(response);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error while contacting PIN service',
      };
    }
  }

  /**
   * Create a new PIN for the user
   */
  async createPin(pin: string): Promise<PinStatus> {
    const result = await this.post('create', { pin });
    this.persistPinState(result, true);
    return result;
  }

  /**
   * Verify a PIN
   */
  async verifyPin(request: PinVerifyRequest): Promise<PinStatus> {
    const result = await this.post('verify', request);

    if (result.success) {
      this.persistPinState(result, true);
      localStorage.setItem(this.PIN_VERIFIED_KEY, 'true');
      localStorage.setItem(this.PIN_VERIFIED_AT_KEY, new Date().toISOString());
    } else {
      this.clearPinVerification();
    }

    return result;
  }

  /**
   * Update an existing PIN
   */
  async updatePin(currentPin: string, newPin: string): Promise<PinStatus> {
    const result = await this.post('update', { currentPin, newPin });
    if (result.success) {
      this.persistPinState(result, true);
      this.clearPinVerification();
    }
    return result;
  }

  async getStatus(): Promise<PinStatus> {
    const result = await this.get('status');
    this.persistPinState(result, result.success);
    return result;
  }

  async getKeyBackup(): Promise<PinStatus> {
    return this.get('key-backup');
  }

  async saveKeyBackup(backup: string): Promise<PinStatus> {
    return this.post('key-backup', { backup });
  }

  async clearKeyBackup(): Promise<PinStatus> {
    return this.delete('key-backup');
  }

  /**
   * Validate PIN format
   */
  validatePinFormat(pin: string): boolean {
    return /^\d{6}$/.test(pin);
  }

  /**
   * Generate a random PIN
   */
  generateRandomPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Clear all PIN data
   */
  clearPinData(): void {
    localStorage.removeItem(this.PIN_SETUP_KEY);
    localStorage.removeItem(this.PIN_CREATED_KEY);
    localStorage.removeItem(this.PIN_EXPIRES_KEY);
    this.clearPinVerification();
  }

  /**
   * Check if user has a PIN
   */
  hasPin(): boolean {
    return localStorage.getItem(this.PIN_SETUP_KEY) === 'true' || localStorage.getItem(this.PIN_CREATED_KEY) === 'true';
  }

  /**
   * Check if PIN is verified
   */
  isPinVerified(): boolean {
    return localStorage.getItem(this.PIN_VERIFIED_KEY) === 'true';
  }

  /**
   * Clear PIN verification status
   */
  clearPinVerification(): void {
    localStorage.removeItem(this.PIN_VERIFIED_KEY);
    localStorage.removeItem(this.PIN_VERIFIED_AT_KEY);
  }
}

export const pinService = new PinService();
