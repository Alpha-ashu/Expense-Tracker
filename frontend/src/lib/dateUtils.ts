const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

export const parseDateInputValue = (value?: string | null): Date | null => {
  if (!value) return null;
  if (!DATE_ONLY_PATTERN.test(value)) {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return isValidDate(parsed) ? parsed : null;
};

export const coerceDate = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    if (!isValidDate(value)) return null;
    const isUtcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
    const isLocalMidnight = value.getHours() === 0 && value.getMinutes() === 0
      && value.getSeconds() === 0 && value.getMilliseconds() === 0;
    if (isUtcMidnight && !isLocalMidnight) {
      return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    }
    return value;
  }
  if (DATE_ONLY_PATTERN.test(value)) {
    return parseDateInputValue(value);
  }
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

export const toLocalDate = (value?: Date | string | null): Date | null => {
  const parsed = coerceDate(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const toLocalDateKey = (value?: Date | string | null): string | null => {
  const parsed = coerceDate(value);
  if (!parsed) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatLocalDate = (
  value: Date | string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const parsed = coerceDate(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, options);
};
