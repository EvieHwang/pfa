# Task Breakdown: PFA Core Application

**Plan**: [plan.md](./plan.md)
**Created**: January 24, 2026
**Status**: Not Started

## Task Summary

| Phase | Tasks | Completed |
|-------|-------|-----------|
| Phase 1: Infrastructure & Auth | 12 | 0 |
| Phase 2: CSV Upload & Transactions | 11 | 0 |
| Phase 3: Categorization | 10 | 0 |
| Phase 4: Dashboard & Visualization | 9 | 0 |
| Phase 5: Budgets & Polish | 9 | 0 |
| **Total** | **51** | **0** |

---

## Phase 1: Infrastructure & Authentication

### T-1.1: Update SAM Template for Data Storage

- **Description**: Add S3 data bucket for SQLite storage with versioning enabled. Update Lambda permissions to read/write data bucket.
- **Dependencies**: None
- **Files**:
  - Modify: `template.yaml`
- **Acceptance**: `sam validate` passes, data bucket defined with versioning, Lambda has s3:GetObject/PutObject on data bucket
- **Status**: [ ] Not Started

### T-1.2: Create Backend Directory Structure

- **Description**: Create the backend folder structure with __init__.py files and requirements.txt
- **Dependencies**: None
- **Files**:
  - Create: `backend/src/__init__.py`
  - Create: `backend/src/routes/__init__.py`
  - Create: `backend/requirements.txt` (PyJWT, bcrypt)
  - Create: `backend/tests/__init__.py`
- **Acceptance**: Directory structure matches plan, requirements.txt includes PyJWT and bcrypt
- **Status**: [ ] Not Started

### T-1.3: Implement Database Module

- **Description**: Create database.py with S3 download/upload functions and SQLite connection management. Include schema initialization.
- **Dependencies**: T-1.1, T-1.2
- **Files**:
  - Create: `backend/src/database.py`
- **Acceptance**: Can download/upload SQLite from S3, get_connection() returns working SQLite connection, init_schema() creates all tables
- **Status**: [ ] Not Started

### T-1.4: Create Schema Initialization Script

- **Description**: SQL script to create all tables, views, and seed data (accounts, categories, initial rules)
- **Dependencies**: T-1.3
- **Files**:
  - Create: `backend/src/schema.sql`
- **Acceptance**: Script creates all tables from data-model.md, inserts seed categories and rules
- **Status**: [ ] Not Started

### T-1.5: Implement Data Models

- **Description**: Create Python dataclasses for all entities (Account, Category, Transaction, etc.)
- **Dependencies**: T-1.2
- **Files**:
  - Create: `backend/src/models.py`
- **Acceptance**: All entities from data-model.md represented as dataclasses with from_row() methods
- **Status**: [ ] Not Started

### T-1.6: Implement Auth Module

- **Description**: Create auth.py with password validation (bcrypt), JWT generation, and token verification
- **Dependencies**: T-1.2
- **Files**:
  - Create: `backend/src/auth.py`
- **Acceptance**: validate_password() checks against hash, create_token() returns valid JWT, verify_token() validates JWT
- **Status**: [ ] Not Started

### T-1.7: Create Lambda Handler with Routing

- **Description**: Main handler.py that routes requests to appropriate handlers, includes auth middleware
- **Dependencies**: T-1.3, T-1.6
- **Files**:
  - Modify: `backend/src/handler.py`
- **Acceptance**: Lambda entry point works, routes to correct handlers, auth middleware rejects invalid tokens
- **Status**: [ ] Not Started

### T-1.8: Implement Auth Routes

- **Description**: POST /api/auth/login and GET /api/auth/verify endpoints
- **Dependencies**: T-1.6, T-1.7
- **Files**:
  - Create: `backend/src/routes/auth_routes.py`
- **Acceptance**: Login returns JWT on correct password, 401 on wrong password, verify returns token status
- **Status**: [ ] Not Started

### T-1.9: Create Frontend Directory Structure

- **Description**: Set up frontend folder with index.html skeleton, CSS, and JS structure
- **Dependencies**: None
- **Files**:
  - Create: `frontend/index.html`
  - Create: `frontend/css/styles.css`
  - Create: `frontend/js/app.js`
  - Create: `frontend/js/api.js`
  - Create: `frontend/js/auth.js`
- **Acceptance**: index.html loads, includes Chart.js and Tabulator from CDN, basic layout visible
- **Status**: [ ] Not Started

### T-1.10: Implement Login Modal UI

