import { JobSourceAdapter, SourceFetchResult, SourceHealthResult } from './types';
import { RawJobInput } from '../normalization/normalizer';
import { adzunaApiClient, AdzunaApiClient, JobSearchOptions } from './adzunaClient';
import { getAdzunaConfig } from '../../config/adzunaConfig';

export class AdzunaSourceAdapter implements JobSourceAdapter {
  id = 'adzuna';
  name = 'Adzuna';
  type: 'api' = 'api';
  endpoint = 'https://api.adzuna.com/v1/api/jobs/{country}/search';
  description = 'Official Adzuna REST API providing structured, legitimate global job postings.';

  private client: AdzunaApiClient;

  constructor(client: AdzunaApiClient = adzunaApiClient) {
    this.client = client;
    const config = getAdzunaConfig();
    this.endpoint = `${config.baseUrl}/jobs/${config.country}/search/{page}`;
  }

  /**
   * Fetches raw job postings from Adzuna across configured pagination limits
   */
  async fetchRawJobs(options?: {
    limit?: number;
    searchOptions?: JobSearchOptions;
    simulateScenario?: string;
  }): Promise<SourceFetchResult> {
    const config = getAdzunaConfig();
    const maxPages = config.maxPages || 3;
    const resultsPerPage = options?.limit
      ? Math.min(options.limit, config.resultsPerPage)
      : config.resultsPerPage;

    const allRawItems: RawJobInput[] = [];
    let totalResponseTimeMs = 0;
    let lastStatusCode = 200;

    for (let page = 1; page <= maxPages; page++) {
      const pageResult = await this.client.searchJobs({
        ...options?.searchOptions,
        page,
        resultsPerPage,
      });

      totalResponseTimeMs += pageResult.responseTimeMs;
      lastStatusCode = pageResult.statusCode;

      if (!pageResult.jobs || pageResult.jobs.length === 0) {
        break;
      }

      for (const item of pageResult.jobs) {
        const resolvedApplyUrl = item.redirect_url || item.adref || '';
        allRawItems.push({
          ...item,
          id: String(item.id),
          source: 'Adzuna',
          title: item.title,
          company: item.company,
          companyName: item.company?.display_name || 'Confidential Employer',
          location: item.location,
          description: item.description,
          job_type: `${item.contract_type || ''} ${item.contract_time || ''}`.trim(),
          salary:
            item.salary_min || item.salary_max
              ? `${item.salary_min || ''} - ${item.salary_max || ''}`.trim()
              : undefined,
          url: resolvedApplyUrl,
          apply_url: resolvedApplyUrl,
          redirect_url: resolvedApplyUrl,
          adref: item.adref,
          publication_date: item.created,
          created: item.created,
          category: item.category,
          tags: item.location?.area || [],
          contract_type: item.contract_type,
          contract_time: item.contract_time,
          salary_min: item.salary_min as any,
          salary_max: item.salary_max as any,
        });
      }

      // If we've reached the total job pool available or user-requested limit
      if (options?.limit && allRawItems.length >= options.limit) {
        break;
      }
      if (allRawItems.length >= pageResult.totalCount) {
        break;
      }
    }

    return {
      rawItems: allRawItems,
      responseTimeMs: Math.round(totalResponseTimeMs / Math.max(1, maxPages)),
      statusCode: lastStatusCode,
    };
  }

  /**
   * Performs a non-intrusive health check against Adzuna
   */
  async healthCheck(): Promise<SourceHealthResult> {
    const result = await this.client.healthCheck();
    return {
      ok: result.ok,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      error: result.error,
    };
  }
}

export const adzunaSourceAdapter = new AdzunaSourceAdapter();
