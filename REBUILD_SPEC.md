# Sales Quotation Memory System — Complete Rebuild Specification

This document is a comprehensive, implementation-ready specification to recreate the Sales Quotation Memory System with an advanced code generation assistant. It consolidates features, architecture, data model, Gmail parsing pipeline, REST APIs, frontend scope, environment, and a step-by-step rebuild plan with acceptance criteria.

## 1) Executive Summary

The system helps sales teams maintain a pricing memory by ingesting quotation emails and master lists (materials/clients), building a client×material price history, and generating consistent quotes. It includes a Gmail-aware ingestion pipeline (HTML-first with GPT fallback), fuzzy-matching and learning, CRUD management, analytics, and a Quote Builder with Gmail-ready Markdown output.

## 2) Functional Scope and Features

- Master Data Management
  - Import materials and clients from `Memory.xlsx` or CSV upload
  - CRUD for materials and clients
  - Source tracking on entities: `master`, `gmail`, `manual_ui`

- Gmail Ingestion (quotation memory)
  - OAuth-based Gmail integration
  - Periodic ingestion of quotation-like emails
  - HTML table parser (primary) → fast, deterministic
  - GPT-4o Mini parser (fallback) → robust when HTML is missing/irregular
  - Fuzzy matching of materials/clients with learned aliases
  - Low-confidence review queue with human approval/correction
  - Complete ingestion log + parsing history for analytics/improvement

- Price History & Quote Builder
  - Price history at (material, client) with metadata (unit, quantities, Ex Works, delivery)
  - Create/update/delete quotes and items; auto-add to price history
  - Quote Markdown generator for Gmail copy-paste

- Search & Analytics
  - Global search (materials, clients, recent quotes)
  - Analytics: dashboard KPIs, top materials/clients, material price trends, monthly quotes summary
  - Data quality metrics (coverage of HSN, descriptions, emails, etc.)

## 3) Architecture Overview

- Backend: Node.js + Express, SQLite (file DB) via `sqlite3` with a thin `Database` helper
- Models: `Material`, `Client`, `PriceHistory`
- Services:
  - `ExcelImportService`: imports master lists from Excel/CSV
  - `GmailIngestionService`: authentication, email fetch, processing pipeline, review queue
  - `HTMLTableParser`: structured HTML extraction for quotation tables
  - `GPTParsingService`: GPT-4o Mini JSON extraction (optional, requires API key)
  - `FuzzyMatchingService`: Fuse.js matching and alias support
  - `LearningService`: alias learning, parsing telemetry, cleanup/export
- Routes: `materials`, `clients`, `import`, `gmail`, `quotes`, `analytics`, `search`
- Static: serves built frontend from `client/dist`
- Ports:
  - Server default: 3001 (configurable via `PORT`)
  - Frontend dev: 5173 with Vite proxy `/api -> http://localhost:3001`

### 3.1 Request Flow (Typical)
1. Frontend calls `/api/...`
2. Express route validates and delegates to model/service
3. SQLite CRUD via `Database` helper
4. Response with JSON payload; errors standardized

### 3.2 Gmail Ingestion Flow (High-level)
1. OAuth credentials → Gmail client
2. Search for quotation-related threads (subject/body keywords)
3. For each email:
   - Extract body parts (HTML and plain)
   - Try HTMLTableParser → if high confidence, use
   - Else call GPTParsingService (if key configured)
   - Cross-validate if both parsers succeed
   - Fuzzy-match materials/clients (aliases, exact, then fuzzy)
   - Persist new materials/clients where needed; add price history
   - Log success/failure; queue low-confidence for review

## 4) Data Model (SQLite)

Core entities and supporting tables with key fields:

- `materials`
  - id, name, description, hsn_code, source, normalized_name, created_at, updated_at
  - UNIQUE(normalized_name, source)

- `clients`
  - id, name, email, contact, source, normalized_name, created_at, updated_at
  - UNIQUE(normalized_name, source)

- `price_history`
  - id, material_id, client_id, rate_per_unit, currency, unit, quantity,
    ex_works, ex_works_location, delivery_cost, quoted_at, source, email_thread_id, created_at

- `quotes`, `quote_items`
  - Quote header with status and totals; line items mirror price-history fields
  - Quote create/update also writes to `price_history` (source=`manual_ui`)

