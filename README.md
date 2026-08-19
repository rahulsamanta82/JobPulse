# JobPulse — Production-Quality Job Ingestion & Discovery Platform

> Acdyon Technologies Engineering Frontend Challenge (Part 1 & Render Production Ready)  
> Full-stack TypeScript architecture featuring resilient background ingestion, multi-source adapters, normalization pipelines, deterministic SHA-256 deduplication, and a live Clean Minimalist discovery dashboard.
[![Live Demo](https://img.shields.io/badge/Live-Demo-success)](https://jobpulse-tj7o.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/rahulsamanta82/JobPulse)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://www.mongodb.com/)

---

## 1. Executive Summary & Architecture

JobPulse is built as a **Single Web Service (One-Link)** application. A single unified Node.js / Express process serves both the backend REST API (`/api/*`) and the production React / Vite Single Page Application (SPA) with full client-side route fallback.

```text
                          
                              Internet
                                  │
                                  ▼
                         ┌─────────────────┐
                         │     Render      │
                         │  Web Service    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Node.js /       │
                         │ Express Server  │
                         └───────┬─────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
                   ▼                           ▼
              REST API                    React / Vite
              /api/*                       dist/
                   │                           │
                   ▼                           │
          ┌─────────────────┐                  │
          │ Ingestion Layer │                  │
          └────────┬────────┘                  │
                   │                           │
       ┌───────────┼────────────┐              │
       │           │            │              │
       ▼           ▼            ▼              │
    Adzuna     Remotive     WeWorkRemotely     │
       │           │            │              │
       └───────────┼────────────┘              │
                   │                           │
                   ▼                           │
                Jobicy                         │
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
                          MongoDB Atlas
```






### Key Architectural Strengths:
* **Single Domain / Single Service**: No separate frontend/backend deployments required. One URL handles UI, API, and WebSocket/health monitoring.
* **Unified Same-Origin API Calls**: The frontend calls `/api/*` endpoints directly without CORS overhead or hardcoded domains.
* **SPA Routing Fallback**: Direct browser access and hard refreshes on any route (`/`, `/system`, `/system/ingestion`, `/jobs/:id`) work seamlessly without 404 errors.
* **MongoDB Atlas Persistence**: Job listings, deduplication keys, ingestion run audit logs,and source health metrics persist reliably in MongoDB across service restarts.
* **Multi-Source Ingestion Pipeline**: Real adapters for Adzuna (REST API), Remotive (API), WeWorkRemotely (RSS), Jobicy (API), and QA Resilience Sandbox (edge-case simulations).

---

## 2. Supported Job Sources & Adapters

| Source | Protocol / Ingestion Format | Characteristics & Features |
|---|---|---|
| **Adzuna** | Official REST API (`https://api.adzuna.com/v1/api`) | High-fidelity regional data (GB, US, etc.), salary formatting, category classification, canonical affiliate redirect URLs. |
| **Remotive** | REST API (`https://remotive.com/api/remote-jobs`) | Remote software engineering listings, tag extraction, verified application URLs. |
| **WeWorkRemotely** | XML / RSS 2.0 Feed | High-volume remote engineering feed, CDATA HTML description stripping, direct listing URLs. |
| **Jobicy** | REST API (`https://jobicy.com/api/v2/remote-jobs`) | Modern global remote job feed, multi-tag categorization, direct job application links. |
| **QA Resilience Sandbox** | In-memory edge-case simulator | Simulates HTTP 429 rate limits, malformed JSON, schema drift, partial failures, and duplicate collisions without affecting production feeds. |

---

## 3. Environment Variables Reference

All credentials and configuration are read securely from environment variables. **No secrets or credentials are ever exposed to the client-side browser.**

Create a `.env` file from `.env.example`:

```bash
# Runtime Environment
NODE_ENV=
PORT=

# Database Configuration (MongoDB Atlas connection string)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ACDYONJobPulse?retryWrites=true&w=majority
MONGODB_DB_NAME=ACDYONJobPulse

# Allowed CORS origin for local dev (in production same-origin is used automatically)
FRONTEND_URL=

# Job Source Configuration (Adzuna Developer API)
JOB_SOURCE_APP_ID=your_adzuna_app_id
JOB_SOURCE_API_KEY=your_adzuna_api_key
ADZUNA_COUNTRY=in

# Ingestion Engine Parameters
INGESTION_INTERVAL_MINUTES=
INGESTION_MAX_PAGES=
INGESTION_RESULTS_PER_PAGE=
INGESTION_MAX_RETRIES=
INGESTION_REQUEST_TIMEOUT_MS=
```

---

## 4. Local Development Setup

### Prerequisites
* **Node.js**: `v18.x`, `v20.x`, or `v22.x`
* **npm**: `v9.x` or `v10.x`
* **MongoDB Atlas** database connection string (or local MongoDB)

### Step-by-Step Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rahulsamanta82/JobPulse.git
   cd jobpulse
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual `MONGODB_URI` and optional `JOB_SOURCE_APP_ID` / `JOB_SOURCE_API_KEY`.

4. **Run automated test suite**:
   ```bash
   npm test
   ```
   *Executes all 28 integration test suites covering Adzuna mapping, Zod schema validation, SHA-256 deduplication idempotency, rate-limit backoff, and MongoDB persistence.*

5. **Start local development server**:
   ```bash
   npm run dev
   ```
   *Express server with Vite development middleware starts on `http://localhost:3000`.*

6. **Open in browser**:
   Navigate to `http://localhost:3000` to interact with the discovery feed, system monitor, and sync triggers.

---

## 5. Local Production-Style Testing

To simulate the exact production build and execution environment locally:

1. **Build the full project**:
   ```bash
   npm run build
   ```
   *Compiles Vite frontend assets into `dist/` and bundles `server.ts` into `dist/server.cjs` via esbuild.*

2. **Start the production server**:
   ```bash
   npm start
   ```
   *Launches `node dist/server.cjs` in production mode serving both `/api/*` and static SPA `dist/`.*

3. **Verify endpoints**:
   * Health Check: `curl http://localhost:3000/api/health`
   * Jobs Feed: `curl http://localhost:3000/api/jobs`
   * SPA Route: Open `http://localhost:3000/system` in browser and hit Refresh.

---

## 6. Render One-Link Deployment Guide

Deploying JobPulse to **Render** as a single, unified web service takes less than 3 minutes:

### Step 1: Push Code to GitHub
Ensure all changes are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: configure Render one-link production deployment"
git push origin main
```

### Step 2: Create Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repo.
4. Choose the repository and set the following configuration:

| Field | Configuration Value |
|---|---|
| **Name** | `jobpulse` (or your preferred service name) |
| **Language / Runtime** | `Node` |
| **Region** | Choose closest to your users / MongoDB Atlas |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | `Free` (or higher) |

### Step 3: Add Environment Variables in Render
In the **Environment** section of your Render Web Service, configure:

* `NODE_ENV`: `production`
* `MONGODB_URI`: Your MongoDB Atlas connection URI (`mongodb+srv://...`)
* `MONGODB_DB_NAME`: `ACDYONJobPulse`
* `JOB_SOURCE_APP_ID`: *(Optional)* Your Adzuna App ID
* `JOB_SOURCE_API_KEY`: *(Optional)* Your Adzuna API Key
* `ADZUNA_COUNTRY`: `gb`
* `INGESTION_INTERVAL_MINUTES`: `60`
* `INGESTION_MAX_PAGES`: `3`
* `INGESTION_RESULTS_PER_PAGE`: `20`
* `INGESTION_MAX_RETRIES`: `3`
* `INGESTION_REQUEST_TIMEOUT_MS`: `10000`

> **Note on PORT**: Render automatically sets the `PORT` environment variable. The JobPulse server dynamically binds to `process.env.PORT || 3000`.

### Step 4: Deploy & Verify
1. Click **Deploy Web Service**.
2. Once the build completes, your single public URL will be live (e.g., `https://jobpulse.onrender.com`).
3. Verify your health check: `https://jobpulse.onrender.com/api/health`
4. Verify your frontend: `https://jobpulse.onrender.com`

---

## 7. Health Endpoint & Telemetry

### `GET /api/health`
Returns comprehensive system, database, and source health status without exposing sensitive credentials.

```json
{
  "status": "ok",
  "systemStatus": "HEALTHY",
  "database": {
    "status": "connected",
    "type": "MongoDB",
    "databaseName": "ACDYONJobPulse",
    "jobsCount": 142,
    "error": null
  },
  "sources": [
    {
      "sourceId": "adzuna",
      "name": "Adzuna Developer API",
      "status": "HEALTHY",
      "lastSuccessfulSync": "2026-08-18T19:00:00.000Z",
      "consecutiveFailures": 0,
      "responseTimeMs": 340
    },
    {
      "sourceId": "remotive",
      "name": "Remotive API",
      "status": "HEALTHY",
      "lastSuccessfulSync": "2026-08-18T19:00:00.000Z",
      "consecutiveFailures": 0,
      "responseTimeMs": 280
    }
  ],
  "scheduler": {
    "enabled": true,
    "intervalMinutes": 60
  },
  "system": {
    "uptimeSeconds": 3600,
    "memoryUsageMb": 85,
    "nodeVersion": "v22.23.1",
    "environment": "production",
    "timestamp": "2026-08-18T19:15:00.000Z"
  },
  "version": "1.0.0"
}
```

---

## 8. Ingestion, Normalization & Deduplication Details

1. **Source Adapter Layer (`/server/services/sources/`)**:
   * Communicates with external APIs with timeout guards (`AbortController`), structured user-agent headers, and exponential backoff retry.
   * Intercepts HTTP 429 rate limit responses, inspects `Retry-After` headers, pauses execution respectfully, and records structured audit events.
2. **Normalization Layer (`/server/services/normalization/`)**:
   * Translates arbitrary external source payloads into canonical `JobRecord` objects.
   * Cleans and strips HTML from titles and descriptions.
   * Derives `employmentType` ('Full-time', 'Part-time', 'Contract', 'Internship') and `remoteType` ('Remote', 'Hybrid', 'On-site').
   * Formats localized salary strings (`£65,000 - £80,000`).
   * Validates all records against strict Zod schema constraints.
3. **Deterministic Deduplication (`/server/services/deduplication/`)**:
   * Computes collision-resistant SHA-256 composite hash: `sha256(source + ":" + externalId)` with semantic title+company fallback.
   * Backed by a compound unique index in MongoDB, ensuring zero duplicate documents.
4. **URL Validation & Sanitization (`/server/services/normalization/urlValidator.ts` & `/src/lib/urlUtils.ts`)**:
   * Enforces legitimate HTTP/HTTPS application URLs.
   * Actively rejects placeholder domains (`example.com`, `placeholder.com`, etc.) and malformed pseudo-protocols.

---

## 9. Verification Checklist

- [x] Single Web Service one-link architecture (Express serves `/api/*` + `dist/` SPA)
- [x] Dynamic PORT binding (`process.env.PORT || 3000`) on host `0.0.0.0`
- [x] Client-side SPA routing fallback (direct access & refresh on `/system`, `/system/ingestion`, etc.)
- [x] Relative frontend API communication (`/api/...`) with zero hardcoded URLs
- [x] MongoDB Atlas persistent storage with embedded memory fallback
- [x] Real multi-source adapters (Adzuna, Remotive, WeWorkRemotely, Jobicy)
- [x] QA Resilience Sandbox adapter for edge-case simulations
- [x] Zero credential exposure to frontend or version control
- [x] Clean Minimalist UI with live search, filters, pagination, and dark/light mode
- [x] Full error audit trail and system health telemetry (`/api/health`)
- [x] 28/28 automated integration test suites passing cleanly
