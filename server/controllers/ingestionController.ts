import { Request, Response } from 'express';
import { db } from '../db/db';
import { ingestionEngine } from '../services/ingestion/ingestionEngine';

export async function triggerSync(req: Request, res: Response): Promise<void> {
  try {
    const { sourceId, simulateScenario, limit } = req.body || {};

    console.log(`[API] Ingestion sync requested (Source: ${sourceId || 'all'}, Scenario: ${simulateScenario || 'normal'})`);

    const runs = await ingestionEngine.runSync({
      sourceId,
      simulateScenario,
      limitPerSource: limit ? Number(limit) : undefined,
      trigger: 'MANUAL',
    });

    res.json({
      success: true,
      data: {
        runs,
        totalInserted: runs.reduce((acc, r) => acc + r.inserted, 0),
        totalDuplicates: runs.reduce((acc, r) => acc + r.duplicates, 0),
        totalErrors: runs.reduce((acc, r) => acc + r.errors.length, 0),
      },
    });
  } catch (err: any) {
    console.error('[API] Ingestion sync error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INGESTION_SYNC_FAILED',
        message: err.message || 'An error occurred during ingestion synchronization.',
      },
    });
  }
}

export async function getIngestionRuns(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await db.getIngestionRuns(page, limit);

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err: any) {
    console.error('[API] Error fetching ingestion runs:', err);
    res.status(500).json({
      success: false,
      error: { code: 'RUNS_FETCH_ERROR', message: 'Failed to retrieve ingestion runs history.' },
    });
  }
}

export async function getIngestionRunById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const run = await db.getIngestionRunById(id);

    if (!run) {
      res.status(404).json({
        success: false,
        error: { code: 'RUN_NOT_FOUND', message: `Ingestion run '${id}' not found.` },
      });
      return;
    }

    res.json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch run details.' },
    });
  }
}