- **Description**: Login modal with password field, submit button, error display, token storage
- **Dependencies**: T-1.9
- **Files**:
  - Modify: `frontend/js/auth.js`
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Modal appears on page load without token, password submits to API, token stored in localStorage on success
- **Status**: [ ] Not Started

### T-1.11: Create Secrets Manager Secret

- **Description**: Create pfa/prod secret with PASSWORD_HASH and JWT_SECRET values
- **Dependencies**: None
- **Files**: None (AWS Console/CLI)
- **Acceptance**: Secret exists in us-east-1, contains valid bcrypt hash and random JWT secret
- **Status**: [ ] Not Started

### T-1.12: Deploy and Test Phase 1

- **Description**: Deploy stack, upload initial database, sync frontend, test auth flow
- **Dependencies**: T-1.1 through T-1.11
- **Files**: None
- **Acceptance**: Can access pfa.evehwang.com, login modal works, correct password grants access, wrong password shows error
- **Status**: [ ] Not Started

---

## Phase 2: CSV Upload & Transaction Storage

### T-2.1: Implement CSV Parser - Format Detection

- **Description**: Create csv_parser.py that auto-detects Format A (Credit Card) vs Format B (Checking/Savings) from headers
- **Dependencies**: Phase 1 complete
- **Files**:
  - Create: `backend/src/csv_parser.py`
- **Acceptance**: detect_format() correctly identifies both formats from header row
- **Status**: [ ] Not Started

### T-2.2: Implement CSV Parser - Credit Card Format

- **Description**: Parse Format A (Credit Card): Posted Date, Reference Number, Payee, Address, Amount
- **Dependencies**: T-2.1
- **Files**:
  - Modify: `backend/src/csv_parser.py`
- **Acceptance**: Parses all fields correctly, handles quoted fields with commas, converts dates to YYYY-MM-DD
- **Status**: [ ] Not Started

### T-2.3: Implement CSV Parser - Checking/Savings Format

- **Description**: Parse Format B: Skip header section, parse Date, Description, Amount, Running Bal.
- **Dependencies**: T-2.1
- **Files**:
  - Modify: `backend/src/csv_parser.py`
- **Acceptance**: Skips summary rows, parses transaction rows, handles comma-formatted amounts
- **Status**: [ ] Not Started

### T-2.4: Implement Duplicate Detection

- **Description**: Generate deterministic hash for each transaction: Credit Card uses Date+RefNum, Checking uses Date+Amount+Description[0:50]
- **Dependencies**: T-2.2, T-2.3
- **Files**:
  - Modify: `backend/src/csv_parser.py`
- **Acceptance**: Same transaction produces same hash, different transactions produce different hashes
- **Status**: [ ] Not Started

### T-2.5: Create CSV Parser Tests

- **Description**: Unit tests with sample CSV fixtures for both formats
- **Dependencies**: T-2.1 through T-2.4
- **Files**:
  - Create: `backend/tests/test_csv_parser.py`
  - Create: `backend/tests/fixtures/credit_card.csv`
  - Create: `backend/tests/fixtures/checking.csv`
- **Acceptance**: Tests pass, cover format detection, parsing, duplicate detection, edge cases
- **Status**: [ ] Not Started

### T-2.6: Implement Transaction Storage

- **Description**: Functions to insert transactions, check for duplicates by hash
- **Dependencies**: T-1.3, T-1.5, T-2.4
- **Files**:
  - Create: `backend/src/routes/transaction_routes.py`
- **Acceptance**: insert_transaction() adds to DB, get_by_hash() finds existing, bulk insert handles duplicates
- **Status**: [ ] Not Started

### T-2.7: Implement Upload Endpoint

- **Description**: POST /api/transactions/upload - handle multipart form, parse CSV, store transactions
- **Dependencies**: T-2.1 through T-2.6
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
  - Modify: `backend/src/handler.py`
- **Acceptance**: Accepts file upload, returns {new_count, duplicate_count, review_count}
- **Status**: [ ] Not Started

### T-2.8: Implement Transaction List Endpoint

- **Description**: GET /api/transactions with pagination, date range filter, account filter
- **Dependencies**: T-2.6
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
- **Acceptance**: Returns paginated results, filters work correctly, includes joined category names
- **Status**: [ ] Not Started

### T-2.9: Build Upload Modal UI

- **Description**: Modal with file picker, account dropdown, upload button, result display
- **Dependencies**: T-1.9
- **Files**:
  - Create: `frontend/js/upload.js`
  - Modify: `frontend/css/styles.css`
  - Modify: `frontend/index.html`
- **Acceptance**: File can be selected, account chosen, upload triggered, results displayed
- **Status**: [ ] Not Started

