import { JobSourceAdapter, SourceFetchResult, SourceHealthResult } from './types';
import { RawJobInput } from '../normalization/normalizer';

export class SandboxAdapter implements JobSourceAdapter {
  id = 'sandbox';
  name = 'QA Resilience Sandbox';
  type: 'sandbox' = 'sandbox';
  endpoint = 'sandbox://internal.test.acdyon/jobs';
  description = 'Controlled test sandbox for simulating edge cases (429 Rate Limits, malformed records, network failures, deduplication).';

  async fetchRawJobs(options?: { simulateScenario?: string }): Promise<SourceFetchResult> {
    const startTime = Date.now();
    const scenario = options?.simulateScenario || 'normal';

    // Simulate network delay (120ms)
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (scenario === 'rate_limit_429') {
      throw new Error('HTTP 429 Too Many Requests (Retry-After: 30s) [Simulated Sandbox Rate Limit]');
    }

    if (scenario === 'unavailable' || scenario === 'network_timeout') {
      throw new Error('HTTP 503 Service Unavailable: Simulated upstream server downtime');
    }

    if (scenario === 'malformed_data') {
      const malformedItems: RawJobInput[] = [
        {
          id: 'sandbox-bad-1',
          source: 'Sandbox',
          // Missing title
          company: 'Broken Records Inc',
          description: 'This record has no title and should be rejected safely.',
          url: 'https://sandbox.jobpulse.internal/jobs/1',
        },
        {
          id: 'sandbox-bad-2',
          source: 'Sandbox',
          title: 'Senior QA Engineer',
          company: 'Acme Test Corp',
          description: 'Valid description with broken apply URL.',
          apply_url: 'not-a-valid-url', // Invalid URL
        },
        {
          id: 'sandbox-valid-1',
          source: 'Sandbox',
          title: 'Resilience Test Engineer',
          company: 'Acdyon Systems Sandbox',
          location: 'Remote',
          description: 'This is a valid test record in the midst of malformed records to test partial ingestion failure.',
          apply_url: 'https://sandbox.jobpulse.internal/jobs/resilience-engineer',
          pubDate: new Date().toISOString(),
          tags: ['TypeScript', 'Testing', 'QA'],
        },
      ];

      return {
        rawItems: malformedItems,
        responseTimeMs: Date.now() - startTime,
        statusCode: 200,
      };
    }

    if (scenario === 'duplicates') {
      const duplicateItems: RawJobInput[] = [
        {
          id: 'sandbox-dup-1',
          source: 'Sandbox',
          title: 'Lead Systems Architect',
          company: 'Acdyon Core Lab',
          location: 'Remote',
          description: 'High performance systems design with distributed deduplication testing.',
          apply_url: 'https://sandbox.jobpulse.internal/jobs/lead-architect',
          pubDate: new Date().toISOString(),
          tags: ['Distributed Systems', 'Go', 'Node.js'],
        },
        {
          id: 'sandbox-dup-1', // Same ID
          source: 'Sandbox',
          title: 'Lead Systems Architect',
          company: 'Acdyon Core Lab',
          location: 'Remote',
          description: 'High performance systems design with distributed deduplication testing (Duplicate Item).',
          apply_url: 'https://sandbox.jobpulse.internal/jobs/lead-architect',
          pubDate: new Date().toISOString(),
          tags: ['Distributed Systems', 'Go', 'Node.js'],
        },
      ];

      return {
        rawItems: duplicateItems,
        responseTimeMs: Date.now() - startTime,
        statusCode: 200,
      };
    }

    // Default Normal Sandbox Dataset
    const normalItems: RawJobInput[] = [
      {
        id: 'sandbox-sec-101',
        source: 'Sandbox',
        title: 'Distributed Systems & Ingestion Engineer',
        company: 'Acdyon Security Labs',
        location: 'Remote (US/EU)',
        description: 'Design detection-surface resilient crawlers and ingestion pipelines. Experience with backoff policies, circuit breakers, and rate limit telemetry required.',
        apply_url: 'https://sandbox.jobpulse.internal/jobs/ingestion-engineer',
        pubDate: new Date().toISOString(),
        tags: ['TypeScript', 'Node.js', 'Distributed Systems', 'MongoDB'],
      },
      {
        id: 'sandbox-sec-102',
        source: 'Sandbox',
        title: 'Senior Frontend Architect',
        company: 'JobPulse Core',
        location: 'Remote',
        description: 'Build enterprise-grade SaaS user interfaces with React, Tailwind CSS, accessibility standards, and real-time observability telemetry.',
        apply_url: 'https://sandbox.jobpulse.internal/jobs/frontend-architect',
        pubDate: new Date().toISOString(),
        tags: ['React', 'TypeScript', 'Tailwind CSS', 'UI/UX'],
      },
    ];

    return {
      rawItems: normalItems,
      responseTimeMs: Date.now() - startTime,
      statusCode: 200,
    };
  }

  async healthCheck(): Promise<SourceHealthResult> {
    return {
      ok: true,
      responseTimeMs: 25,
      statusCode: 200,
    };
  }
}
