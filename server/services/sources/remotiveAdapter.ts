import { JobSourceAdapter, SourceFetchResult, SourceHealthResult } from './types';
import { RawJobInput } from '../normalization/normalizer';

export class RemotiveAdapter implements JobSourceAdapter {
  id = 'remotive';
  name = 'Remotive Public API';
  type: 'api' = 'api';
  endpoint = 'https://remotive.com/api/remote-jobs?limit=35';
  description = 'Legitimate public REST API providing curated remote technology and software jobs.';

  private userAgent = 'JobPulse-IngestionBot/1.0 (+https://github.com/jobpulse/bot-policy; contact@jobpulse.dev)';

  async fetchRawJobs(options?: { limit?: number }): Promise<SourceFetchResult> {
    const startTime = Date.now();
    const limit = options?.limit || 35;
    const url = `https://remotive.com/api/remote-jobs?limit=${limit}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new Error(`HTTP 429 Too Many Requests (Retry-After: ${retryAfter || 'unknown'})`);
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      const rawJobs: RawJobInput[] = [];

      if (data && Array.isArray(data.jobs)) {
        for (const item of data.jobs) {
          rawJobs.push({
            id: item.id,
            source: 'Remotive',
            title: item.title,
            company: item.company_name,
            companyLogoUrl: item.company_logo,
            location: item.candidate_required_location || 'Remote',
            description: item.description,
            job_type: item.job_type,
            salary: item.salary,
            url: item.url,
            apply_url: item.url,
            publication_date: item.publication_date,
            tags: item.tags || [],
            category: item.category,
            ...item,
          });
        }
      }

      return {
        rawItems: rawJobs,
        responseTimeMs,
        statusCode: response.status,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after 12,000ms (Response time: ${responseTimeMs}ms)`);
      }
      throw err;
    }
  }

  async healthCheck(): Promise<SourceHealthResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=1', {
        method: 'HEAD',
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
      }).catch(async () => {
        // Some endpoints do not accept HEAD, fallback to GET with limit=1
        return fetch('https://remotive.com/api/remote-jobs?limit=1', {
          headers: { 'User-Agent': this.userAgent },
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - start;

      return {
        ok: res.ok,
        responseTimeMs,
        statusCode: res.status,
        error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        responseTimeMs: Date.now() - start,
        error: err.message,
      };
    }
  }
}
