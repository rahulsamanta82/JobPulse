import crypto from 'crypto';

export interface DeduplicationInput {
  source: string;
  externalId?: string;
  companyName: string;
  title: string;
  location?: string;
  applyUrl?: string;
}

/**
 * Generates a stable, collision-resistant deterministic deduplication key.
 * Strategy:
 * 1. If a stable source + externalId exists, use hash(source + ":" + externalId.toLowerCase().trim()).
 * 2. If externalId is missing or generic, use hash(source + ":" + normalizedCompany + ":" + normalizedTitle + ":" + normalizedLocation + ":" + normalizedApplyUrl).
 */
export function generateDeduplicationKey(input: DeduplicationInput): string {
  const normSource = (input.source || 'unknown').toLowerCase().trim();

  if (input.externalId && input.externalId.trim().length > 0) {
    const raw = `${normSource}:id:${input.externalId.trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  const normCompany = (input.companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const normTitle = (input.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const normLoc = (input.location || 'remote')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // Normalize applyUrl by stripping query parameters and tracking tokens
  let normUrl = (input.applyUrl || '').trim();
  try {
    const parsed = new URL(normUrl);
    normUrl = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    normUrl = normUrl.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const payload = `${normSource}:${normCompany}:${normTitle}:${normLoc}:${normUrl}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
