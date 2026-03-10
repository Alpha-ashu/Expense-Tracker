/**
 * Input sanitization utilities.
 * Strips HTML tags and dangerous characters from user input
 * to prevent XSS when values are reflected in API responses.
 */

const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_CONTENT_REGEX = /<script[\s\S]*?<\/script>/gi;

/**
 * Strip all HTML tags from a string to prevent stored/reflected XSS.
 */
export function sanitize(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .replace(SCRIPT_CONTENT_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .trim();
}