- `gmail_ingestion_log`
  - thread_id (unique), message_id, subject, sender_email, processed_at, items_extracted, status, error_message

- `material_aliases`
  - material_id, alias, source (`manual` | `learned` | `correction`)

- Telemetry tables
  - `parsing_history` (method, confidence, items, cost, processing_time)
  - `parsing_failures` (method, error, email metadata)
  - `review_queue` (low-confidence extractions requiring human review)

See `server/database/schema.sql` for the complete SQL.

## 5) REST API Contracts (Selected)

Base path: `/api`

### 5.1 Materials
- GET `/materials?includeSource=true|false`
- GET `/materials/:id`
- POST `/materials` { name, description?, hsnCode? }
- PUT `/materials/:id` { name?, description?, hsnCode? }
- DELETE `/materials/:id`
- GET `/materials/search/:query`

### 5.2 Clients
- Same pattern as Materials; `email` and `contact` fields supported

### 5.3 Price History
- GET `/price-history/material/:materialId?clientId=&limit=`
- GET `/price-history/latest/:materialId?clientId=`
- POST `/price-history` { materialId, clientId, ratePerUnit, unit, ... }

### 5.4 Quotes
- GET `/quotes?status=&clientId=&limit=`
- GET `/quotes/:id` (with items)
- POST `/quotes` { clientId, quoteNumber?, items[], notes? }
- PUT `/quotes/:id` { status?, notes?, items? }
- DELETE `/quotes/:id`
- GET `/quotes/:id/markdown`
- GET `/quotes/stats/summary`

### 5.5 Analytics
- GET `/analytics/dashboard`
- GET `/analytics/materials/top?limit=`
- GET `/analytics/clients/top?limit=`
- GET `/analytics/materials/:id/price-trend?days=`
- GET `/analytics/quotes/monthly?months=`
- GET `/analytics/gmail/performance`
- GET `/analytics/search/popular`
- GET `/analytics/data-quality`

### 5.6 Search
- GET `/search/global?q=&limit=`
- GET `/search/materials?...`
- GET `/search/clients?...`
- GET `/search/prices?...`
- GET `/search/suggestions?q=&type=all|materials|clients&limit=`

### 5.7 Gmail
- GET `/gmail/auth-url`
- POST `/gmail/auth-callback` { code }
- POST `/gmail/ingest`
- GET `/gmail/ingestion-log?limit=`
- GET `/gmail/stats`
- GET `/gmail/review-queue?status=&search=&limit=`
- POST `/gmail/review-queue/:id/approve`
- POST `/gmail/review-queue/:id/reject`
- POST `/gmail/review-queue/:id/correct` { corrections }

## 6) Gmail Parsing Pipeline (Detailed)

### 6.1 Retrieval and Selection
- Query Gmail by keywords in subject/body: `(quotation|quote|price|proposal)`
- For each message: fetch headers, threadId, payload, and extract HTML/plain body

### 6.2 HTML-First Parsing
- `HTMLTableParser`
  - Locates the best matching table by scoring headers (MATERIAL, RATE, QTY, UNIT, HSN, EX WORKS)
  - Builds a column map from header text
  - Iterates rows → extracts: `material`, `quantity`, `unit`, `ratePerUnit`, `hsnCode`, `exWorks`
  - Normalization: uppercase materials, robust INR price parsing, unit normalization (KG/NOS/BOX/LTR/ROLL/MT)
  - Confidence scoring per-item and overall; fast and deterministic

### 6.3 GPT Fallback (Optional)
- `GPTParsingService` (model: `gpt-4o-mini`)
  - Only used when HTML confidence < threshold or HTML missing
  - System prompt enforces JSON output and extraction rules
  - User prompt includes email body and lists of known materials/clients to improve matching
  - Returns normalized JSON with `client`, `items[]`, `terms`, `metadata`, confidence, and cost tokens

### 6.4 Cross-Validation
- If both parsers succeed, prefer GPT structure but factor HTML confidence
- Boost final confidence when item counts agree

### 6.5 Fuzzy Matching & Learning
- `FuzzyMatchingService` with Fuse.js indices for materials and clients
  - Matching order: alias → exact normalized → fuzzy candidates → business rules boosts/penalties
  - Material/client aliases learned from corrections or approvals
- `LearningService`
  - Records parsing history and failures
  - Stores aliases; exports/imports learning data; cleanup/retention policies

