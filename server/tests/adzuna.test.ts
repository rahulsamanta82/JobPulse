import { validateAdzunaConfig, AdzunaConfig } from '../config/adzunaConfig';
import { mapAdzunaJobToNormalized, mapAdzunaEmploymentType, mapAdzunaRemoteType, formatAdzunaSalary } from '../services/normalization/adzunaMapper';
import { generateDeduplicationKey } from '../services/deduplication/deduplicator';
import { AdzunaRawJob, AdzunaApiClient } from '../services/sources/adzunaClient';
import { db } from '../db/db';

async function runTestSuite() {
  console.log('====================================================');
  console.log(' Running Adzuna Integration & Ingestion Architecture Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Config Validation Tests
  console.log('Suite 1: Configuration Validation');
  const validConfig: AdzunaConfig = {
    baseUrl: 'https://api.adzuna.com/v1/api',
    appId: 'test_app_id_123',
    appKey: 'test_secret_key_456',
    country: 'gb',
    maxPages: 3,
    resultsPerPage: 20,
    maxRetries: 3,
    requestTimeoutMs: 10000,
  };
  const validResult = validateAdzunaConfig(validConfig);
  assert(validResult.isValid === true && validResult.isConfigured === true, 'Valid config passes validation');

  const missingKeyConfig: AdzunaConfig = { ...validConfig, appKey: '' };
  const missingResult = validateAdzunaConfig(missingKeyConfig);
  assert(missingResult.isValid === false && missingResult.isConfigured === false, 'Missing credentials fails validation cleanly');
  assert(!missingResult.error?.includes('test_secret_key_456'), 'Error message does not leak sensitive keys');

  // 2. Field Normalization & Derivations
  console.log('\nSuite 2: Adzuna Field Normalization & Type Derivation');
  assert(mapAdzunaEmploymentType('permanent', 'full_time') === 'Full-time', 'Derives Full-time employment');
  assert(mapAdzunaEmploymentType('contract', '') === 'Contract', 'Derives Contract employment');
  assert(mapAdzunaEmploymentType('', 'part_time') === 'Part-time', 'Derives Part-time employment');

  assert(mapAdzunaRemoteType('Remote, UK', 'Software Engineer', 'Work from home') === 'Remote', 'Identifies Remote location');
  assert(mapAdzunaRemoteType('London', 'Hybrid Frontend Developer', 'Office 2 days') === 'Hybrid', 'Identifies Hybrid role');
  assert(mapAdzunaRemoteType('Manchester', 'Site Engineer', 'On-site presence required') === 'On-site', 'Identifies On-site role');

  assert(formatAdzunaSalary(60000, 80000, 'gb') === '£60,000 - £80,000', 'Formats GBP salary range');
  assert(formatAdzunaSalary(120000, 150000, 'us') === '$120,000 - $150,000', 'Formats USD salary range');
  assert(formatAdzunaSalary(1200000, 1800000, 'in') === '₹1,200,000 - ₹1,800,000', 'Formats INR salary range');
  assert(formatAdzunaSalary(undefined, undefined, 'in') === undefined, 'Handles missing salary cleanly');

  // 3. Complete Adzuna Job Mapping & Zod Schema Validation
  console.log('\nSuite 3: Adzuna Mapper to Canonical JobRecord');
  const sampleAdzunaRaw: AdzunaRawJob = {
    id: '492817291',
    title: '<strong>Senior TypeScript Full Stack Engineer</strong>',
    description: 'We are seeking an experienced engineer skilled in React, Node.js, TypeScript, and MongoDB to lead product features.',
    redirect_url: 'https://www.adzuna.co.uk/jobs/details/492817291?utm_medium=api',
    created: '2026-08-15T14:30:00Z',
    company: {
      display_name: 'Nexus Cloud Technologies',
    },
    location: {
      display_name: 'London, Greater London',
      area: ['UK', 'London'],
    },
    salary_min: 75000,
    salary_max: 95000,
    contract_type: 'permanent',
    contract_time: 'full_time',
    category: {
      label: 'IT Jobs',
      tag: 'it-jobs',
    },
  };

  const normResult = mapAdzunaJobToNormalized(sampleAdzunaRaw, 'gb');
  assert(normResult.success === true, 'Successfully maps valid Adzuna payload', normResult.error?.message);
  let sampleJobRecord: any = null;
  if (normResult.success && normResult.job) {
    const job = normResult.job;
    sampleJobRecord = job;
    assert(job.source === 'Adzuna', 'Sets source to Adzuna');
    assert(job.externalId === '492817291', 'Preserves external ID');
    assert(job.title === 'Senior TypeScript Full Stack Engineer', 'Strips HTML formatting from title');
    assert(job.companyName === 'Nexus Cloud Technologies', 'Extracts company name');
    assert(job.applyUrl === sampleAdzunaRaw.redirect_url, 'Preserves real redirect URL');
    assert(job.skills.includes('TypeScript') && job.skills.includes('React'), 'Extracts skills automatically');
    assert(job.deduplicationKey.length === 64, 'Generates valid SHA-256 deduplication key');
  }

  // 4. Malformed Payload Resilience
  console.log('\nSuite 4: Malformed Payload & Error Resilience');
  const malformedJob: AdzunaRawJob = {
    id: '',
    title: '',
    description: '',
    redirect_url: 'invalid-url',
    created: 'invalid-date',
  };
  const malformedResult = mapAdzunaJobToNormalized(malformedJob, 'gb');
  assert(malformedResult.success === false, 'Rejects malformed job record gracefully');
  assert(Boolean(malformedResult.error?.code), 'Produces structured error code for rejection');

  // 5. Idempotent Deduplication
  console.log('\nSuite 5: Deduplication Hash Idempotency');
  const key1 = generateDeduplicationKey({
    source: 'Adzuna',
    externalId: '492817291',
    companyName: 'Nexus Cloud Technologies',
    title: 'Senior TypeScript Full Stack Engineer',
    location: 'London',
    applyUrl: 'https://www.adzuna.co.uk/jobs/details/492817291',
  });
  const key2 = generateDeduplicationKey({
    source: 'Adzuna',
    externalId: '492817291',
    companyName: 'Nexus Cloud Technologies',
    title: 'Senior TypeScript Full Stack Engineer',
    location: 'London',
    applyUrl: 'https://www.adzuna.co.uk/jobs/details/492817291',
  });
  assert(key1 === key2, 'Generates identical hash for identical job record (Idempotency)');

  // 6. Database Persistence & Deduplication Ingestion Behavior
  console.log('\nSuite 6: Database Storage & Deduplication Ingestion');
  await db.initialize();
  if (sampleJobRecord) {
    // First sync insert
    const insertResult = await db.upsertJob(sampleJobRecord);
    assert(insertResult.result === 'inserted' || insertResult.result === 'duplicate', 'Initial job insertion succeeds');

    // Second sync of identical job
    const duplicateResult = await db.upsertJob(sampleJobRecord);
    assert(duplicateResult.result === 'duplicate', 'Second sync correctly detects existing job without duplicating document');

    // Query job by ID
    const fetchedJob = await db.getJobById(sampleJobRecord.id);
    assert(fetchedJob !== null && fetchedJob.externalId === '492817291', 'Reads persisted job document correctly');

    // Filter jobs query
    const queryRes = await db.queryJobs({ search: 'TypeScript', limit: 10 });
    assert(queryRes.items.length > 0, 'Query and search filtering works against stored collection');
  }

  // 7. Source Health State Tracking
  console.log('\nSuite 7: Source Health Telemetry');
  await db.upsertSourceHealth({
    sourceId: 'adzuna',
    name: 'Adzuna',
    type: 'api',
    endpoint: 'https://api.adzuna.com/v1/api/jobs/gb/search/1',
    status: 'HEALTHY',
    lastSuccessfulSync: new Date().toISOString(),
    lastAttemptedSync: new Date().toISOString(),
    consecutiveFailures: 0,
    totalJobsFetched: 20,
    totalJobsInserted: 20,
    lastError: null,
    responseTimeMs: 240,
  });

  const health = await db.getSourceHealth('adzuna');
  assert(health !== null && health.status === 'HEALTHY', 'Source health successfully recorded and queried');

  console.log('\n====================================================');
  console.log(` Test Run Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
