import { JobSourceAdapter, SourceFetchResult, SourceHealthResult } from './types';
import { RawJobInput } from '../normalization/normalizer';

export class JobicyAdapter implements JobSourceAdapter {
  id = 'jobicy';
  name = 'Jobicy Remote API';
  type: 'api' = 'api';
  endpoint = 'https://jobicy.com/api/v2/remote-jobs';
  description = 'Official Jobicy v2 Public REST API providing live curated remote jobs without requiring API keys.';

  private userAgent = 'JobPulse-IngestionBot/1.0 (+https://github.com/jobpulse/bot-policy; contact@jobpulse.dev)';

  async fetchRawJobs(options?: { limit?: number }): Promise<SourceFetchResult> {
    const startTime = Date.now();
    const limit = Math.min(options?.limit || 30, 50);
    const url = `https://jobicy.com/api/v2/remote-jobs?count=${limit}`;

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
          // Format salary if min/max provided
          let salaryStr: string | undefined = undefined;
          const minSalary = item.annualSalaryMin || item.salaryMin;
          const maxSalary = item.annualSalaryMax || item.salaryMax;
          const currency = item.salaryCurrency || 'USD';
          if (minSalary && maxSalary) {
            salaryStr = `$${Number(minSalary).toLocaleString()} - $${Number(maxSalary).toLocaleString()} ${currency}`;
          } else if (minSalary) {
            salaryStr = `From $${Number(minSalary).toLocaleString()} ${currency}`;
          } else if (maxSalary) {
            salaryStr = `Up to $${Number(maxSalary).toLocaleString()} ${currency}`;
          }

          // Extract job type
          let jobTypeStr = 'Full-time';
          if (Array.isArray(item.jobType) && item.jobType.length > 0) {
            jobTypeStr = item.jobType.join(', ');
          } else if (typeof item.jobType === 'string') {
            jobTypeStr = item.jobType;
          }

          // Extract tags / categories
          let tags: string[] = [];
          if (Array.isArray(item.jobIndustry)) {
            tags.push(...item.jobIndustry.map(String));
          } else if (typeof item.jobIndustry === 'string') {
            tags.push(item.jobIndustry);
          }
          if (item.jobLevel) {
            tags.push(String(item.jobLevel));
          }

          rawJobs.push({
            id: item.id,
            source: 'Jobicy',
            title: item.jobTitle || item.title,
            company: item.companyName || item.company,
            companyLogoUrl: item.companyLogo || item.company_logo,
            location: item.jobGeo || 'Remote',
            description: item.jobDescription || item.jobExcerpt || item.description || '',
            job_type: jobTypeStr,
            salary: salaryStr,
            url: item.url,
            apply_url: item.url,
            pubDate: item.pubDate || item.publication_date,
            tags,
            category: tags[0] || 'Technology',
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
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=1', {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
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