### T-2.10: Build Transaction Table View

- **Description**: Tabulator table showing transactions with date, account, category, description, amount columns
- **Dependencies**: T-2.8, T-1.9
- **Files**:
  - Create: `frontend/js/transactions.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Table renders transactions, sortable columns, pagination works
- **Status**: [ ] Not Started

### T-2.11: Deploy and Test Phase 2

- **Description**: Deploy, upload real Bank of America CSVs, verify data displays correctly
- **Dependencies**: T-2.1 through T-2.10
- **Files**: None
- **Acceptance**: Both CSV formats upload successfully, duplicates detected, transactions visible in table
- **Status**: [ ] Not Started

---

## Phase 3: Categorization System

### T-3.1: Implement Category CRUD Endpoints

- **Description**: GET /api/categories (list), POST (create), PATCH/{id} (update), DELETE/{id}
- **Dependencies**: Phase 2 complete
- **Files**:
  - Create: `backend/src/routes/category_routes.py`
  - Modify: `backend/src/handler.py`
- **Acceptance**: All CRUD operations work, delete fails if category has transactions
- **Status**: [ ] Not Started

### T-3.2: Implement Rule CRUD Endpoints

- **Description**: GET /api/rules (list), POST (create), PATCH/{id} (update), DELETE/{id}
- **Dependencies**: T-3.1
- **Files**:
  - Create: `backend/src/routes/rule_routes.py`
  - Modify: `backend/src/handler.py`
- **Acceptance**: All CRUD operations work, rules ordered by priority in list
- **Status**: [ ] Not Started

### T-3.3: Implement Auto-Categorization Engine

- **Description**: Create categorization.py that applies rules to transactions in priority order
- **Dependencies**: T-3.2
- **Files**:
  - Create: `backend/src/categorization.py`
- **Acceptance**: categorize_transaction() returns category_id based on rules, lower priority wins, account_filter respected
- **Status**: [ ] Not Started

### T-3.4: Create Categorization Tests

- **Description**: Unit tests for categorization logic with various rule scenarios
- **Dependencies**: T-3.3
- **Files**:
  - Create: `backend/tests/test_categorization.py`
- **Acceptance**: Tests cover priority ordering, pattern matching, account filtering, no-match case
- **Status**: [ ] Not Started

### T-3.5: Integrate Auto-Categorization into Upload

- **Description**: Apply categorization to new transactions during upload, set needs_review based on result
- **Dependencies**: T-3.3, T-2.7
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
- **Acceptance**: New uploads get auto-categorized, needs_review=false if categorized, true if not
- **Status**: [ ] Not Started

### T-3.6: Implement Transaction Update Endpoint

- **Description**: PATCH /api/transactions/{id} to update category_id and needs_review
- **Dependencies**: T-2.6
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
- **Acceptance**: Can update category, needs_review flag cleared when category assigned
- **Status**: [ ] Not Started

### T-3.7: Implement Review Queue Endpoint

- **Description**: GET /api/transactions/review and POST /api/transactions/review/batch
- **Dependencies**: T-3.6
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
- **Acceptance**: Review endpoint returns uncategorized transactions, batch update works
- **Status**: [ ] Not Started

### T-3.8: Build Transaction Edit Modal

- **Description**: Modal with category dropdown, save button, option to create rule
- **Dependencies**: T-3.6, T-3.2
- **Files**:
  - Modify: `frontend/js/transactions.js`
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Click transaction opens modal, can change category, rule creation option works
- **Status**: [ ] Not Started

### T-3.9: Build Review Queue UI

- **Description**: Review modal with list of uncategorized transactions, batch category assignment
- **Dependencies**: T-3.7
- **Files**:
  - Create: `frontend/js/review.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Review queue accessible from dashboard, can categorize multiple at once
- **Status**: [ ] Not Started

### T-3.10: Build Rules Management UI

