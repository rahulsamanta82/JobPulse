import { z } from 'zod';
import { JobRecord, RemoteType, EmploymentType } from '../../../src/types/shared';
import { generateDeduplicationKey } from '../deduplication/deduplicator';
import { mapAdzunaJobToNormalized } from './adzunaMapper';
import { getAdzunaConfig } from '../../config/adzunaConfig';
import { isValidJobUrl } from './urlValidator';

// Helper for validating HTTP/HTTPS URLs flexibly and rejecting placeholder domains
const httpUrlSchema = z.string().refine(
  (val) => {
    return isValidJobUrl(val);
  },
  { message: 'Must be a valid HTTP or HTTPS production URL (placeholder domains rejected)' }
);

// Zod Schema for normalized Job validation
export const NormalizedJobSchema = z.object({
  externalId: z.string().min(1, 'External ID is required'),
  source: z.string().min(1, 'Source identifier is required'),
  title: z.string().min(1, 'Job title is required').max(500, 'Job title is too long'),
  companyName: z.string().min(1, 'Company name is required').max(300),
  companyLogoUrl: z.string().optional().nullable(),
  location: z.string().default('Remote'),
  description: z.string().min(1, 'Job description is required'),
  descriptionSnippet: z.string().max(600),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship', 'Other']),
  remoteType: z.enum(['Remote', 'Hybrid', 'On-site']),
  salary: z.string().optional().nullable(),
  applyUrl: httpUrlSchema,
  sourceUrl: httpUrlSchema,
  publishedAt: z.string(),
  categories: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  deduplicationKey: z.string().min(10),
  rawData: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export interface RawJobInput {
  id?: string | number;
  externalId?: string | number;
  source?: string;
  title?: string;
  job_title?: string;
  company?: string | { display_name?: string; [key: string]: unknown };
  companyName?: string;
  company_name?: string;
  logo?: string;
  company_logo?: string;
  companyLogoUrl?: string;
  location?: string | { display_name?: string; area?: string[]; [key: string]: unknown };
  candidate_required_location?: string;
  description?: string;
  job_description?: string;
  content?: string;
  'content:encoded'?: string;
  jobType?: string;
  job_type?: string;
  employment_type?: string;
  contract_type?: string;
  contract_time?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  redirect_url?: string;
  adref?: string;
  link?: string;
  guid?: string | { '#text'?: string };
  pubDate?: string;
  publication_date?: string;
  published_at?: string;
  date?: string;
  pubdate?: string;
  created?: string;
  tags?: string[] | string;
  categories?: string[] | string;
  category?: string | { label?: string; tag?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface NormalizationResult {
  success: boolean;
  job?: JobRecord;
  error?: {
    code: string;
    message: string;
    details?: any;
    rawSample?: string;
  };
}

/**
 * Strips HTML tags and unescapes common HTML entities for snippet generation.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes employment type from arbitrary text string
 */
export function normalizeEmploymentType(raw?: string): EmploymentType {
  if (!raw) return 'Full-time';
  const lower = raw.toLowerCase();
  if (lower.includes('contract') || lower.includes('freelance') || lower.includes('temporary')) return 'Contract';
  if (lower.includes('part_time') || lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
  if (lower.includes('intern') || lower.includes('internship') || lower.includes('apprenticeship')) return 'Internship';
  if (lower.includes('full_time') || lower.includes('full-time') || lower.includes('full time') || lower.includes('permanent')) return 'Full-time';
  return 'Full-time';
}

/**
 * Normalizes remote type from location and flags
 */
export function normalizeRemoteType(location?: string, rawType?: string, description?: string): RemoteType {
  const combined = `${location || ''} ${rawType || ''} ${description ? description.slice(0, 500) : ''}`.toLowerCase();

  if (combined.includes('hybrid')) return 'Hybrid';
  if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in-office') || combined.includes('office only') || combined.includes('office-based')) {
    return 'On-site';
  }
  if (combined.includes('remote') || combined.includes('anywhere') || combined.includes('work from home') || combined.includes('telecommute') || combined.includes('wfh')) {
    return 'Remote';
  }

  return 'Remote';
}

/**
 * Parses and extracts common tech skills
 */
const KNOWN_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Go', 'Rust', 'Java', 'Kotlin', 'Swift', 'AWS',
  'GCP', 'Azure', 'Docker', 'Kubernetes', 'GraphQL', 'REST', 'PostgreSQL', 'MongoDB', 'Redis',
  'Tailwind CSS', 'Next.js', 'Vue', 'Angular', 'DevOps', 'CI/CD', 'FastAPI', 'Django', 'Spring',
  'C++', 'C#', '.NET', 'Terraform', 'Kafka', 'SQL', 'NoSQL', 'Linux', 'Microservices', 'AI', 'LLM'
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSkills(text: string, existingTags: string[] = []): string[] {
  const found = new Set<string>();
  for (const t of existingTags) {
    if (typeof t === 'string' && t.trim().length > 1) {
      found.add(t.trim());
    }
  }

  const lowerText = ` ${text.toLowerCase()} `;
  for (const skill of KNOWN_SKILLS) {
    const escaped = escapeRegex(skill.toLowerCase());
    const pattern = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i');
    if (pattern.test(lowerText)) {
      found.add(skill);
    }
  }

  return Array.from(found).slice(0, 10);
}

/**
 * Normalizes raw job record from any source into the canonical JobRecord schema
 */
export function normalizeJob(raw: RawJobInput, sourceName: string): NormalizationResult {
  try {
    const source = sourceName || raw.source || 'unknown';

    // Route to dedicated Adzuna mapper if source is Adzuna
    if (source.toLowerCase().includes('adzuna') || (typeof raw.source === 'string' && raw.source.toLowerCase().includes('adzuna'))) {
      const config = getAdzunaConfig();
      return mapAdzunaJobToNormalized(raw as any, config.country);
    }

    // 1. Extract External ID
    let externalId = '';
    if (raw.id !== undefined && raw.id !== null) externalId = String(raw.id).trim();
    else if (raw.externalId !== undefined && raw.externalId !== null) externalId = String(raw.externalId).trim();
    else if (raw.guid) {
      externalId = typeof raw.guid === 'object' && raw.guid['#text'] ? String(raw.guid['#text']).trim() : String(raw.guid).trim();
    } else if (raw.url || raw.apply_url || raw.link || raw.redirect_url) {
      externalId = String(raw.url || raw.apply_url || raw.link || raw.redirect_url).trim();
    }

    if (!externalId) {
      return {
        success: false,
        error: {
          code: 'MISSING_EXTERNAL_ID',
          message: 'Job record is missing the required external ID field',
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    // 2. Extract Title
    const title = stripHtml(raw.title || raw.job_title || '').trim();
    if (!title) {
      return {
        success: false,
        error: {
          code: 'MISSING_TITLE',
          message: 'Job title is missing or empty',
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    // 3. Extract Company Name
    let companyName = 'Confidential Company';
    if (typeof raw.company === 'string' && raw.company.trim()) companyName = raw.company.trim();
    else if (raw.company && typeof raw.company === 'object' && raw.company.display_name) companyName = String(raw.company.display_name).trim();
    else if (raw.companyName) companyName = String(raw.companyName).trim();
    else if (raw.company_name) companyName = String(raw.company_name).trim();

    // 4. Extract Description
    let description = (raw.description || raw.job_description || '').trim();
    if (!description && raw.content) description = String(raw.content).trim();
    if (!description && raw['content:encoded']) description = String(raw['content:encoded']).trim();
    if (!description) description = title;

    // 5. Generate Snippet
    const plainText = stripHtml(description);
    const descriptionSnippet = plainText.length > 280 ? `${plainText.slice(0, 277)}...` : plainText;

    // 6. Extract Apply & Source URLs
    let applyUrl = String(raw.apply_url || raw.redirect_url || raw.url || raw.link || raw.adref || '').trim();
    if (typeof applyUrl === 'object' && applyUrl !== null && (applyUrl as any)['#text']) {
      applyUrl = String((applyUrl as any)['#text']).trim();
    }

    if (!isValidJobUrl(applyUrl)) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: `Invalid or missing applyUrl (placeholder or malformed domain rejected): ${applyUrl || 'empty'}`,
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    const rawSourceUrl = String(raw.url || raw.link || raw.redirect_url || applyUrl).trim();
    const sourceUrl = isValidJobUrl(rawSourceUrl) ? rawSourceUrl : applyUrl;

    // 7. Extract Dates
    let publishedAt: string;
    const rawDate = raw.pubDate || raw.publication_date || raw.published_at || raw.date || raw.pubdate || raw.created;
    if (rawDate) {
      const parsedDate = new Date(String(rawDate));
      publishedAt = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }

    const ingestedAt = new Date().toISOString();
    const updatedAt = ingestedAt;

    // 8. Location & Types
    let location = 'Remote / Worldwide';
    if (typeof raw.location === 'string' && raw.location.trim()) location = raw.location.trim();
    else if (raw.location && typeof raw.location === 'object' && raw.location.display_name) location = String(raw.location.display_name).trim();
    else if (raw.candidate_required_location) location = String(raw.candidate_required_location).trim();

    const employmentType = normalizeEmploymentType(String(raw.job_type || raw.jobType || raw.employment_type || raw.contract_type || ''));
    const remoteType = normalizeRemoteType(location, String(raw.job_type || ''), description);

    // 9. Categories & Skills
    let rawTags: string[] = [];
    if (Array.isArray(raw.tags)) rawTags = raw.tags.map(String);
    else if (typeof raw.tags === 'string') rawTags = raw.tags.split(',').map((s) => s.trim());
    if (Array.isArray(raw.categories)) rawTags.push(...raw.categories.map(String));
    if (typeof raw.category === 'string') rawTags.push(String(raw.category).trim());
    else if (raw.category && typeof raw.category === 'object' && raw.category.label) rawTags.push(String(raw.category.label).trim());

    const skills = extractSkills(`${title} ${plainText}`, rawTags);
    const categories = Array.from(new Set([...rawTags.map((t) => String(t).trim()), 'Technology'])).filter(Boolean).slice(0, 5);

    // 10. Deduplication Key
    const deduplicationKey = generateDeduplicationKey({
      source,
      externalId,
      companyName,
      title,
      location,
      applyUrl,
    });

    const candidateJob: JobRecord = {
      id: deduplicationKey,
      externalId,
      source,
      title,
      companyName,
      companyLogoUrl: raw.company_logo || raw.logo || raw.companyLogoUrl ? String(raw.company_logo || raw.logo || raw.companyLogoUrl) : undefined,
      location,
      description,
      descriptionSnippet,
      employmentType,
      remoteType,
      salary: raw.salary ? String(raw.salary).trim() : undefined,
      applyUrl,
      sourceUrl: sourceUrl.startsWith('http') ? sourceUrl : applyUrl,
      publishedAt,
      ingestedAt,
      updatedAt,
      categories,
      skills,
      deduplicationKey,
      rawData: { ...raw },
      status: 'ACTIVE',
    };

    // Validate with Zod
    const validated = NormalizedJobSchema.safeParse(candidateJob);
    if (!validated.success) {
      return {
        success: false,
        error: {
          code: 'SCHEMA_VALIDATION_FAILED',
          message: validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    return {
      success: true,
      job: candidateJob,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NORMALIZATION_EXCEPTION',
        message: err.message || 'Unknown normalization error',
        rawSample: JSON.stringify(raw).slice(0, 200),
      },
    };
  }
}
