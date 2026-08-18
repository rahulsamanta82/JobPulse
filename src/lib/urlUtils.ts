/**
 * Known placeholder / non-production domains that should NEVER be used as active apply destinations.
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
 * Validates whether a URL is a legitimate, navigable HTTP/HTTPS production URL.
 * Rejects placeholder domains (e.g. example.com), javascript/about:blank pseudo-protocols,
 * and empty/malformed values.
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
 * Resolves the safest valid application destination URL.
 * Prioritizes applyUrl, then falls back to sourceUrl if valid.
 * Returns null if neither URL is valid or if it resolves to a placeholder domain.
 */
export function getSafeApplyUrl(applyUrl?: string | null, sourceUrl?: string | null): string | null {
  if (isValidJobUrl(applyUrl)) {
    return applyUrl!.trim();
  }
  if (isValidJobUrl(sourceUrl)) {
    return sourceUrl!.trim();
  }
  return null;
}
