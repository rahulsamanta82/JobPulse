/**
 * URL Validation utilities for backend ingestion & normalizers.
 * Strictly prevents placeholder domains (e.g. example.com, example.org)
 * or malformed protocols from persisting to the database.
 */

const BANNED_HOSTNAMES = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'www.example.org',
  'example.net',
  'www.example.net',
  'example.edu',
  'www.example.edu',
  'placeholder.com',
  'dummy.com',
  'sample.com',
  'test.com',
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
]);

/**
 * Validates that a URL is a real, valid HTTP/HTTPS endpoint and NOT a banned placeholder domain.
 */
export function isValidJobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('about:blank') ||
    lower.startsWith('data:') ||
    lower === '#'
  ) {
    return false;
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    if (
      BANNED_HOSTNAMES.has(hostname) ||
      hostname.endsWith('.example.com') ||
      hostname.endsWith('.example.org') ||
      hostname.endsWith('.example.net') ||
      hostname.endsWith('.example.edu')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the cleaned URL if valid, or null/empty if invalid or placeholder.
 */
export function sanitizeJobUrl(url?: string | null): string | null {
  if (isValidJobUrl(url)) {
    return url!.trim();
  }
  return null;
}