- **Description**: Settings panel to list, add, edit, delete categorization rules
- **Dependencies**: T-3.2
- **Files**:
  - Create: `frontend/js/rules.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Rules visible in list, can add new rule, edit priority/pattern, delete rule
- **Status**: [ ] Not Started

---

## Phase 4: Dashboard & Visualization

### T-4.1: Implement Dashboard Data Endpoint

- **Description**: GET /api/dashboard returns aggregated summary, spending by category, monthly trend
- **Dependencies**: Phase 3 complete
- **Files**:
  - Create: `backend/src/routes/dashboard_routes.py`
  - Modify: `backend/src/handler.py`
- **Acceptance**: Returns complete dashboard payload, respects date/account filters
- **Status**: [ ] Not Started

### T-4.2: Implement Accounts Endpoint

- **Description**: GET /api/accounts for account filter dropdown
- **Dependencies**: T-1.3
- **Files**:
  - Modify: `backend/src/routes/dashboard_routes.py`
- **Acceptance**: Returns list of all accounts
- **Status**: [ ] Not Started

### T-4.3: Build Dashboard Layout

- **Description**: HTML/CSS for dashboard with card grid, chart areas, recent transactions section
- **Dependencies**: T-1.9
- **Files**:
  - Create: `frontend/js/dashboard.js`
  - Modify: `frontend/index.html`
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Layout matches wireframe in requirements, responsive grid
- **Status**: [ ] Not Started

### T-4.4: Build Summary Cards

- **Description**: Four cards: Net Worth, Monthly Spending, Top Category, Pending Review
- **Dependencies**: T-4.1, T-4.3
- **Files**:
  - Modify: `frontend/js/dashboard.js`
- **Acceptance**: All four cards display correct values, change indicators shown
- **Status**: [ ] Not Started

### T-4.5: Implement Spending by Category Chart

- **Description**: Pie/donut chart showing category breakdown using Chart.js
- **Dependencies**: T-4.1, T-4.3
- **Files**:
  - Modify: `frontend/js/dashboard.js`
- **Acceptance**: Chart renders with category colors, tooltips show amounts
- **Status**: [ ] Not Started

### T-4.6: Implement Monthly Trend Chart

- **Description**: Line chart showing Income vs Expenses over past 12 months
- **Dependencies**: T-4.1, T-4.3
- **Files**:
  - Modify: `frontend/js/dashboard.js`
- **Acceptance**: Two lines (income green, expenses red), X-axis shows months
- **Status**: [ ] Not Started

### T-4.7: Add Date Range Filter

- **Description**: Dropdown for This Month, Last Month, Last 3 Months, YTD, Custom
- **Dependencies**: T-4.1
- **Files**:
  - Modify: `frontend/js/dashboard.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Filter changes refresh all dashboard data
- **Status**: [ ] Not Started

### T-4.8: Add Account Filter

