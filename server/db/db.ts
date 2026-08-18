import mongoose from 'mongoose';
import { JobRecord, SourceHealth, IngestionRun, JobQueryParams, PaginatedResult } from '../../src/types/shared';
import { JobModel, SourceHealthModel, IngestionRunModel } from './schema';

export interface DatabaseState {
  isConnected: boolean;
  type: 'MongoDB';
  databaseName: string;
  error?: string | null;
}

const DEFAULT_DB_NAME = 'ACDYONJobPulse';

class DatabaseManager {
  private state: DatabaseState = {
    isConnected: false,
    type: 'MongoDB',
    databaseName: DEFAULT_DB_NAME,
    error: null,
  };

  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  async initialize(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI?.trim();
    const dbName = process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME;
    this.state.databaseName = dbName;

    if (!mongoUri) {
      console.warn('[DB] MONGODB_URI is not set. MongoDB is required for production persistence.');
      this.state = {
        isConnected: false,
        type: 'MongoDB',
        databaseName: dbName,
        error: 'MONGODB_URI environment variable not configured',
      };
      return;
    }

    // Set up mongoose connection event listeners
    mongoose.connection.on('connected', () => {
      console.log(`[DB] Connected to MongoDB Atlas successfully. Database: ${this.state.databaseName}`);
      this.state.isConnected = true;
      this.state.error = null;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB connection disconnected.');
      this.state.isConnected = false;
    });

    mongoose.connection.on('error', (err: any) => {
      this.state.isConnected = false;
      const rawMsg = err?.message || '';
      if (rawMsg.includes('SSL') || rawMsg.includes('alert') || rawMsg.includes('whitelist') || rawMsg.includes('servers in your MongoDB Atlas cluster')) {
        this.state.error = 'MongoDB Atlas cluster access pending (whitelist IP 0.0.0.0/0 in Atlas Security -> Network Access)';
      } else {
        this.state.error = rawMsg || 'Database connection error';
      }
    });

    await this.connectWithRetry(mongoUri, dbName);
  }

  private async connectWithRetry(mongoUri: string, dbName: string): Promise<void> {
    if (this.isConnecting || mongoose.connection.readyState === 1) return;
    this.isConnecting = true;

    try {
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch (_) {}
      }

      await mongoose.connect(mongoUri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        autoIndex: true,
      });

