import { JobRecord, EmploymentType, RemoteType } from '../../../src/types/shared';
import { NormalizedJobSchema, stripHtml, extractSkills, NormalizationResult } from './normalizer';
import { generateDeduplicationKey } from '../deduplication/deduplicator';
import { isValidJobUrl } from './urlValidator';

/**
 * Derives normalized employment type from Adzuna contract fields
 */
export function mapAdzunaEmploymentType(contractType?: string, contractTime?: string): EmploymentType {
  const typeStr = `${contractType || ''} ${contractTime || ''}`.toLowerCase();
  if (typeStr.includes('contract') || typeStr.includes('freelance') || typeStr.includes('temporary')) {
    return 'Contract';
  }
  if (typeStr.includes('part_time') || typeStr.includes('part-time') || typeStr.includes('part time')) {
    return 'Part-time';
  }
  if (typeStr.includes('intern') || typeStr.includes('apprenticeship')) {
    return 'Internship';
  }
  return 'Full-time';
}

/**
 * Derives remote work classification from Adzuna location and description context
 */
export function mapAdzunaRemoteType(locationName?: string, title?: string, description?: string): RemoteType {
  const combined = `${locationName || ''} ${title || ''} ${description ? description.slice(0, 800) : ''}`.toLowerCase();

  if (combined.includes('hybrid')) {
    return 'Hybrid';
  }
  if (
    combined.includes('remote') ||
    combined.includes('work from home') ||
    combined.includes('wfh') ||
    combined.includes('telecommute') ||
    combined.includes('anywhere')
  ) {
    return 'Remote';
  }
  if (
    combined.includes('on-site') ||
    combined.includes('onsite') ||
    combined.includes('in-office') ||
    combined.includes('office-based')
  ) {
    return 'On-site';
  }

  return 'On-site';
}

/**
 * Formats Adzuna salary numbers into a clean human-readable string based on regional currency
 */
export function formatAdzunaSalary(salaryMin?: number, salaryMax?: number, country = 'in'): string | undefined {
  if (!salaryMin && !salaryMax) return undefined;

  const c = country.toLowerCase();
  const currencySymbol =
    c === 'in'
      ? '₹'
      : c === 'gb'
      ? '£'
      : c === 'us'
      ? '$'
      : c === 'de' || c === 'fr' || c === 'nl'
      ? '€'
      : '₹';

  const fmt = (val: number) => Math.round(val).toLocaleString('en-US');

  if (salaryMin && salaryMax && salaryMin !== salaryMax) {
    return `${currencySymbol}${fmt(salaryMin)} - ${currencySymbol}${fmt(salaryMax)}`;
  }
  if (salaryMin) {
    return `From ${currencySymbol}${fmt(salaryMin)}`;
  }
  if (salaryMax) {
    return `Up to ${currencySymbol}${fmt(salaryMax)}`;
  }
  return undefined;
}

/**
 * Maps a raw Adzuna API job response item into the normalized JobRecord model
 */
