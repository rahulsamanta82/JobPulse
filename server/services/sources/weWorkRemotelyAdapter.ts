import { XMLParser } from 'fast-xml-parser';
import { JobSourceAdapter, SourceFetchResult, SourceHealthResult } from './types';
import { RawJobInput } from '../normalization/normalizer';

export class WeWorkRemotelyAdapter implements JobSourceAdapter {
  id = 'weworkremotely';
  name = 'WeWorkRemotely RSS Feed';
  type: 'rss' = 'rss';
  endpoint = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
  description = 'Public RSS 2.0 feed from WeWorkRemotely providing live remote software engineering postings.';

  private userAgent = 'JobPulse-IngestionBot/1.0 (+https://github.com/jobpulse/bot-policy; contact@jobpulse.dev)';
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  async fetchRawJobs(options?: { limit?: number }): Promise<SourceFetchResult> {
    const startTime = Date.now();
    const limit = options?.limit || 30;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(this.endpoint, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new Error(`HTTP 429 Rate Limit Exceeded (Retry-After: ${retryAfter || 'unknown'})`);
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsedXml = this.parser.parse(xmlText);

      const items = parsedXml?.rss?.channel?.item;
      const rawJobs: RawJobInput[] = [];

      if (Array.isArray(items)) {
        for (const item of items.slice(0, limit)) {
          // Format of WeWorkRemotely title is often "CompanyName: JobTitle"
          let title = String(item.title || '');
          let company = 'WeWorkRemotely Partner';
          if (title.includes(':')) {
            const parts = title.split(':');
            company = parts[0].trim();
            title = parts.slice(1).join(':').trim();
          }

          rawJobs.push({
            id: item.guid?.['#text'] || item.guid || item.link,
            source: 'WeWorkRemotely',
            title,
            company,
            location: 'Remote',
            description: item.description || item['content:encoded'] || '',
            url: item.link,
            apply_url: item.link,
            pubDate: item.pubDate,
            category: item.category ? (Array.isArray(item.category) ? item.category.join(', ') : String(item.category)) : 'Programming',
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
      const res = await fetch(this.endpoint, {
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