### 6.6 Persistence & Review
- New materials/clients created with appropriate `source`
- Price history appended per extracted item
- Low-confidence results added to `review_queue` for approval/correction
- All processed messages logged in `gmail_ingestion_log`

## 7) Frontend Specification

- Tech: React 18 + Vite + Axios
- Dev server: 5173; Vite proxy `/api -> http://localhost:3001`
- Pages
  - Dashboard: surfaced analytics from backend endpoints
  - Materials: CRUD, search, HSN/description quality indicators
  - Clients: CRUD, search, email/contact coverage
  - Import: upload Excel/CSV; trigger `Memory.xlsx` import; analyze workbook
  - Quote Builder: select client, add materials, show latest price suggestions, export Gmail Markdown
  - Gmail Review Queue: approve/reject/correct low-confidence extractions
- API client: shared Axios instance with `baseURL='/api'`

## 8) Environment & Configuration

- Node.js: 18 LTS recommended (works on ≥16)
- Env Variables
  - `DATABASE_PATH` (default `./data/sales.db`)
  - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`
  - `OPENAI_API_KEY` (optional; enables GPT fallback)
  - `JWT_SECRET` (reserved for future auth)
  - `PORT` (default 3001)
  - `NODE_ENV` (`development`|`production`)
- CORS: enable for dev as needed
- Scheduling: daily ingestion cron in production (9 AM)

## 9) Dev, Build, Deploy

### 9.1 Local Development
```
# Backend only
npm run server:dev  # Express on :3001

# Frontend only
cd client && npm run dev  # Vite on :5173, proxy to :3001

# Both (if using a combined script)
npm run dev
```

### 9.2 Migrations & Data
```
npm run migrate            # Initialize schema
curl -X POST http://localhost:3001/api/import/master-data  # If Memory.xlsx present
```

### 9.3 Production
```
cd client && npm run build
cd .. && npm start         # Serves client/dist and API
```

## 10) Non-Functional Requirements

- Reliability: deterministic HTML parser; DB transactions for quote creation
- Observability: console logs (upgradeable to structured logs), parsing telemetry tables
- Security: secure storage for OAuth tokens (filesystem/DB/secret store); CORS controls; input validation
- Cost control: prioritize HTML parser to limit GPT usage

## 11) Rebuild Plan (For Advanced Assistant)

1. Bootstrap
   - Node project, Express app skeleton, `Database` helper, `.env`
   - SQLite schema from this spec (see schema outline above)
2. Models & Base Routes
   - Implement `Material`, `Client`, `PriceHistory` with CRUD and search
   - Wire routes: `materials`, `clients`, `price-history`
3. Quote Module
   - `quotes` routes (CRUD, markdown, stats) and line-item handling
   - Ensure writes to `price_history`
4. Import Module
   - `ExcelImportService` with Memory.xlsx and upload endpoints
5. Gmail Ingestion
   - OAuth endpoints → Gmail client init → message search → email processing pipeline
   - Implement `HTMLTableParser`, `GPTParsingService` (optional), and `FuzzyMatchingService`
   - Persistence, logging, review queue endpoints
6. Analytics & Search
   - Add dashboard endpoints; top materials/clients; trends; monthly quotes; data quality
   - Global and advanced search endpoints
7. Frontend
   - React + Vite app with pages listed above; Axios service at `/api`
   - Vite proxy to backend port 3001
8. QA & Acceptance Tests
   - Seed with `Memory.xlsx`; verify CRUD, search, price suggestions, markdown output
   - Simulate ingestion with sample HTML and plain-text emails
   - Validate low-confidence review queue and corrections → alias learning

## 12) Acceptance Criteria

- Importing `Memory.xlsx` populates materials/clients marked as `master`
- Gmail ingestion logs attempts; extracts items from HTML tables; falls back to GPT when needed
- Fuzzy matching links extracted items to existing entities with ≥0.85 confidence or queues for review
- Quote Builder produces correct Gmail-markdown table; creating a quote writes to `price_history`
- Analytics endpoints respond with coherent statistics; search returns combined results ordered by relevance/recency
- Frontend performs CRUD, import, quoting, analytics, search, and review actions without errors

## 13) Appendix

- Recommended versions: Node 18 LTS, React 18, Vite 4/5
- Default ports: API 3001, Frontend 5173
- Optional: add JWT auth, persist Gmail tokens securely, structured logging, and OpenAPI documentation
