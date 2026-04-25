const SUPABASE_UNAVAILABLE_TTL_MS = 30_000;

const missingSupabaseTables = new Set<string>();
let supabaseUnavailableUntil = 0;

const CONNECTIVITY_PATTERNS = [
  'failed to fetch',
  'network',
  'timeout',
  'timed out',
  'err_name_not_resolved',
  'err_connection_refused',
  'load failed',
];

const normalizeText = (value: unknown): string => String(value || '').toLowerCase();

export const isSupabaseConnectivityError = (error: unknown): boolean => {
  if (!(error instanceof Error) && typeof error !== 'object') {
    return false;
  }

  const message = normalizeText((error as any)?.message);
  const details = normalizeText((error as any)?.details);
  const hint = normalizeText((error as any)?.hint);
  const name = normalizeText((error as any)?.name);

  return CONNECTIVITY_PATTERNS.some((pattern) =>
    message.includes(pattern)
    || details.includes(pattern)
    || hint.includes(pattern)
    || name.includes(pattern)
  );
};

export const markSupabaseTemporarilyUnavailable = (
  error?: unknown,
  ttlMs: number = SUPABASE_UNAVAILABLE_TTL_MS,
): void => {
  if (error && !isSupabaseConnectivityError(error)) {
    return;
  }

  supabaseUnavailableUntil = Date.now() + ttlMs;
};

export const clearSupabaseTemporaryUnavailable = (): void => {
  supabaseUnavailableUntil = 0;
};

export const shouldSkipDirectSupabaseRequests = (): boolean =>
  supabaseUnavailableUntil > Date.now();

const extractMissingTableName = (error: unknown): string | null => {
  const haystack = [
    normalizeText((error as any)?.message),
    normalizeText((error as any)?.details),
    normalizeText((error as any)?.hint),
  ].join(' ');

  const publicMatch = haystack.match(/public\.([a-z0-9_]+)/i);
  if (publicMatch?.[1]) {
    return publicMatch[1];
  }

  const relationMatch = haystack.match(/relation\s+["']?([a-z0-9_.]+)["']?\s+does not exist/i);
  if (relationMatch?.[1]) {
    return relationMatch[1].split('.').pop() ?? null;
  }

  return null;
};

export const isSupabaseMissingTableError = (error: unknown, expectedTable?: string): boolean => {
  const code = String((error as any)?.code || '');
  const status = Number((error as any)?.status || 0);
  const message = normalizeText((error as any)?.message);
  const details = normalizeText((error as any)?.details);
  const hint = normalizeText((error as any)?.hint);
  const extractedTable = extractMissingTableName(error);
  const normalizedExpected = expectedTable?.toLowerCase();

  const mentionsExpectedTable = !normalizedExpected
    || extractedTable === normalizedExpected
    || message.includes(normalizedExpected)
    || details.includes(normalizedExpected)
    || hint.includes(normalizedExpected);

  if (!mentionsExpectedTable) {
    return false;
  }

  return (
    code === 'PGRST205'
    || code === '42P01'
    || message.includes('could not find the table')
    || message.includes('schema cache')
    || message.includes('does not exist')
    || (status === 404 && Boolean(extractedTable || normalizedExpected))
  );
};

export const rememberMissingSupabaseTable = (table: string, error: unknown): boolean => {
  const normalizedTable = table.toLowerCase();
  if (!isSupabaseMissingTableError(error, normalizedTable)) {
    return false;
  }

  if (!missingSupabaseTables.has(normalizedTable)) {
    missingSupabaseTables.add(normalizedTable);
    console.info(`ℹ️ Supabase table '${normalizedTable}' is unavailable. Falling back to local-only mode for that data.`);
  }

  return true;
};

export const isSupabaseTableUnavailable = (table: string): boolean =>
  missingSupabaseTables.has(table.toLowerCase());

export const filterAvailableSupabaseTables = <T extends string>(tables: T[]): T[] =>
  tables.filter((table) => !isSupabaseTableUnavailable(table));
