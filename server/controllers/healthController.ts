import { Request, Response } from 'express';
import { db } from '../db/db';

export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    const dbState = db.getState();
    const jobsCount = await db.countJobs();
    const sourcesHealth = await db.getAllSourceHealth();
    const mem = process.memoryUsage();

    const isHealthy = dbState.isConnected && sourcesHealth.length > 0 && sourcesHealth.every((s) => s.status === 'HEALTHY');
    const isDegraded = dbState.isConnected && sourcesHealth.some((s) => s.status === 'DEGRADED' || s.status === 'UNAVAILABLE');

    const status = isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'UNHEALTHY';

    res.json({
      status: 'ok',
      systemStatus: status,
      database: {
        status: dbState.isConnected ? 'connected' : 'disconnected',
        type: dbState.type,
        databaseName: dbState.databaseName,
        jobsCount,
        error: dbState.error || null,
      },
      sources: sourcesHealth.map((s) => ({
        sourceId: s.sourceId,
        name: s.name,
        status: s.status,
        lastSuccessfulSync: s.lastSuccessfulSync,
        consecutiveFailures: s.consecutiveFailures,
        responseTimeMs: s.responseTimeMs,
      })),
      scheduler: {
        enabled: true,
        intervalMinutes: parseInt(process.env.INGESTION_INTERVAL_MINUTES || '60', 10),
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(mem.rss / 1024 / 1024),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      },
      version: '1.0.0',
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getDetectionSurfaceAnalysis(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      title: 'Detection Surface Awareness & Ethical Ingestion Posture',
      overview:
        'Automated clients and web crawlers are identified by target hosts across multiple network, protocol, behavioral, and fingerprinting vectors. JobPulse is designed with deliberate awareness of these surfaces and operates strictly within legitimate ToS and public feed boundaries.',
      vectors: [
        {
          category: 'Request Timing & Cadence',
          vector: 'Machine-like periodic bursts vs organic user distribution',
          detectionMechanism:
            'Target WAFs (Cloudflare, Akamai, CloudFront) measure inter-request intervals, standard deviation of request timing, and concurrency spikes.',
          mitigationInJobPulse:
            'Controlled synchronization frequency, scheduled intervals (e.g. 60 min), exponential backoff with randomized jitter on retry, single-flight requests per source.',
        },
        {
          category: 'HTTP & TLS Fingerprinting',
          vector: 'JA3/JA4 TLS cipher suite ordering & HTTP/2 frame headers',
          detectionMechanism:
            'Default Go/Python/Node HTTP clients omit standard browser extension orders, ALPN negotiation, and standard accept headers, creating a distinct JA3 hash.',
          mitigationInJobPulse:
            'We use transparent, honest User-Agent strings (identifying as JobPulse-IngestionBot with policy URL) and query official public REST APIs & RSS endpoints where bot identification is permitted, rather than masquerading.',
        },
        {
          category: 'Behavioral Navigation & Headless Detection',
          vector: 'Missing navigator.plugins, webdriver flags, synthetic mouse events',
          detectionMechanism:
            'Bot mitigation scripts evaluate DOM properties (`window.navigator.webdriver`, canvas rendering fingerprints, audio context, Chrome DevTools Protocol traces).',
          mitigationInJobPulse:
            'Zero headless browser automation used for ingestion. We strictly consume structured feeds and APIs, completely eliminating headless detection vectors.',
        },
        {
          category: 'Rate Limiting & Error Codes',
          vector: 'Ignoring HTTP 429 Too Many Requests and Retry-After headers',
          detectionMechanism:
            'Continuing to flood an endpoint after a 429 status triggers IP reputation drops, temporary null-routing, or permanent firewall blacklisting.',
          mitigationInJobPulse:
            'Strict adherence to HTTP 429 and Retry-After headers, instant circuit breaker tripping to prevent source exhaustion, and graceful degradation.',
        },
        {
          category: 'Terms of Service & Ethical Boundary',
          vector: 'Bypassing CAPTCHAs, credential stuffing, scraping authenticated walled gardens',
          detectionMechanism:
            'Violating platform robots.txt and bypassing access controls constitutes unauthorized scraping and security violations.',
          mitigationInJobPulse:
            'Clear boundary: JobPulse NEVER attempts CAPTCHA solving, account credential rotation, stealth proxy rotation, or unauthorized scraping of login-walled sites. We ingest from verified public APIs and open RSS feeds.',
        },
      ],
    },
  });
}
