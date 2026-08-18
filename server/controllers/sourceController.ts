import { Request, Response } from 'express';
import { db } from '../db/db';
import { sourceRegistry } from '../services/sources';

export async function getSources(req: Request, res: Response): Promise<void> {
  try {
    const healthList = await db.getAllSourceHealth();
    const adapters = sourceRegistry.getAllAdapters();

    const data = adapters.map((adapter) => {
      const health = healthList.find((h) => h.sourceId.toLowerCase() === adapter.id.toLowerCase());
      return {
        id: adapter.id,
        sourceId: adapter.id,
        name: adapter.name,
        type: adapter.type,
        endpoint: adapter.endpoint,
        description: adapter.description,
        status: health?.status || 'HEALTHY',
        lastSuccessfulSync: health?.lastSuccessfulSync || null,
        lastAttemptedSync: health?.lastAttemptedSync || null,
        consecutiveFailures: health?.consecutiveFailures || 0,
        totalJobsFetched: health?.totalJobsFetched || 0,
        totalJobsInserted: health?.totalJobsInserted || 0,
        lastError: health?.lastError || null,
        responseTimeMs: health?.responseTimeMs || 0,
      };
    });

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error('[API] Error fetching sources:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SOURCE_FETCH_ERROR', message: 'Failed to retrieve source configurations.' },
    });
  }
}

export async function getSourceHealthById(req: Request, res: Response): Promise<void> {
  try {
    const { source } = req.params;
    const adapter = sourceRegistry.getAdapter(source);
    const health = await db.getSourceHealth(source);

    if (!adapter && !health) {
      res.status(404).json({
        success: false,
        error: { code: 'SOURCE_NOT_FOUND', message: `Source '${source}' not found.` },
      });
      return;
    }

    // Return sanitized status without exposing credentials
    const status = (health?.status || 'HEALTHY').toLowerCase();
    const responsePayload = {
      source: (adapter?.id || source).toLowerCase(),
      status: status === 'healthy' ? 'healthy' : status === 'unavailable' ? 'unavailable' : 'degraded',
      lastCheckedAt: health?.lastAttemptedSync || health?.lastSuccessfulSync || new Date().toISOString(),
      responseTimeMs: health?.responseTimeMs || 0,
      // Include extended audit data for system monitor
      totalJobsFetched: health?.totalJobsFetched || 0,
      totalJobsInserted: health?.totalJobsInserted || 0,
      lastError: health?.lastError || null,
    };

    res.json({
      success: true,
      ...responsePayload,
      data: health || responsePayload,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch source health.' },
    });
  }
}
