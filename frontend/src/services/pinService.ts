import {
  buildApiUrl,
  clearOptionalBackendUnavailable,
  getApiBaseCandidates,
  getConfiguredApiBase,
  markOptionalBackendUnavailable,
  shouldRetryWithLocalApiFallback,
  shouldSkipOptionalBackendRequests,
} from '@/lib/apiBase';
import supabase from '@/utils/supabase/client';

export interface PinStatus {
  success: boolean;
  message: string;
  expiresAt?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
  backup?: string;
  statusCode?: number;
}

export interface PinVerifyRequest {
  pin: string;
  deviceId?: string;
}

const PIN_NOT_SET_MESSAGE = /pin not set|no pin key backup found/i;
const PIN_SERVICE_FAILURE_MESSAGE = /(internal server error|http 5\d\d|network error|failed to fetch|request timeout|pin request failed)/i;

export const isPinMissing = (status?: PinStatus | null): boolean => {
  if (!status || status.success) {
    return false;
  }

  if (status.statusCode === 404) {
    return true;
  }

  return PIN_NOT_SET_MESSAGE.test(status.message);
};

export const isPinServiceUnavailable = (status?: PinStatus | null): boolean => {
  if (!status || status.success) {
    return false;
  }

  if (typeof status.statusCode === 'number') {
    return status.statusCode >= 500;
  }

  return PIN_SERVICE_FAILURE_MESSAGE.test(status.message);
};

class PinService {
  private readonly API_URL = getConfiguredApiBase();
  private readonly PIN_SETUP_KEY = 'pin_setup_completed';
  private readonly PIN_CREATED_KEY = 'pin_created';
  private readonly PIN_EXPIRES_KEY = 'pin_expires_at';
  private readonly PIN_VERIFIED_KEY = 'pin_verified';
  private readonly PIN_VERIFIED_AT_KEY = 'pin_verified_at';
  private readonly PIN_PENDING_SERVER_SYNC_KEY = 'pin_pending_server_sync';

  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return session.access_token;
      }
    } catch {
      // Fall back to locally stored tokens.
    }

    return (
      localStorage.getItem('auth_token')
      || localStorage.getItem('accessToken')
      || localStorage.getItem('token')
      || localStorage.getItem('authToken')
    );
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      statusCode: response.status,
    };
  }

  private async get(path: string): Promise<PinStatus> {
    const headers = await this.getAuthHeaders();
    if (!('Authorization' in headers)) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    if (shouldSkipOptionalBackendRequests(this.API_URL)) {
      return {
        success: false,
        message: 'Backend PIN service unavailable in development mode',
        statusCode: 503,
      };
    }

    try {
      const apiBases = getApiBaseCandidates(this.API_URL);

      for (let index = 0; index < apiBases.length; index += 1) {
        const apiBase = apiBases[index];
        try {
          const response = await fetch(buildApiUrl(apiBase, `/pin/${path}`), {
            method: 'GET',
            headers,
          });

          if (!response.ok && index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(response.status)) {
            markOptionalBackendUnavailable(apiBase);
            console.warn('PIN GET failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              status: response.status,
            });
            continue;
          }

          clearOptionalBackendUnavailable();
          return await this.parseResponse(response);
        } catch (error) {
          if (shouldRetryWithLocalApiFallback(undefined, error)) {
            markOptionalBackendUnavailable(apiBase);
          }

          if (index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(undefined, error)) {
            console.warn('PIN GET failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          throw error;
        }
      }

      return {
        success: false,
        message: 'PIN request failed',
      };
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

    this.clearPendingServerSync();
  }

  private async post(path: string, body: object): Promise<PinStatus> {
    const headers = await this.getAuthHeaders();
    if (!('Authorization' in headers)) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    if (shouldSkipOptionalBackendRequests(this.API_URL)) {
      return {
        success: false,
        message: 'Backend PIN service unavailable in development mode',
        statusCode: 503,
      };
    }

    try {
      const apiBases = getApiBaseCandidates(this.API_URL);

      for (let index = 0; index < apiBases.length; index += 1) {
        const apiBase = apiBases[index];
        try {
          const response = await fetch(buildApiUrl(apiBase, `/pin/${path}`), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (!response.ok && index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(response.status)) {
            markOptionalBackendUnavailable(apiBase);
            console.warn('PIN POST failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              status: response.status,
            });
            continue;
          }

          clearOptionalBackendUnavailable();
          return await this.parseResponse(response);
        } catch (error) {
          if (shouldRetryWithLocalApiFallback(undefined, error)) {
            markOptionalBackendUnavailable(apiBase);
          }

          if (index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(undefined, error)) {
            console.warn('PIN POST failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          throw error;
        }
      }

      return {
        success: false,
        message: 'PIN request failed',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error while contacting PIN service',
      };
    }
  }

  private async delete(path: string): Promise<PinStatus> {
    const headers = await this.getAuthHeaders();
    if (!('Authorization' in headers)) {
      return {
        success: false,
        message: 'Session expired. Please sign in again.',
      };
    }

    if (shouldSkipOptionalBackendRequests(this.API_URL)) {
      return {
        success: false,
        message: 'Backend PIN service unavailable in development mode',
        statusCode: 503,
      };
    }

    try {
      const apiBases = getApiBaseCandidates(this.API_URL);

      for (let index = 0; index < apiBases.length; index += 1) {
        const apiBase = apiBases[index];
        try {
          const response = await fetch(buildApiUrl(apiBase, `/pin/${path}`), {
            method: 'DELETE',
            headers,
          });

          if (!response.ok && index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(response.status)) {
            markOptionalBackendUnavailable(apiBase);
            console.warn('PIN DELETE failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              status: response.status,
            });
            continue;
          }

          clearOptionalBackendUnavailable();
          return await this.parseResponse(response);
        } catch (error) {
          if (shouldRetryWithLocalApiFallback(undefined, error)) {
            markOptionalBackendUnavailable(apiBase);
          }

          if (index < apiBases.length - 1 && shouldRetryWithLocalApiFallback(undefined, error)) {
            console.warn('PIN DELETE failed on configured API base, retrying local API fallback.', {
              apiBase,
              path,
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          throw error;
        }
      }

      return {
        success: false,
        message: 'PIN request failed',
      };
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

  markPinCreatedLocally(expiresAt?: string): void {
    this.persistPinState({
      success: true,
      message: 'PIN created locally',
      expiresAt,
    }, true);
  }

  markPinVerifiedLocally(): void {
    localStorage.setItem(this.PIN_VERIFIED_KEY, 'true');
    localStorage.setItem(this.PIN_VERIFIED_AT_KEY, new Date().toISOString());
  }

  markPendingServerSync(): void {
    localStorage.setItem(this.PIN_PENDING_SERVER_SYNC_KEY, 'true');
  }

  hasPendingServerSync(): boolean {
    return localStorage.getItem(this.PIN_PENDING_SERVER_SYNC_KEY) === 'true';
  }

  clearPendingServerSync(): void {
    localStorage.removeItem(this.PIN_PENDING_SERVER_SYNC_KEY);
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
    this.clearPendingServerSync();
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
