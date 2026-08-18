import { getAdzunaConfig, validateAdzunaConfig, AdzunaConfig } from '../../config/adzunaConfig';

export interface JobSearchOptions {
  query?: string;
  location?: string;
  page?: number;
  resultsPerPage?: number;
  sortBy?: 'date' | 'salary' | 'relevance';
  maxDaysOld?: number;
  fullTime?: boolean;
  contract?: boolean;
}

export interface AdzunaRawJob {
  id: string | number;
  title: string;
  description: string;
  redirect_url: string;
  adref?: string;
  created: string;
  company?: {
    display_name?: string;
    [key: string]: unknown;
  };
  location?: {
    display_name?: string;
    area?: string[];
    [key: string]: unknown;
  };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
  contract_type?: string;
  contract_time?: string;
  category?: {
    label?: string;
    tag?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AdzunaSearchResponse {
  results: AdzunaRawJob[];
  count: number;
  mean?: number;
  [key: string]: unknown;
}

export interface AdzunaClientSearchResult {
  jobs: AdzunaRawJob[];
  totalCount: number;
  responseTimeMs: number;
  statusCode: number;
}

export class AdzunaApiClient {
  private config: AdzunaConfig;
  private userAgent = 'JobPulse-IngestionBot/1.0 (+https://github.com/jobpulse/bot-policy; contact@jobpulse.dev)';

  constructor(config?: AdzunaConfig) {
    this.config = config || getAdzunaConfig();
  }

  public updateConfig(config: AdzunaConfig): void {
    this.config = config;
  }

  public getConfig(): AdzunaConfig {
    return { ...this.config };
  }

  /**
   * Search jobs from official Adzuna REST endpoint with resilience, timeout, and retry policy
   */
  async searchJobs(options: JobSearchOptions = {}): Promise<AdzunaClientSearchResult> {
    const validation = validateAdzunaConfig(this.config);
    if (!validation.isValid) {
      const err = new Error(validation.error || 'Adzuna configuration is invalid');
      (err as any).code = 'ADZUNA_CONFIG_ERROR';
      throw err;
    }

    const country = this.config.country;
    const page = Math.max(1, options.page || 1);
    const resultsPerPage = options.resultsPerPage || this.config.resultsPerPage;

    const url = new URL(`${this.config.baseUrl}/jobs/${country}/search/${page}`);
    url.searchParams.set('app_id', this.config.appId);
    url.searchParams.set('app_key', this.config.appKey);
    url.searchParams.set('results_per_page', String(resultsPerPage));
    url.searchParams.set('content-type', 'application/json');

    if (options.query && options.query.trim()) {
      url.searchParams.set('what', options.query.trim());
    }
    if (options.location && options.location.trim()) {
      url.searchParams.set('where', options.location.trim());
    }
    if (options.sortBy) {
      url.searchParams.set('sort_by', options.sortBy);
    }
    if (options.maxDaysOld) {
      url.searchParams.set('max_days_old', String(options.maxDaysOld));
    }
    if (options.fullTime) {
      url.searchParams.set('full_time', '1');
    }
    if (options.contract) {
      url.searchParams.set('contract', '1');
    }

    let attempt = 0;
    const maxRetries = this.config.maxRetries;
    const baseBackoff = 600;

    while (attempt <= maxRetries) {
      attempt++;
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

      try {
        console.log(`[ADZUNA] Request started -> country: ${country}, page: ${page}, perPage: ${resultsPerPage} (Attempt ${attempt})`);
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTimeMs = Date.now() - startTime;

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            const err = new Error('Adzuna API authentication failed. Verify JOB_SOURCE_APP_ID and JOB_SOURCE_API_KEY credentials.');
            (err as any).code = 'ADZUNA_AUTH_ERROR';
            (err as any).statusCode = response.status;
            throw err;
          }

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
            const backoffMs = retryAfterSeconds ? retryAfterSeconds * 1000 : baseBackoff * Math.pow(2, attempt);

            console.warn(`[ADZUNA] Rate limit reached (HTTP 429). Retry-After: ${retryAfterHeader || 'unspecified'}.`);

            if (attempt <= maxRetries) {
              console.log(`[ADZUNA] Rate limit backoff waiting for ${backoffMs}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 5000)));
              continue;
            }

            const err = new Error('Adzuna API request rate limit exceeded (HTTP 429).');
            (err as any).code = 'ADZUNA_RATE_LIMITED';
            (err as any).statusCode = 429;
            throw err;
          }

          if (response.status >= 500) {
            if (attempt <= maxRetries) {
              const backoffMs = baseBackoff * Math.pow(2, attempt - 1);
              console.warn(`[ADZUNA] Upstream server error (${response.status}). Retrying in ${backoffMs}ms...`);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }

            const err = new Error(`Adzuna service is temporarily unavailable (HTTP ${response.status}).`);
            (err as any).code = 'ADZUNA_UNAVAILABLE';
            (err as any).statusCode = response.status;
            throw err;
          }

          const err = new Error(`Adzuna API returned HTTP ${response.status}: ${response.statusText}`);
          (err as any).code = 'ADZUNA_INVALID_RESPONSE';
          (err as any).statusCode = response.status;
          throw err;
        }

        let data: AdzunaSearchResponse;
        try {
          data = await response.json();
        } catch {
          const err = new Error('Adzuna API returned malformed or non-JSON response payload.');
          (err as any).code = 'ADZUNA_INVALID_RESPONSE';
          throw err;
        }

        if (!data || !Array.isArray(data.results)) {
          const err = new Error('Adzuna API response missing results array.');
          (err as any).code = 'ADZUNA_INVALID_RESPONSE';
          throw err;
        }

        console.log(`[ADZUNA] Response received: ${data.results.length} jobs (Total pool: ${data.count || 0}) in ${responseTimeMs}ms`);

        return {
          jobs: data.results,
          totalCount: data.count || data.results.length,
          responseTimeMs,
          statusCode: response.status,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (err.name === 'AbortError') {
          if (attempt <= maxRetries) {
            console.warn(`[ADZUNA] Request timed out after ${this.config.requestTimeoutMs}ms. Retrying...`);
            continue;
          }
          const timeoutErr = new Error(`Adzuna API request timed out after ${this.config.requestTimeoutMs}ms`);
          (timeoutErr as any).code = 'ADZUNA_TIMEOUT';
          (timeoutErr as any).statusCode = 408;
          throw timeoutErr;
        }

        // Rethrow if already categorized as permanent auth or config error
        if (err.code === 'ADZUNA_AUTH_ERROR' || err.code === 'ADZUNA_CONFIG_ERROR') {
          throw err;
        }

        if (attempt > maxRetries) {
          if (!err.code) {
            err.code = 'ADZUNA_UNAVAILABLE';
          }
          throw err;
        }

        const backoffMs = baseBackoff * Math.pow(2, attempt - 1);
        console.warn(`[ADZUNA] Attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error('Adzuna API request failed after maximum retry attempts.');
  }

  /**
   * Lightweight health check against Adzuna endpoint
   */
  async healthCheck(): Promise<{ ok: boolean; responseTimeMs: number; statusCode?: number; error?: string }> {
    const validation = validateAdzunaConfig(this.config);
    if (!validation.isValid) {
      return {
        ok: false,
        responseTimeMs: 0,
        error: validation.error,
      };
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const country = this.config.country;
      const url = new URL(`${this.config.baseUrl}/jobs/${country}/search/1`);
      url.searchParams.set('app_id', this.config.appId);
      url.searchParams.set('app_key', this.config.appKey);
      url.searchParams.set('results_per_page', '1');
      url.searchParams.set('content-type', 'application/json');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - start;

      if (res.ok) {
        return {
          ok: true,
          responseTimeMs,
          statusCode: res.status,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          responseTimeMs,
          statusCode: res.status,
          error: 'Authentication failed: Invalid Adzuna App ID or API Key.',
        };
      }

      return {
        ok: false,
        responseTimeMs,
        statusCode: res.status,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        responseTimeMs: Date.now() - start,
        error: err.name === 'AbortError' ? 'Adzuna health check timed out' : err.message,
      };
    }
  }
}

export const adzunaApiClient = new AdzunaApiClient();
