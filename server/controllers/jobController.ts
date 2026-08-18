import { Request, Response } from 'express';
import { db } from '../db/db';
import { JobQueryParams } from '../../src/types/shared';

export async function getJobs(req: Request, res: Response): Promise<void> {
  try {
    const params: JobQueryParams = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      location: typeof req.query.location === 'string' ? req.query.location : undefined,
      remoteType: typeof req.query.remoteType === 'string' ? req.query.remoteType : undefined,
      employmentType: typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined,
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      sort: (req.query.sort as any) || 'newest',
      page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 12,
    };

    const result = await db.queryJobs(params);

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err: any) {
    console.error('[API] Error querying jobs:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'QUERY_ERROR',
        message: 'Failed to retrieve jobs from database',
      },
    });
  }
}

export async function getJobById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Job ID parameter is required' },
      });
      return;
    }

    const job = await db.getJobById(id);
    if (!job) {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: `Job with ID '${id}' was not found.` },
      });
      return;
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (err: any) {
    console.error('[API] Error fetching job:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred while fetching the job.' },
    });
  }
}
