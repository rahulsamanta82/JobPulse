import mongoose, { Schema, Model } from 'mongoose';
import { JobRecord, SourceHealth, IngestionRun, SourceStatus, IngestionStatus, RemoteType, EmploymentType } from '../../src/types/shared';

// Job Schema
const JobSchema = new Schema(
  {
    externalId: { type: String, required: true, index: true },
    source: { type: String, required: true, index: true },
    title: { type: String, required: true, index: true },
    companyName: { type: String, required: true, index: true },
    companyLogoUrl: { type: String },
    location: { type: String, required: true, default: 'Remote', index: true },
    description: { type: String, required: true },
    descriptionSnippet: { type: String, required: true },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Other'],
      default: 'Full-time',
      index: true,
    },
    remoteType: {
      type: String,
      enum: ['Remote', 'Hybrid', 'On-site'],
      default: 'Remote',
      index: true,
    },
    salary: { type: String },
    applyUrl: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    publishedAt: { type: Date, required: true, default: Date.now, index: true },
    ingestedAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
    categories: [{ type: String }],
    skills: [{ type: String }],
    deduplicationKey: { type: String, required: true, unique: true, index: true },
    rawData: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  },
  {
    timestamps: false,
    collection: 'jobs',
  }
);

JobSchema.index({ externalId: 1, source: 1 });
JobSchema.index({ publishedAt: -1 });

// Source Health Schema
const SourceHealthSchema = new Schema(
  {
    sourceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['api', 'rss', 'sandbox'], required: true },
    endpoint: { type: String, required: true },
    status: { type: String, enum: ['HEALTHY', 'DEGRADED', 'UNAVAILABLE'], default: 'HEALTHY' },
    lastSuccessfulSync: { type: Date, default: null },
    lastAttemptedSync: { type: Date, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    totalJobsFetched: { type: Number, default: 0 },
    totalJobsInserted: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    responseTimeMs: { type: Number, default: 0 },
  },
  {
    collection: 'source_health',
  }
);

// Ingestion Run Schema
const IngestionRunSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, index: true },
    trigger: { type: String, enum: ['MANUAL', 'SCHEDULED', 'STARTUP'], default: 'MANUAL' },
    status: { type: String, enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'IN_PROGRESS'], default: 'IN_PROGRESS' },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    fetched: { type: Number, default: 0 },
    parsed: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    errors: [
      {
        code: String,
        message: String,
        itemIdentifier: String,
        timestamp: { type: Date, default: Date.now },
        rawSample: String,
      },
    ],
    summaryMessage: String,
  },
  {
    suppressReservedKeysWarning: true,
    collection: 'ingestion_runs',
  }
);

export const JobModel: Model<any> = mongoose.models.Job || mongoose.model('Job', JobSchema);
export const SourceHealthModel: Model<any> = mongoose.models.SourceHealth || mongoose.model('SourceHealth', SourceHealthSchema);
export const IngestionRunModel: Model<any> = mongoose.models.IngestionRun || mongoose.model('IngestionRun', IngestionRunSchema);
