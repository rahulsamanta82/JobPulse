import { Router } from 'express';
import { getJobs, getJobById } from '../controllers/jobController';
import { getSources, getSourceHealthById } from '../controllers/sourceController';
import { triggerSync, getIngestionRuns, getIngestionRunById } from '../controllers/ingestionController';
import { getHealth, getDetectionSurfaceAnalysis } from '../controllers/healthController';

const router = Router();

// Health Check
router.get('/health', getHealth);
router.get('/system/detection-surface', getDetectionSurfaceAnalysis);

// Jobs Discovery API
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJobById);

// Sources & Health
router.get('/sources', getSources);
router.get('/sources/:source/health', getSourceHealthById);

// Ingestion Engine & Runs
router.post('/ingestion/sync', triggerSync);
router.get('/ingestion/runs', getIngestionRuns);
router.get('/ingestion/runs/:id', getIngestionRunById);

export default router;
