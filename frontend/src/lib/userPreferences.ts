type JsonRecord = Record<string, any>;

export type StoredUserSettings = JsonRecord & {
  currency?: string;
  defaultCurrency?: string;
  language?: string;
  languageLabel?: string;
  country?: string;
  monthlyBudget?: number;
  timezone?: string;
  settings?: JsonRecord | string;
};

export const DEFAULT_APP_CURRENCY = 'INR';
export const DEFAULT_APP_LANGUAGE = 'en';

const COUNTRY_ALIASES: Record<string, string> = {
  in: 'India',
  india: 'India',
  us: 'United States',
  usa: 'United States',
  'united states': 'United States',
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  'great britain': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  ca: 'Canada',
  canada: 'Canada',
  au: 'Australia',
  australia: 'Australia',
  ae: 'United Arab Emirates',
  uae: 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  sg: 'Singapore',
  singapore: 'Singapore',
};

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  India: 'INR',
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Canada: 'CAD',
  Australia: 'AUD',
  'United Arab Emirates': 'AED',
  Singapore: 'SGD',
  Other: 'USD',
};

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  India: 'Asia/Kolkata',
  'United States': 'America/New_York',
  'United Kingdom': 'Europe/London',
  Canada: 'America/Toronto',
  Australia: 'Australia/Sydney',
  'United Arab Emirates': 'Asia/Dubai',
  Singapore: 'Asia/Singapore',
};

const LANGUAGE_CODE_MAP: Record<string, string> = {
  english: 'en',
  en: 'en',
  hindi: 'hi',
  hi: 'hi',
  spanish: 'es',
  es: 'es',
  french: 'fr',
  fr: 'fr',
  arabic: 'ar',
  ar: 'ar',
  other: 'en',
};

function toJsonRecord(value: unknown): JsonRecord {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    } catch {
      return {};
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function normalizeCurrency(value?: string | null): string | undefined {
  const normalized = (value || '').trim().toUpperCase();
  return normalized ? normalized : undefined;
}

function normalizeBudget(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function normalizeCountryName(country?: string | null): string {
  const trimmed = (country || '').trim();
  if (!trimmed) {
    return '';
  }

  return COUNTRY_ALIASES[trimmed.toLowerCase()] || trimmed;
}

export function resolveCurrencyFromCountry(country?: string | null): string {
  const normalizedCountry = normalizeCountryName(country);
  return COUNTRY_CURRENCY_MAP[normalizedCountry] || DEFAULT_APP_CURRENCY;
}

export function resolveLanguageCode(language?: string | null): string {
  const normalized = (language || '').trim().toLowerCase();
  return LANGUAGE_CODE_MAP[normalized] || DEFAULT_APP_LANGUAGE;
}

export function resolveTimezoneFromCountry(country?: string | null): string {
  const normalizedCountry = normalizeCountryName(country);
  if (COUNTRY_TIMEZONE_MAP[normalizedCountry]) {
    return COUNTRY_TIMEZONE_MAP[normalizedCountry];
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function parseStoredUserSettings(rawValue?: string | null): StoredUserSettings {
  const parsed = toJsonRecord(rawValue);
  const nestedSettings = toJsonRecord(parsed.settings);

  const country = normalizeCountryName(
    String(parsed.country ?? nestedSettings.country ?? '').trim(),
  );
  const currency = normalizeCurrency(
    String(parsed.currency ?? nestedSettings.currency ?? parsed.defaultCurrency ?? nestedSettings.defaultCurrency ?? '').trim(),
  );
  const defaultCurrency = normalizeCurrency(
    String(parsed.defaultCurrency ?? nestedSettings.defaultCurrency ?? parsed.currency ?? nestedSettings.currency ?? '').trim(),
  );
  const languageLabel = String(parsed.languageLabel ?? nestedSettings.languageLabel ?? '').trim();
  const language = resolveLanguageCode(
    String(parsed.language ?? nestedSettings.language ?? languageLabel).trim(),
  );

  return {
    ...nestedSettings,
    ...parsed,
    currency,
    defaultCurrency: defaultCurrency || currency,
    language,
    languageLabel,
    country,
    monthlyBudget: normalizeBudget(parsed.monthlyBudget ?? nestedSettings.monthlyBudget),
    timezone: String(parsed.timezone ?? nestedSettings.timezone ?? '').trim(),
    settings: nestedSettings,
  };
}

export function buildOnboardingUserSettings(input: {
  country?: string | null;
  language?: string | null;
  monthlyBudget?: number;
}): StoredUserSettings {
  const country = normalizeCountryName(input.country);
  const currency = resolveCurrencyFromCountry(country);
  const language = resolveLanguageCode(input.language);

  return {
    currency,
    defaultCurrency: currency,
    language,
    languageLabel: String(input.language || '').trim(),
    country,
    monthlyBudget: Number.isFinite(input.monthlyBudget) ? Number(input.monthlyBudget) : 0,
    timezone: resolveTimezoneFromCountry(country),
  };
}

export function readStoredAppPreferences(): {
  currency: string;
  language: string;
  settings: StoredUserSettings;
} {
  const storedSettings = parseStoredUserSettings(localStorage.getItem('user_settings'));
  const directCurrency = normalizeCurrency(localStorage.getItem('currency'));
  const directLanguage = resolveLanguageCode(localStorage.getItem('language'));

  const currency = storedSettings.currency || storedSettings.defaultCurrency || directCurrency || DEFAULT_APP_CURRENCY;
  const language = storedSettings.language || directLanguage || DEFAULT_APP_LANGUAGE;

  return {
    currency,
    language,
    settings: {
      ...storedSettings,
      currency,
      defaultCurrency: currency,
      language,
    },
  };
}

export function mergeStoredUserSettings(updates: Partial<StoredUserSettings>): StoredUserSettings {
  const current = parseStoredUserSettings(localStorage.getItem('user_settings'));
  const merged = {
    ...current,
    ...updates,
  };

  const normalizedCountry = normalizeCountryName(merged.country);
  const currency = normalizeCurrency(merged.currency || merged.defaultCurrency) || DEFAULT_APP_CURRENCY;
  const language = resolveLanguageCode(merged.language || merged.languageLabel);

  return {
    ...merged,
    currency,
    defaultCurrency: currency,
    language,
    languageLabel: String(merged.languageLabel || '').trim(),
    country: normalizedCountry,
    monthlyBudget: normalizeBudget(merged.monthlyBudget),
    timezone: String(merged.timezone || resolveTimezoneFromCountry(normalizedCountry)).trim(),
  };
}

export function toSettingsPayload(settings: StoredUserSettings): JsonRecord {
  const nestedSettings = toJsonRecord(settings.settings);
  const payload: JsonRecord = {
    ...nestedSettings,
  };

  if (settings.country) {
    payload.country = settings.country;
  }

  if (settings.currency || settings.defaultCurrency) {
    payload.defaultCurrency = settings.currency || settings.defaultCurrency;
  }

  if (settings.languageLabel) {
    payload.languageLabel = settings.languageLabel;
  }

  if (typeof settings.monthlyBudget === 'number' && Number.isFinite(settings.monthlyBudget)) {
    payload.monthlyBudget = settings.monthlyBudget;
  }

  if (settings.timezone) {
    payload.timezone = settings.timezone;
  }

  return payload;
}
