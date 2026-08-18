# Architectural Decisions & Engineering Rationale (Acdyon Part 1)

## 1. Primary Strategy vs. Obvious Alternative (Why Permitted API over Scraping)
* **Strategy Selected**: Official developer REST API (Adzuna) backed by a source-agnostic adapter pipeline (`JobSourceAdapter`).
* **Why Not Scraping LinkedIn/Indeed**: Automated browser emulation and session spoofing violate platform Terms of Service, provoke rapid IP/account bans, trigger CAPTCHA challenges, and create brittle selector couplings. Operating via an official API proves production engineering discipline: rate-limit compliance, structured error handling, and deterministic schemas without platform hostility.

## 2. Trade-offs Under the Time Limit
* **Trade-off**: By selecting an authenticated REST API rather than an adversary scraping crawler, we trade away browser stealth mechanics (e.g., Puppeteer/Playwright stealth plugins) in favor of building a complete, hardened ingestion, normalization, deduplication, and persistence pipeline that runs reliably in production.
* **Adzuna Nuance**: Adzuna returns affiliate tracking redirect URLs (`redirect_url`). We preserve these canonical URLs verbatim so candidate redirection remains 100% authentic and trackable.

## 3. The Detection Surface (How Hostile Platforms Detect Automation)
In hostile scraping environments, detection occurs across several vector layers:
1. **Network & TLS Fingerprints**: Mismatched TLS cipher suites (JA3/JA4), HTTP/2 frame sequence anomalies, and non-residential IP ASN reputation.
2. **Browser Runtime Artifacts**: `navigator.webdriver` flag, Chrome DevTools Protocol (`Runtime.enable`) leaks, WebGL/Canvas rendering variances, and headless audio context signatures.
3. **Behavioral & Interaction Heuristics**: Linear mouse trajectories, instant DOM queries without human scroll hesitation, and unnatural request velocity.
* **Our Scope Boundary**: We intentionally **do not** implement CAPTCHA bypass, browser fingerprint spoofing, or proxy rotation for hostile evasion. For this assessment, we operate strictly within permitted API contracts.

## 4. Ingestion Strategy & Pacing
* **Controlled Pacing**: Strict bounds via `INGESTION_MAX_PAGES=3` and `INGESTION_RESULTS_PER_PAGE=20` to prevent quota exhaustion.
* **Rate-Limit Orchestration**: Intercepts HTTP 429 status, parses `Retry-After` headers, executes bounded exponential backoff (base 600ms), and transitions source health to `DEGRADED` rather than hammering the upstream server.
* **Scheduler Locking**: Ingestion runs maintain state locks (`isSyncing`) to prevent concurrent race conditions during background sync cycles.

## 5. Resilience & Schema Drift Handling
* **Upstream Failure Isolation**: Network timeouts (`AbortController`), 5xx server errors, or malformed JSON payloads fail safely without corrupting or deleting existing listings.
* **Schema Drift Protection**: `adzunaMapper.ts` uses strict Zod validations. If Adzuna modifies response keys, invalid candidates are safely logged to `IngestionRun.errors[]` while valid records continue processing.
* **Empty Response Resilience**: A 0-job return is recorded as an empty sync cycle and never misconstrued as a purge command.
* **Fallback Architecture**: If the primary source fails, the system logs the incident and can seamlessly query secondary permitted adapters (Remotive, WeWorkRemotely RSS) or display an honest fallback status.

## 6. Deduplication & Idempotent Persistence
* **Deterministic Hashing**: SHA-256 composite hash `sha256(source + ":" + externalId)` backed by a compound unique index in storage. Repeated syncs update modified metadata while producing 0 duplicate documents.

## 7. What We Would Build With One Real Week
* **Distributed Queue Architecture**: Replace in-process sync with BullMQ + Redis for distributed worker scaling and job concurrency.
* **Observability & OpenTelemetry**: Add distributed tracing, Prometheus metrics for ingestion latency/error budgets, and Slack/PagerDuty alert webhooks on `UNAVAILABLE` source health.
* **Dynamic Webhook Ingestion**: Implement bi-directional event ingestion for job board partners supporting push notifications.

## 8. Where AI Tools Helped
* **Assistance Scope**: Google AI Studio was used for code scaffolding, boilerplate validation schemas, and edge-case simulation design.
* **Engineering Ownership**: All business logic, adapter interfaces, Zod sanitization, data models, deduplication hashing, and fault-tolerance boundaries were authored, reviewed, and tested to meet strict production standards.

## 9. Production Architecture: Single Web Service (One-Link) on Render
* **Rationale**: Rather than maintaining split services (a static frontend hosting service + a backend API service) with cross-origin CORS overhead and multiple DNS configurations, JobPulse is architected as a cohesive **Single Web Service**.
* **Unified Pipeline**: Express serves `/api/*` REST endpoints and statically delivers the Vite-compiled React single page application (`dist/`) with full client-side SPA fallback.
* **Benefits**:
  1. Zero CORS latency/misconfiguration on production domain.
  2. One deployment URL (`https://jobpulse.onrender.com`), single environment configuration, and single health monitoring target.
  3. Seamless local development parity (`npm run dev`) with production runtime (`npm start`).

