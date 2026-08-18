import crypto from 'crypto';
import { db } from '../../db/db';
import { sourceRegistry } from '../sources';
import { normalizeJob } from '../normalization/normalizer';
import {
  IngestionRun,
  IngestionTrigger,
  IngestionStatus,
  SourceHealth,
  SourceStatus,
  IngestionErrorRecord,
} from '../../../src/types/shared';

export interface SyncOptions {
  sourceId?: string; // specific source or 'all'
  trigger?: IngestionTrigger;
  limitPerSource?: number;
  simulateScenario?: string;
}

export class IngestionEngine {
  private isSyncing = false;
  private schedulerIntervalId: NodeJS.Timeout | null = null;
  private maxRetries = 2;
  private baseBackoffMs = 500;

  async initialize(): Promise<void> {
    // Populate source health defaults in db
    const adapters = sourceRegistry.getAllAdapters();
    for (const adapter of adapters) {
      const existing = await db.getSourceHealth(adapter.id);
      if (!existing) {
        await db.upsertSourceHealth({
          sourceId: adapter.id,
          name: adapter.name,
          type: adapter.type,
          endpoint: adapter.endpoint,
          status: 'HEALTHY',
          lastSuccessfulSync: null,
          lastAttemptedSync: null,
          consecutiveFailures: 0,
          totalJobsFetched: 0,
          totalJobsInserted: 0,
          lastError: null,
          responseTimeMs: 0,
        });
      }
    }

    this.startScheduler();
  }

  startScheduler(): void {
    if (this.schedulerIntervalId) clearInterval(this.schedulerIntervalId);

    const intervalMinutes = parseInt(process.env.INGESTION_INTERVAL_MINUTES || '60', 10);
    const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

    console.log(`[Ingestion] Periodic scheduler active (interval: ${intervalMinutes} minutes).`);
    this.schedulerIntervalId = setInterval(() => {
      console.log('[Ingestion] Running scheduled background sync...');
      this.runSync({ trigger: 'SCHEDULED' }).catch((err) => {
        console.error('[Ingestion] Scheduled sync failed:', err);
      });
    }, intervalMs);
  }

  stopScheduler(): void {
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
  }

  async runSync(options: SyncOptions = {}): Promise<IngestionRun[]> {
    if (this.isSyncing) {
      console.log('[Ingestion] Sync already in progress. Queueing or returning current status.');
    }

    this.isSyncing = true;
    const trigger = options.trigger || 'MANUAL';
    const targetSourceId = options.sourceId && options.sourceId !== 'all' ? options.sourceId.toLowerCase() : null;

    const adapters = targetSourceId
      ? [sourceRegistry.getAdapter(targetSourceId)].filter(Boolean)
      : sourceRegistry.getAllAdapters().filter((a) => {
          // If in normal sync, optionally include or exclude sandbox
          if (a.id === 'sandbox' && options.simulateScenario === undefined && options.trigger !== 'MANUAL') {
            return false;
          }
          return true;
        });

    const completedRuns: IngestionRun[] = [];

    try {
      for (const adapter of adapters) {
        if (!adapter) continue;
        const run = await this.syncSingleSource(adapter, {
          trigger,
          limit: options.limitPerSource,
          simulateScenario: options.simulateScenario,
        });
        completedRuns.push(run);
      }
    } finally {
      this.isSyncing = false;
    }

    return completedRuns;
  }

  private async syncSingleSource(
    adapter: any,
    opts: { trigger: IngestionTrigger; limit?: number; simulateScenario?: string }
  ): Promise<IngestionRun> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    const runRecord: IngestionRun = {
      id: runId,
      source: adapter.name,
      trigger: opts.trigger,
      status: 'IN_PROGRESS',
      startedAt,
      completedAt: null,
      durationMs: 0,
      fetched: 0,
      parsed: 0,
      inserted: 0,
      updated: 0,
      duplicates: 0,
      rejected: 0,
      errors: [],
      summaryMessage: 'Ingestion initiated.',
    };

    let previousHealth = (await db.getSourceHealth(adapter.id)) || {
      sourceId: adapter.id,
      name: adapter.name,
      type: adapter.type,
      endpoint: adapter.endpoint,
      status: 'HEALTHY' as SourceStatus,
      lastSuccessfulSync: null,
      lastAttemptedSync: null,
      consecutiveFailures: 0,
      totalJobsFetched: 0,
      totalJobsInserted: 0,
      lastError: null,
      responseTimeMs: 0,
    };