      this.state = {
        isConnected: true,
        type: 'MongoDB',
        databaseName: mongoose.connection.name || dbName,
        error: null,
      };
    } catch (err: any) {
      try {
        await mongoose.disconnect();
      } catch (_) {}

      const rawMsg = err?.message || '';
      let normalizedError: string;
      if (rawMsg.includes('SSL') || rawMsg.includes('alert') || rawMsg.includes('whitelist') || rawMsg.includes('servers in your MongoDB Atlas cluster')) {
        normalizedError = 'MongoDB Atlas cluster access pending (whitelist IP 0.0.0.0/0 in Atlas Security -> Network Access)';
      } else {
        normalizedError = rawMsg || 'MongoDB connection offline';
      }

      this.state = {
        isConnected: false,
        type: 'MongoDB',
        databaseName: dbName,
        error: normalizedError,
      };
      this.scheduleReconnect(mongoUri, dbName);
    } finally {
      this.isConnecting = false;
    }
  }

  private scheduleReconnect(mongoUri: string, dbName: string): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setInterval(async () => {
      if (mongoose.connection.readyState === 1) {
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        return;
      }
      await this.connectWithRetry(mongoUri, dbName);
    }, 45000);
  }

  getState(): DatabaseState {
    const isReady = mongoose.connection.readyState === 1;
    return {
      ...this.state,
      isConnected: isReady,
      type: 'MongoDB',
      databaseName: mongoose.connection.name || this.state.databaseName || DEFAULT_DB_NAME,
    };
  }

  // --- JOB OPERATIONS ---

  async upsertJob(job: JobRecord): Promise<{ result: 'inserted' | 'updated' | 'duplicate'; id: string }> {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database offline: MongoDB connection is required for persistent job storage.');
    }

    try {
      const existing: any = await (JobModel as any).findOne({ deduplicationKey: job.deduplicationKey });
      if (existing) {
        existing.updatedAt = new Date();
        existing.title = job.title;
        existing.description = job.description;
        existing.descriptionSnippet = job.descriptionSnippet;
        existing.applyUrl = job.applyUrl;
        existing.salary = job.salary || existing.salary;
        existing.skills = job.skills;
        existing.categories = job.categories;
        await existing.save();
        return { result: 'duplicate', id: existing._id.toString() };
      }

      const newDoc = new JobModel({
        ...job,
        publishedAt: new Date(job.publishedAt),
        ingestedAt: new Date(job.ingestedAt),
        updatedAt: new Date(job.updatedAt),
      });
      const saved = await newDoc.save();
      return { result: 'inserted', id: saved._id.toString() };
    } catch (err: any) {
      if (err.code === 11000) {
        return { result: 'duplicate', id: job.deduplicationKey };
      }
      throw err;
    }
  }

  async getJobById(id: string): Promise<JobRecord | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    try {
      const doc: any = await (JobModel as any).findById(id).lean();
      if (doc) return this.mapMongoJob(doc);
    } catch {
      // Not a valid ObjectId, search by deduplicationKey or externalId
    }

    const doc: any = await (JobModel as any).findOne({
      $or: [{ deduplicationKey: id }, { externalId: id }],
    }).lean();

    if (doc) return this.mapMongoJob(doc);
    return null;
  }

  async queryJobs(params: JobQueryParams): Promise<PaginatedResult<JobRecord>> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 12));

    if (mongoose.connection.readyState !== 1) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const filter: Record<string, any> = { status: 'ACTIVE' };

    if (params.search) {
      const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { companyName: regex },
        { description: regex },
        { skills: regex },
        { categories: regex },
      ];
    }

    if (params.location) {
      filter.location = new RegExp(params.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (params.remoteType && params.remoteType !== 'all') {
      filter.remoteType = params.remoteType;
    }

    if (params.employmentType && params.employmentType !== 'all') {
      filter.employmentType = params.employmentType;
    }

    if (params.source && params.source !== 'all') {
      filter.source = new RegExp(params.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (params.category && params.category !== 'all') {
      filter.categories = params.category;
    }

    let sortOption: Record<string, 1 | -1> = { publishedAt: -1 };
    if (params.sort === 'oldest') sortOption = { publishedAt: 1 };
    if (params.sort === 'title_asc') sortOption = { title: 1 };
    if (params.sort === 'company_asc') sortOption = { companyName: 1 };

    const total = await (JobModel as any).countDocuments(filter);
    const docs: any[] = await (JobModel as any)
      .find(filter)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: docs.map((d) => this.mapMongoJob(d)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async countJobs(): Promise<number> {
    if (mongoose.connection.readyState !== 1) {
      return 0;
    }
    return await (JobModel as any).countDocuments({ status: 'ACTIVE' });
  }

  // --- SOURCE HEALTH OPERATIONS ---

  async upsertSourceHealth(health: SourceHealth): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    await (SourceHealthModel as any).findOneAndUpdate(
      { sourceId: health.sourceId },
      {
        ...health,
        lastSuccessfulSync: health.lastSuccessfulSync ? new Date(health.lastSuccessfulSync) : null,
        lastAttemptedSync: health.lastAttemptedSync ? new Date(health.lastAttemptedSync) : null,
      },
      { upsert: true }
    );
  }

  async getAllSourceHealth(): Promise<SourceHealth[]> {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const docs: any[] = await (SourceHealthModel as any).find({}).lean();
    return docs.map((d: any) => ({
      sourceId: d.sourceId,
      name: d.name,
      type: d.type,
      endpoint: d.endpoint,
      status: d.status,
      lastSuccessfulSync: d.lastSuccessfulSync ? new Date(d.lastSuccessfulSync).toISOString() : null,
      lastAttemptedSync: d.lastAttemptedSync ? new Date(d.lastAttemptedSync).toISOString() : null,
      consecutiveFailures: d.consecutiveFailures,
      totalJobsFetched: d.totalJobsFetched,
      totalJobsInserted: d.totalJobsInserted,
      lastError: d.lastError,
      responseTimeMs: d.responseTimeMs,
    }));
  }

  async getSourceHealth(sourceId: string): Promise<SourceHealth | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const doc: any = await (SourceHealthModel as any).findOne({ sourceId }).lean();
    if (!doc) return null;
    return {
      sourceId: doc.sourceId,
      name: doc.name,
      type: doc.type,
      endpoint: doc.endpoint,
      status: doc.status,
      lastSuccessfulSync: doc.lastSuccessfulSync ? new Date(doc.lastSuccessfulSync).toISOString() : null,
      lastAttemptedSync: doc.lastAttemptedSync ? new Date(doc.lastAttemptedSync).toISOString() : null,
      consecutiveFailures: doc.consecutiveFailures,
      totalJobsFetched: doc.totalJobsFetched,
      totalJobsInserted: doc.totalJobsInserted,
      lastError: doc.lastError,
      responseTimeMs: doc.responseTimeMs,
    };
  }

  // --- INGESTION RUNS ---

  async recordIngestionRun(run: IngestionRun): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const doc = new IngestionRunModel({
      ...run,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : null,
      errors: run.errors.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
    });
    await doc.save();
  }

  async getIngestionRuns(page: number = 1, limit: number = 20): Promise<PaginatedResult<IngestionRun>> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));

    if (mongoose.connection.readyState !== 1) {
      return {
        items: [],
        pagination: {
          page: p,
          limit: l,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const total = await (IngestionRunModel as any).countDocuments({});
    const docs: any[] = await (IngestionRunModel as any)
      .find({})
      .sort({ startedAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    const totalPages = Math.ceil(total / l) || 1;

    return {
      items: docs.map((d: any) => ({
        id: d.id,
        source: d.source,
        trigger: d.trigger,
        status: d.status,
        startedAt: new Date(d.startedAt).toISOString(),
        completedAt: d.completedAt ? new Date(d.completedAt).toISOString() : null,
        durationMs: d.durationMs,
        fetched: d.fetched,
        parsed: d.parsed,
        inserted: d.inserted,
        updated: d.updated,
        duplicates: d.duplicates,
        rejected: d.rejected,
        errors: (d.errors || []).map((e: any) => ({
          code: e.code,
          message: e.message,
          itemIdentifier: e.itemIdentifier,
          timestamp: new Date(e.timestamp).toISOString(),
          rawSample: e.rawSample,
        })),
        summaryMessage: d.summaryMessage,
      })),
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages,
        hasNext: p < totalPages,
        hasPrev: p > 1,
      },
    };
  }

  async getIngestionRunById(id: string): Promise<IngestionRun | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const doc: any = await (IngestionRunModel as any).findOne({ id }).lean();
    if (!doc) return null;
    return {
      id: doc.id,
      source: doc.source,
      trigger: doc.trigger as any,
      status: doc.status as any,
      startedAt: new Date(doc.startedAt).toISOString(),
      completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
      durationMs: doc.durationMs,
      fetched: doc.fetched,
      parsed: doc.parsed,
      inserted: doc.inserted,
      updated: doc.updated,
      duplicates: doc.duplicates,
      rejected: doc.rejected,
      errors: (doc.errors || []).map((e: any) => ({
        code: e.code,
        message: e.message,
        itemIdentifier: e.itemIdentifier,
        timestamp: new Date(e.timestamp).toISOString(),
        rawSample: e.rawSample,
      })),
      summaryMessage: doc.summaryMessage,
    };
  }

  private mapMongoJob(doc: any): JobRecord {
    return {
      id: doc._id.toString(),
      externalId: doc.externalId,
      source: doc.source,
      title: doc.title,
      companyName: doc.companyName,
      companyLogoUrl: doc.companyLogoUrl,
      location: doc.location,
      description: doc.description,
      descriptionSnippet: doc.descriptionSnippet,
      employmentType: doc.employmentType,
      remoteType: doc.remoteType,
      salary: doc.salary,
      applyUrl: doc.applyUrl,
      sourceUrl: doc.sourceUrl,
      publishedAt: new Date(doc.publishedAt).toISOString(),
      ingestedAt: new Date(doc.ingestedAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
      categories: doc.categories || [],
      skills: doc.skills || [],
      deduplicationKey: doc.deduplicationKey,
      rawData: doc.rawData,
      status: doc.status,
    };
  }
}

export const db = new DatabaseManager();

