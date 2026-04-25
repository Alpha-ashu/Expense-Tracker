const DEFAULT_API_BASE = '/api/v1';
const LOCALHOST_BASE_REGEX = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i;
const OPTIONAL_BACKEND_UNAVAILABLE_TTL_MS = 30_000;
let optionalBackendUnavailableUntil = 0;

const normalizeBase = (base?: string | null): string =>
  (base || DEFAULT_API_BASE).replace(/\/+$/, '');

const isLocalDevBackendBase = (base: string): boolean =>
  base === DEFAULT_API_BASE || LOCALHOST_BASE_REGEX.test(base);

export const getConfiguredApiBase = (): string =>
  normalizeBase(import.meta.env.VITE_API_URL || DEFAULT_API_BASE);

export const getApiBaseCandidates = (preferredBase?: string): string[] => {
  const primaryBase = normalizeBase(preferredBase || getConfiguredApiBase());
  const candidates = [primaryBase];

  if (
    import.meta.env.DEV &&
    primaryBase !== DEFAULT_API_BASE &&
    LOCALHOST_BASE_REGEX.test(primaryBase)
  ) {
    candidates.push(DEFAULT_API_BASE);
  }

  return Array.from(new Set(candidates));
};

export const buildApiUrl = (base: string, endpoint: string): string => {
  const normalizedBase = normalizeBase(base);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
};

export const shouldSkipOptionalBackendRequests = (preferredBase?: string): boolean => {
  if (!import.meta.env.DEV || optionalBackendUnavailableUntil <= Date.now()) {
    return false;
  }

  return isLocalDevBackendBase(normalizeBase(preferredBase || getConfiguredApiBase()));
};

export const markOptionalBackendUnavailable = (
  preferredBase?: string,
  ttlMs: number = OPTIONAL_BACKEND_UNAVAILABLE_TTL_MS,
): void => {
  if (!import.meta.env.DEV) {
    return;
  }

  const normalizedBase = normalizeBase(preferredBase || getConfiguredApiBase());
  if (!isLocalDevBackendBase(normalizedBase)) {
    return;
  }

  optionalBackendUnavailableUntil = Date.now() + ttlMs;
};

export const clearOptionalBackendUnavailable = (): void => {
  optionalBackendUnavailableUntil = 0;
};

export const shouldRetryWithLocalApiFallback = (status?: number, error?: unknown): boolean => {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (typeof status === 'number') {
    return status >= 500 || status === 429;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('err_connection_refused')
  );
};
