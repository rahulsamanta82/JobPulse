import { RawJobInput } from '../normalization/normalizer';

export interface SourceHealthResult {
  ok: boolean;
  responseTimeMs: number;
  error?: string;
  statusCode?: number;
}

export interface SourceFetchResult {
  rawItems: RawJobInput[];
  responseTimeMs: number;
  statusCode: number;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
}

export interface JobSourceAdapter {
  id: string;
  name: string;
  type: 'api' | 'rss' | 'sandbox';
  endpoint: string;
  description: string;
  fetchRawJobs(options?: { limit?: number; simulateScenario?: string }): Promise<SourceFetchResult>;
  healthCheck(): Promise<SourceHealthResult>;
}