    let fetchResult: any = null;
    let fetchError: Error | null = null;
    let attempt = 0;

    // Retry loop with exponential backoff
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        fetchResult = await adapter.fetchRawJobs({
          limit: opts.limit,
          simulateScenario: opts.simulateScenario,
        });
        fetchError = null;
        break; // Success
      } catch (err: any) {
        fetchError = err;
        console.warn(`[Ingestion] Attempt ${attempt} failed for source ${adapter.id}: ${err.message}`);

        if (attempt <= this.maxRetries) {
          const delay = this.baseBackoffMs * Math.pow(2, attempt - 1);
          console.log(`[Ingestion] Backing off for ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // If source completely failed
    if (fetchError || !fetchResult) {
      const errorMsg = fetchError?.message || 'Failed to fetch jobs from source';
      runRecord.status = 'FAILED';
      runRecord.completedAt = new Date().toISOString();
      runRecord.durationMs = durationMs;
      runRecord.summaryMessage = `Failed after ${attempt} attempts: ${errorMsg}`;
      runRecord.errors.push({
        code: 'SOURCE_FETCH_ERROR',
        message: errorMsg,
        timestamp: new Date().toISOString(),
      });

      // Update source health to DEGRADED or UNAVAILABLE
      const failures = previousHealth.consecutiveFailures + 1;
      const status: SourceStatus = failures >= 3 ? 'UNAVAILABLE' : 'DEGRADED';

      await db.upsertSourceHealth({
        ...previousHealth,
        status,
        lastAttemptedSync: startedAt,
        consecutiveFailures: failures,
        lastError: errorMsg,
        responseTimeMs: durationMs,
      });

      await db.recordIngestionRun(runRecord);
      return runRecord;
    }

    // Source succeeded: parse & normalize
    runRecord.fetched = fetchResult.rawItems.length;

    for (const rawItem of fetchResult.rawItems) {
      const normResult = normalizeJob(rawItem, adapter.name);

      if (!normResult.success || !normResult.job) {
        runRecord.rejected++;
        runRecord.errors.push({
          code: normResult.error?.code || 'NORMALIZATION_FAILED',
          message: normResult.error?.message || 'Failed to normalize record',
          itemIdentifier: String(rawItem.id || rawItem.title || 'unknown'),
          timestamp: new Date().toISOString(),
          rawSample: normResult.error?.rawSample,
        });
        continue;
      }

      runRecord.parsed++;
      try {
        const { result } = await db.upsertJob(normResult.job);
        if (result === 'inserted') {
          runRecord.inserted++;
        } else if (result === 'updated') {
          runRecord.updated++;
        } else if (result === 'duplicate') {
          runRecord.duplicates++;
        }
      } catch (dbErr: any) {
        runRecord.rejected++;
        runRecord.errors.push({
          code: 'DB_INSERT_ERROR',
          message: dbErr.message || 'Database insertion error',
          itemIdentifier: normResult.job.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    runRecord.completedAt = new Date().toISOString();
    runRecord.durationMs = Date.now() - startTime;

    if (runRecord.errors.length > 0 && runRecord.inserted + runRecord.duplicates > 0) {
      runRecord.status = 'PARTIAL';
      runRecord.summaryMessage = `Partially successful: ${runRecord.inserted} inserted, ${runRecord.duplicates} duplicates, ${runRecord.rejected} rejected with errors.`;
    } else if (runRecord.errors.length > 0 && runRecord.inserted === 0 && runRecord.duplicates === 0) {
      runRecord.status = 'FAILED';
      runRecord.summaryMessage = `Failed: All ${runRecord.rejected} records were rejected.`;
    } else {
      runRecord.status = 'SUCCESS';
      runRecord.summaryMessage = `Successfully processed ${runRecord.fetched} jobs (${runRecord.inserted} new, ${runRecord.duplicates} existing).`;
    }

    // Update source health (HEALTHY)
    await db.upsertSourceHealth({
      ...previousHealth,
      status: 'HEALTHY',
      lastSuccessfulSync: runRecord.completedAt,
      lastAttemptedSync: startedAt,
      consecutiveFailures: 0,
      totalJobsFetched: previousHealth.totalJobsFetched + runRecord.fetched,
      totalJobsInserted: previousHealth.totalJobsInserted + runRecord.inserted,
      lastError: null,
      responseTimeMs: fetchResult.responseTimeMs,
    });

    await db.recordIngestionRun(runRecord);
    return runRecord;
  }
}

export const ingestionEngine = new IngestionEngine();
