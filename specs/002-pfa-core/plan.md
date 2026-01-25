# Technical Plan: PFA Core Application

**Spec**: [spec.md](./spec.md)
**Created**: January 24, 2026
**Status**: Ready for Implementation

## Architecture Overview

PFA is a serverless single-page application with a Python backend on AWS Lambda and a vanilla JavaScript frontend served from S3/CloudFront. The database is SQLite stored in S3, downloaded to Lambda on cold starts.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CloudFront                                 │
│                    (HTTPS, caching, routing)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌───────────────────┐              ┌───────────────────────┐     │
│   │   S3: Frontend    │              │   API Gateway         │     │
│   │   (Static SPA)    │              │   /api/* → Lambda     │     │
│   │   index.html      │              │                       │     │
│   │   app.js          │              └───────────┬───────────┘     │
│   │   styles.css      │                          │                  │
│   │   chart.js        │                          ▼                  │
│   │   tabulator.js    │              ┌───────────────────────┐     │
│   └───────────────────┘              │   Lambda Function     │     │
│                                      │   (Python 3.12)       │     │
│                                      │                       │     │
│                                      │   ┌───────────────┐   │     │
│                                      │   │ /tmp/pfa.db   │   │     │
│                                      │   │ (SQLite)      │   │     │
│                                      │   └───────────────┘   │     │
│                                      └───────────┬───────────┘     │
│                                                  │                  │
│                                                  ▼                  │
│                                      ┌───────────────────────┐     │
│                                      │   S3: Data Bucket     │     │
│                                      │   pfa.db (SQLite)     │     │
│                                      │   (versioning on)     │     │
│                                      └───────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
pfa/
├── backend/
│   ├── src/
│   │   ├── __init__.py
│   │   ├── handler.py           # Lambda entry point, routing
│   │   ├── auth.py              # JWT and password handling
│   │   ├── database.py          # SQLite connection, S3 sync
│   │   ├── models.py            # Dataclasses for entities
│   │   ├── csv_parser.py        # CSV format detection & parsing
│   │   ├── categorization.py    # Auto-categorization engine
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth_routes.py
│   │       ├── transaction_routes.py
│   │       ├── category_routes.py
│   │       ├── rule_routes.py
│   │       ├── budget_routes.py
│   │       └── dashboard_routes.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_auth.py
│   │   ├── test_csv_parser.py
│   │   ├── test_categorization.py
│   │   ├── test_routes.py
│   │   └── fixtures/
│   │       ├── credit_card.csv
│   │       └── checking.csv
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js               # Main SPA controller
│   │   ├── api.js               # API client wrapper
│   │   ├── auth.js              # Token management
│   │   ├── dashboard.js         # Dashboard rendering
│   │   ├── transactions.js      # Transaction table
│   │   ├── upload.js            # CSV upload handling
│   │   ├── categories.js        # Category management
│   │   ├── rules.js             # Rules management
│   │   └── budgets.js           # Budget management
│   └── lib/
│       ├── chart.min.js         # Chart.js v4
│       └── tabulator.min.js     # Tabulator.js v5
├── specs/
│   └── 002-pfa-core/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       ├── data-model.md
│       └── contracts/
│           └── api.yaml
├── template.yaml                 # SAM template (update existing)
├── samconfig.toml
└── README.md
```

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend Runtime | Python 3.12 | Required per project constitution |
| Database | SQLite | Simple, file-based, full SQL support, no managed DB cost |
| Database Storage | S3 | Persistent storage, versioning for backups |
| API Framework | Manual routing | Minimal deps, full control, Lambda-optimized |
| Authentication | PyJWT + bcrypt | Industry standard, simple implementation |
| Frontend Framework | Vanilla JS | No build step, fast iteration, explicit control |
| Data Grid | Tabulator.js v5 | Feature-rich, no build step, excellent docs |
| Charts | Chart.js v4 | Widely used, good docs, responsive |
| CSS | Plain CSS | No preprocessor needed for scope |

## Implementation Phases

### Phase 1: Infrastructure & Authentication

**Goal**: Deployable skeleton with working auth and database

- [ ] Update SAM template with data bucket and Lambda permissions
- [ ] Create database module (S3 sync, connection management)
- [ ] Create schema initialization script with seed data
- [ ] Implement auth module (login endpoint, JWT generation/validation)
- [ ] Create basic Lambda handler with routing structure
- [ ] Create frontend skeleton (index.html, login modal, basic styles)
- [ ] Deploy and verify auth flow end-to-end

**Verification**: Can login at pfa.evehwang.com, token persists, protected endpoints reject without token

### Phase 2: CSV Upload & Transaction Storage

**Goal**: Upload CSVs and store transactions with duplicate detection

- [ ] Implement CSV parser with format auto-detection
- [ ] Implement duplicate detection (hash generation)
- [ ] Create transaction storage logic
- [ ] Create upload endpoint (multipart form handling)
- [ ] Create basic transaction list endpoint
- [ ] Build upload modal UI
- [ ] Build basic transaction table view
- [ ] Deploy and test with real Bank of America CSVs

**Verification**: Can upload both CSV formats, duplicates detected, transactions display in table

### Phase 3: Categorization System

**Goal**: Manual and automatic transaction categorization

- [ ] Create category CRUD endpoints
- [ ] Create rule CRUD endpoints
- [ ] Implement auto-categorization engine (priority-ordered matching)
- [ ] Integrate auto-categorization into upload flow
- [ ] Create transaction edit modal
- [ ] Create review queue view
- [ ] Build rules management UI
- [ ] Deploy and verify rule matching works

**Verification**: New transactions auto-categorize based on rules, review queue shows uncategorized, rules can be created/edited

### Phase 4: Dashboard & Visualization

**Goal**: Dashboard with summary cards and charts

- [ ] Implement dashboard data aggregation endpoint
- [ ] Build summary cards (Net Worth, Monthly Spending, Top Category, Review Count)
- [ ] Implement Spending by Category pie chart
- [ ] Implement Monthly Trend line chart
- [ ] Add date range and account filters
- [ ] Style dashboard layout
- [ ] Deploy and verify visualizations with real data

**Verification**: Dashboard displays accurate summaries and charts, filters work correctly

### Phase 5: Budget Management & Polish

**Goal**: Budget tracking and final refinements

- [ ] Implement budget CRUD endpoints
- [ ] Build Budget vs Actual comparison view
- [ ] Implement CSV export
- [ ] Add search functionality to transaction viewer
- [ ] Mobile responsive refinements
- [ ] Error handling improvements
- [ ] Performance optimization (if needed)
- [ ] Final deployment and README update

**Verification**: Budgets can be set and compared to actual spending, app works on mobile, export produces valid CSV

## API Design

See [contracts/api.yaml](./contracts/api.yaml) for full OpenAPI specification.

### Key Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Authenticate, return JWT |
| GET | /api/auth/verify | Validate token |
| GET | /api/dashboard | Dashboard summary data |
| GET | /api/transactions | List with filters |
| POST | /api/transactions/upload | CSV upload |
| PATCH | /api/transactions/{id} | Update category |
| GET | /api/transactions/review | Review queue |
| POST | /api/transactions/review/batch | Batch categorize |
| GET/POST | /api/categories | Category CRUD |
| GET/POST | /api/rules | Rule CRUD |
| GET/POST | /api/budgets | Budget CRUD |
| GET | /api/export | CSV export |

## Data Flow

### CSV Upload Flow

1. User selects CSV file and account type
2. Frontend sends multipart POST to /api/transactions/upload
3. Lambda receives file, detects format from headers
4. Parser extracts transactions, generates hashes
5. For each transaction:
   - Check hash against existing (skip duplicates)
   - Apply categorization rules in priority order
   - Insert with category_id and needs_review flag
6. Return summary: {new_count, duplicate_count, review_count}
7. Frontend displays result and refreshes transaction view

### Authentication Flow

1. User enters password in login modal
2. Frontend POSTs to /api/auth/login
3. Lambda validates against bcrypt hash in Secrets Manager
4. On success: generate JWT (24h expiry), return token
5. Frontend stores token in localStorage
6. All subsequent API calls include Authorization: Bearer {token}
7. Lambda validates token on each request (middleware pattern)

## Deployment Strategy

1. **Build**: `sam build` (packages Python deps)
2. **Deploy**: `sam deploy` (creates/updates CloudFormation stack)
3. **Frontend**: `aws s3 sync frontend/ s3://pfa-frontend-prod`
4. **Verify**: Hit /health endpoint, login, upload test CSV

### Environment Variables (Secrets Manager)

```json
{
  "PASSWORD_HASH": "$2b$12$...",  // bcrypt hash of login password
  "JWT_SECRET": "random-secret-key"
}
```

### First-Time Setup

1. Create Secrets Manager secret `pfa/prod` with PASSWORD_HASH and JWT_SECRET
2. Run `sam deploy --guided` to configure parameters
3. Upload initial database with schema to data bucket
4. Sync frontend to frontend bucket
5. Test end-to-end

## Rollback Points

Safe stopping points where the system remains functional:

1. **After Phase 1**: Auth works, empty dashboard displays, no transactions yet
2. **After Phase 2**: Can upload and view transactions, no categorization
3. **After Phase 3**: Full transaction workflow including categorization
4. **After Phase 4**: Complete MVP, just missing budgets
5. **After Phase 5**: Full feature set

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQLite concurrent write issues | Low | Med | Single-user system, Lambda serialization handles most cases |
| S3 database sync latency | Low | Low | Accept 100-200ms overhead on cold starts |
| CSV parsing edge cases | Med | Med | Comprehensive test fixtures, error handling |
| Large file uploads | Low | Med | Set 5MB limit, chunked processing if needed |
| Token expiry UX | Med | Low | Auto-refresh or clear redirect to login |
| Chart.js/Tabulator version conflicts | Low | Low | Pin specific versions, serve from local lib/ |

## Open Questions

- [x] ~~Which specific Chart.js chart types for each visualization?~~ Resolved: Pie/donut for categories, Line for trend
- [x] ~~Should uncategorized transactions be excluded from charts?~~ Yes, only categorized in visualizations
- [ ] Handle timezone in date displays? (Likely: treat all as local, no conversion)
- [ ] Cache dashboard aggregations? (Likely: not needed for single user volume)
