/**
 * Shared Type Definitions for JobPulse Ingestion & Discovery Platform
 */

export type RemoteType = 'Remote' | 'Hybrid' | 'On-site';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Other';
export type SourceStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
export type IngestionStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'IN_PROGRESS';
export type IngestionTrigger = 'MANUAL' | 'SCHEDULED' | 'STARTUP';

export interface JobRecord {
  id: string;
  externalId: string;
  source: string;
  title: string;
  companyName: string;
  companyLogoUrl?: string;
  location: string;
  description: string;
  descriptionSnippet: string;
  employmentType: EmploymentType;
  remoteType: RemoteType;
  salary?: string;
  applyUrl: string;
  sourceUrl: string;
  publishedAt: string; // ISO 8601
  ingestedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  categories: string[];
  skills: string[];
  deduplicationKey: string;
  rawData?: Record<string, unknown>;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface SourceHealth {
  sourceId: string;
  name: string;
  type: 'api' | 'rss' | 'sandbox';
  endpoint: string;
  status: SourceStatus;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  consecutiveFailures: number;
  totalJobsFetched: number;
  totalJobsInserted: number;
  lastError: string | null;
  responseTimeMs: number;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    resetAt?: string;
  };
}

export interface IngestionErrorRecord {
  code: string;
  message: string;
  itemIdentifier?: string;
  timestamp: string;
  rawSample?: string;
}

export interface IngestionRun {
  id: string;
  source: string;
  trigger: IngestionTrigger;
  status: IngestionStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  fetched: number;
  parsed: number;
  inserted: number;
  updated: number;
  duplicates: number;
  rejected: number;
  errors: IngestionErrorRecord[];
  summaryMessage?: string;
}

export interface JobQueryParams {
  search?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  source?: string;
  category?: string;
  sort?: 'newest' | 'oldest' | 'title_asc' | 'company_asc';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SystemHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  database: {
    status: 'connected' | 'disconnected' | 'in-memory-fallback';
    type: 'MongoDB' | 'EmbeddedStore';
    jobsCount: number;
    runsCount: number;
  };
  sources: SourceHealth[];
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    nextRunEstimated: string | null;
  };
  system: {
    uptimeSeconds: number;
    memoryUsageMb: number;
    nodeVersion: string;
    environment: string;
    timestamp: string;
  };
}