- **Description**: Dropdown to filter by All, Checking, Savings, Credit Card
- **Dependencies**: T-4.2
- **Files**:
  - Modify: `frontend/js/dashboard.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Filter changes refresh all dashboard data
- **Status**: [ ] Not Started

### T-4.9: Deploy and Test Phase 4

- **Description**: Deploy, verify dashboard with real data across different date ranges
- **Dependencies**: T-4.1 through T-4.8
- **Files**: None
- **Acceptance**: Dashboard displays accurate data, charts render correctly, filters work
- **Status**: [ ] Not Started

---

## Phase 5: Budgets & Polish

### T-5.1: Implement Budget CRUD Endpoints

- **Description**: GET /api/budgets and POST (upsert) /api/budgets, DELETE /api/budgets/{id}
- **Dependencies**: Phase 4 complete
- **Files**:
  - Create: `backend/src/routes/budget_routes.py`
  - Modify: `backend/src/handler.py`
- **Acceptance**: Can create/update budget per category/month, list includes actual spent
- **Status**: [ ] Not Started

### T-5.2: Build Budget Management UI

- **Description**: Settings panel to view/edit budgets per category, shows current month by default
- **Dependencies**: T-5.1
- **Files**:
  - Create: `frontend/js/budgets.js`
  - Modify: `frontend/index.html`
- **Acceptance**: Can set budget amounts, progress bars show utilization
- **Status**: [ ] Not Started

### T-5.3: Build Budget vs Actual View

- **Description**: Dashboard section or modal showing budget comparison with visual indicators
- **Dependencies**: T-5.1, T-5.2
- **Files**:
  - Modify: `frontend/js/budgets.js`
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Over-budget categories highlighted in red, progress bars accurate
- **Status**: [ ] Not Started

### T-5.4: Implement CSV Export

- **Description**: GET /api/export returns CSV of filtered transactions
- **Dependencies**: T-2.8
- **Files**:
  - Modify: `backend/src/routes/transaction_routes.py`
- **Acceptance**: Downloads valid CSV with same filters as transaction view
- **Status**: [ ] Not Started

### T-5.5: Add Transaction Search

- **Description**: Search box in transaction view that filters by description
- **Dependencies**: T-2.10
- **Files**:
  - Modify: `frontend/js/transactions.js`
- **Acceptance**: Typing in search filters table in real-time or on submit
- **Status**: [ ] Not Started

### T-5.6: Mobile Responsive Refinements

- **Description**: Ensure all views work on tablet and mobile screen sizes
- **Dependencies**: T-4.3, T-5.2
- **Files**:
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Dashboard readable on mobile, modals scroll properly, table has horizontal scroll
- **Status**: [ ] Not Started

### T-5.7: Error Handling Improvements

- **Description**: Add user-friendly error messages, loading states, graceful degradation
- **Dependencies**: All frontend tasks
- **Files**:
  - Modify: All frontend JS files
  - Modify: `frontend/css/styles.css`
- **Acceptance**: Network errors show toast/message, loading spinners present, no silent failures
- **Status**: [ ] Not Started

### T-5.8: Update README

- **Description**: Update README with project overview, features, setup instructions, usage guide
- **Dependencies**: All prior tasks
- **Files**:
  - Modify: `README.md`
- **Acceptance**: README accurately describes app, includes deployment steps
- **Status**: [ ] Not Started

### T-5.9: Final Deployment and Verification

- **Description**: Full deployment, end-to-end testing of all features
- **Dependencies**: T-5.1 through T-5.8
- **Files**: None
- **Acceptance**: All features work in production, mobile responsive, performance acceptable
- **Status**: [ ] Not Started

---

## Critical Path

Tasks that block other work and should be prioritized:

1. **T-1.1 → T-1.3 → T-1.4** (Database foundation)
2. **T-1.6 → T-1.7 → T-1.8** (Auth chain)
3. **T-2.1 → T-2.2/T-2.3 → T-2.4 → T-2.7** (CSV parsing to upload)
4. **T-3.2 → T-3.3 → T-3.5** (Categorization engine to upload integration)
5. **T-4.1 → T-4.4/T-4.5/T-4.6** (Dashboard data to visualizations)

## Parallelization Opportunities

Tasks that can be worked on simultaneously:

- **Phase 1**: T-1.1, T-1.2, T-1.9, T-1.11 (infrastructure, structure, frontend, secrets - all independent)
- **Phase 1**: T-1.5, T-1.6 after T-1.2 (models and auth can be parallel)
- **Phase 2**: T-2.2, T-2.3 after T-2.1 (both CSV formats can be parsed in parallel)
- **Phase 2**: T-2.9, T-2.10 (frontend work parallel to backend)
- **Phase 3**: T-3.8, T-3.9, T-3.10 (all frontend work can be parallel)
- **Phase 4**: T-4.4, T-4.5, T-4.6 after T-4.1 (all dashboard components parallel)
- **Phase 5**: T-5.2, T-5.4, T-5.5 (independent features)

---

## File Checklist

All files that will be created or modified:

**New Files**:
- [ ] `backend/src/__init__.py`
- [ ] `backend/src/handler.py` (may modify existing)
- [ ] `backend/src/auth.py`
- [ ] `backend/src/database.py`
- [ ] `backend/src/models.py`
- [ ] `backend/src/schema.sql`
- [ ] `backend/src/csv_parser.py`
- [ ] `backend/src/categorization.py`
- [ ] `backend/src/routes/__init__.py`
- [ ] `backend/src/routes/auth_routes.py`
- [ ] `backend/src/routes/transaction_routes.py`
- [ ] `backend/src/routes/category_routes.py`
- [ ] `backend/src/routes/rule_routes.py`
- [ ] `backend/src/routes/budget_routes.py`
- [ ] `backend/src/routes/dashboard_routes.py`
- [ ] `backend/tests/__init__.py`
- [ ] `backend/tests/test_auth.py`
- [ ] `backend/tests/test_csv_parser.py`
- [ ] `backend/tests/test_categorization.py`
- [ ] `backend/tests/fixtures/credit_card.csv`
- [ ] `backend/tests/fixtures/checking.csv`
- [ ] `backend/requirements.txt`
- [ ] `frontend/index.html`
- [ ] `frontend/css/styles.css`
- [ ] `frontend/js/app.js`
- [ ] `frontend/js/api.js`
- [ ] `frontend/js/auth.js`
- [ ] `frontend/js/dashboard.js`
- [ ] `frontend/js/transactions.js`
- [ ] `frontend/js/upload.js`
- [ ] `frontend/js/review.js`
- [ ] `frontend/js/categories.js`
- [ ] `frontend/js/rules.js`
- [ ] `frontend/js/budgets.js`

**Modified Files**:
- [ ] `template.yaml`
- [ ] `README.md`

---

## Progress Log

| Date | Tasks Completed | Notes |
|------|-----------------|-------|
| | | |
