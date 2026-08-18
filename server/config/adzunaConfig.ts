export interface AdzunaConfig {
  baseUrl: string;
  appId: string;
  appKey: string;
  country: string;
  maxPages: number;
  resultsPerPage: number;
  maxRetries: number;
  requestTimeoutMs: number;
}

export interface ConfigValidationResult {
  isValid: boolean;
  isConfigured: boolean;
  error?: string;
  config: AdzunaConfig;
}

export function getAdzunaConfig(): AdzunaConfig {
  const baseUrl = (process.env.JOB_SOURCE_API_URL || 'https://api.adzuna.com/v1/api').replace(/\/+$/, '');
  const appId = (process.env.JOB_SOURCE_APP_ID || '').trim();
  const appKey = (process.env.JOB_SOURCE_API_KEY || '').trim();
  const country = (process.env.ADZUNA_COUNTRY || 'in').trim().toLowerCase();

  const maxPages = Math.max(1, parseInt(process.env.INGESTION_MAX_PAGES || '3', 10));
  const resultsPerPage = Math.max(1, Math.min(50, parseInt(process.env.INGESTION_RESULTS_PER_PAGE || '20', 10)));
  const maxRetries = Math.max(0, parseInt(process.env.INGESTION_MAX_RETRIES || '3', 10));
  const requestTimeoutMs = Math.max(1000, parseInt(process.env.INGESTION_REQUEST_TIMEOUT_MS || '10000', 10));

  return {
    baseUrl,
    appId,
    appKey,
    country,
    maxPages,
    resultsPerPage,
    maxRetries,
    requestTimeoutMs,
  };
}

export function validateAdzunaConfig(config: AdzunaConfig = getAdzunaConfig()): ConfigValidationResult {
  const isConfigured = Boolean(config.appId && config.appKey);

  if (!config.baseUrl || !config.baseUrl.startsWith('http')) {
    return {
      isValid: false,
      isConfigured: false,
      error: 'Invalid JOB_SOURCE_API_URL: must be a valid HTTP/HTTPS URL.',
      config,
    };
  }

  if (!config.country || config.country.length < 2) {
    return {
      isValid: false,
      isConfigured: false,
      error: 'Invalid ADZUNA_COUNTRY: must be a 2-letter ISO country code (e.g. gb, us, de).',
      config,
    };
  }

  if (!isConfigured) {
    return {
      isValid: false,
      isConfigured: false,
      error: 'Adzuna API configuration is incomplete. Configure JOB_SOURCE_API_URL, JOB_SOURCE_APP_ID and JOB_SOURCE_API_KEY.',
      config,
    };
  }

  return {
    isValid: true,
    isConfigured: true,
    config,
  };
}