export function mapAdzunaJobToNormalized(raw: any, country = 'in'): NormalizationResult {
  try {
    const source = 'Adzuna';

    // 1. External ID
    let externalId = '';
    if (raw.id !== undefined && raw.id !== null) {
      externalId = String(raw.id).trim();
    } else if (raw.externalId !== undefined && raw.externalId !== null) {
      externalId = String(raw.externalId).trim();
    } else if (raw.adref) {
      externalId = String(raw.adref).trim();
    }

    if (!externalId) {
      return {
        success: false,
        error: {
          code: 'MISSING_EXTERNAL_ID',
          message: 'Adzuna job record is missing the required external id field',
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    // 2. Title
    const title = stripHtml(raw.title || raw.job_title || '').trim();
    if (!title) {
      return {
        success: false,
        error: {
          code: 'MISSING_TITLE',
          message: 'Adzuna job title is missing or invalid',
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }

    // 3. Company Name
    let companyName = 'Confidential Employer';
    if (raw.company && typeof raw.company === 'object' && raw.company.display_name) {
      companyName = String(raw.company.display_name).trim();
    } else if (typeof raw.company === 'string' && raw.company.trim()) {
      companyName = raw.company.trim();
    } else if (raw.companyName) {
      companyName = String(raw.companyName).trim();
    } else if (raw.company_name) {
      companyName = String(raw.company_name).trim();
    }

    // 4. Description
    let rawDescription = (raw.description || raw.job_description || raw.content || '').trim();
    if (!rawDescription) {
      rawDescription = title;
    }

    // 5. Snippet
    const plainDescription = stripHtml(rawDescription);
    const descriptionSnippet =
      plainDescription.length > 280 ? `${plainDescription.slice(0, 277)}...` : plainDescription;

    // 6. Application & Source URLs (Check all possible field locations)
    let applyUrl = '';
    if (raw.redirect_url) applyUrl = String(raw.redirect_url).trim();
    else if (raw.apply_url) applyUrl = String(raw.apply_url).trim();
    else if (raw.url) applyUrl = String(raw.url).trim();
    else if (raw.link) applyUrl = String(raw.link).trim();
    else if (raw.adref) applyUrl = String(raw.adref).trim();

    if (!isValidJobUrl(applyUrl)) {
      return {
        success: false,
        error: {
          code: 'INVALID_APPLY_URL',
          message: `Adzuna redirect_url is missing, malformed, or a placeholder: ${applyUrl || 'empty'}`,
          rawSample: JSON.stringify(raw).slice(0, 200),
        },
      };
    }
    const sourceUrl = applyUrl;

    // 7. Location
    let location = 'United Kingdom';
    if (raw.location && typeof raw.location === 'object' && raw.location.display_name) {
      location = String(raw.location.display_name).trim();
    } else if (typeof raw.location === 'string' && raw.location.trim()) {
      location = raw.location.trim();
    }

    // 8. Published Date
    let publishedAt: string;
    const dateField = raw.created || raw.publication_date || raw.published_at || raw.date;
    if (dateField) {
      const parsed = new Date(dateField);
      publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }

    const now = new Date().toISOString();
    const employmentType = mapAdzunaEmploymentType(raw.contract_type, raw.contract_time);
    const remoteType = mapAdzunaRemoteType(location, title, rawDescription);
    
    // Parse salary values safely (could be numbers or strings)
    const minSalary = raw.salary_min ? Number(raw.salary_min) : undefined;
    const maxSalary = raw.salary_max ? Number(raw.salary_max) : undefined;
    const salary = formatAdzunaSalary(minSalary, maxSalary, country);

    // 9. Categories & Skills
    const rawCategories: string[] = [];
    if (raw.category && typeof raw.category === 'object' && raw.category.label) {
      rawCategories.push(raw.category.label);
    } else if (typeof raw.category === 'string') {
      rawCategories.push(raw.category);
    }
    if (raw.category && typeof raw.category === 'object' && raw.category.tag) {
      rawCategories.push(raw.category.tag.replace(/-/g, ' '));
    }
    if (raw.location && typeof raw.location === 'object' && Array.isArray(raw.location.area)) {
      rawCategories.push(...raw.location.area.slice(0, 2));
    }

    const categories = Array.from(
      new Set(rawCategories.map((c) => String(c).trim()).filter((c) => c.length > 1))
    ).slice(0, 5);

    const skills = extractSkills(`${title} ${plainDescription}`, categories);

    // 10. Collision-resistant Deduplication Key
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
      companyLogoUrl: undefined,
      location,
      description: rawDescription,
      descriptionSnippet,
      employmentType,
      remoteType,
      salary,
      applyUrl,
      sourceUrl,
      publishedAt,
      ingestedAt: now,
      updatedAt: now,
      categories: categories.length > 0 ? categories : ['Technology'],
      skills,
      deduplicationKey,
      rawData: {
        id: raw.id,
        category: raw.category,
        salary_min: raw.salary_min,
        salary_max: raw.salary_max,
        contract_type: raw.contract_type,
        contract_time: raw.contract_time,
        location: raw.location,
        redirect_url: raw.redirect_url || raw.apply_url,
      },
      status: 'ACTIVE',
    };

    // Validate against central Zod schema
    const validation = NormalizedJobSchema.safeParse(candidateJob);
    if (!validation.success) {
      return {
        success: false,
        error: {
          code: 'SCHEMA_VALIDATION_FAILED',
          message: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
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
        code: 'MAPPER_EXCEPTION',
        message: err.message || 'Error executing Adzuna job mapping',
        rawSample: JSON.stringify(raw).slice(0, 200),
      },
    };
  }
}
