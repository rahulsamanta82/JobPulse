import {
  JobRecord,
  SourceHealth,
  IngestionRun,
  JobQueryParams,
  PaginatedResult,
  ApiResponse,
  SystemHealthStatus,
} from '../types/shared';

const BASE_URL = '/api';

export async function fetchJobs(params: JobQueryParams = {}): Promise<PaginatedResult<JobRecord>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.location) query.set('location', params.location);
  if (params.remoteType && params.remoteType !== 'all') query.set('remoteType', params.remoteType);
  if (params.employmentType && params.employmentType !== 'all') query.set('employmentType', params.employmentType);
  if (params.source && params.source !== 'all') query.set('source', params.source);
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${BASE_URL}/jobs?${query.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${res.status} Failed to fetch jobs`);
  }
  const json: ApiResponse<JobRecord[]> = await res.json();
  return {
    items: json.data || [],
    pagination: json.pagination || {
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export async function fetchJobById(id: string): Promise<JobRecord> {
  const res = await fetch(`${BASE_URL}/jobs/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${res.status} Job not found`);
  }
  const json: ApiResponse<JobRecord> = await res.json();
  if (!json.data) throw new Error('Job data is missing in response');
  return json.data;
}

export async function fetchSources(): Promise<SourceHealth[]> {
  const res = await fetch(`${BASE_URL}/sources`);
  if (!res.ok) throw new Error(`HTTP ${res.status} Failed to fetch source health`);
  const json = await res.json();
  return json.data || [];
}

export async function triggerSync(options: {
  sourceId?: string;
  simulateScenario?: string;
  limit?: number;
}): Promise<{ runs: IngestionRun[]; totalInserted: number; totalDuplicates: number; totalErrors: number }> {
  const res = await fetch(`${BASE_URL}/ingestion/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${res.status} Sync failed`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchIngestionRuns(page = 1, limit = 20): Promise<PaginatedResult<IngestionRun>> {
  const res = await fetch(`${BASE_URL}/ingestion/runs?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} Failed to fetch ingestion history`);
  const json: ApiResponse<IngestionRun[]> = await res.json();
  return {
    items: json.data || [],
    pagination: json.pagination || {
      page,
      limit,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export async function fetchIngestionRunById(id: string): Promise<IngestionRun> {
  const res = await fetch(`${BASE_URL}/ingestion/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} Run not found`);
  const json: ApiResponse<IngestionRun> = await res.json();
  if (!json.data) throw new Error('Run record not found');
  return json.data;
}

export async function fetchSystemHealth(): Promise<any> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status} System health check failed`);
  return res.json();
}

export async function fetchDetectionSurfaceAnalysis(): Promise<any> {
  const res = await fetch(`${BASE_URL}/system/detection-surface`);
  if (!res.ok) throw new Error(`HTTP ${res.status} Failed to fetch detection surface data`);
  const json = await res.json();
  return json.data;
}
