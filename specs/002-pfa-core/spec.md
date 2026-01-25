# Feature Specification: PFA Core Application

**Feature Branch**: `002-pfa-core`
**Created**: January 24, 2026
**Status**: Ready for Implementation
**Input**: /docs/pfa-requirements.md

## Overview

PFA (Personal Finance Awareness) is a single-user personal finance tracking application that provides awareness and visualization of personal spending patterns. Users manually upload CSV transaction exports from their bank accounts. The system processes these files, categorizes transactions, and presents financial data through an interactive web dashboard.

Key insight: The goal is financial visibility and awareness, not optimization recommendations or automation. Simplicity over features.

---

## User Scenarios & Testing

### User Story 1 - Authentication (Priority: P1)

As the app owner, I want to protect my financial data with a password so that only I can access my spending information.

**Why this priority**: Security is foundational - no other features matter if data isn't protected.

**Independent Test**: Navigate to app URL, verify login modal appears, enter wrong password (rejected), enter correct password (access granted).

**Acceptance Scenarios**:

1. **Given** no valid token exists, **When** I navigate to the app URL, **Then** a login modal appears requiring password entry.
2. **Given** I am on the login modal, **When** I enter the correct password and submit, **Then** I receive a JWT token and the dashboard loads.
3. **Given** I am on the login modal, **When** I enter an incorrect password, **Then** I see an error message and remain on the login screen.
4. **Given** I have a valid token stored, **When** I navigate to the app URL, **Then** the dashboard loads without requiring login.
5. **Given** my token has expired (>24 hours), **When** I make any API request, **Then** I am redirected to the login modal.

---

### User Story 2 - CSV Upload (Priority: P1)

As the app owner, I want to upload CSV exports from my bank so that my transactions are stored in the system.

**Why this priority**: Without transaction data, the app has no purpose.

**Independent Test**: Upload a sample Credit Card CSV, verify transactions appear in viewer.

**Acceptance Scenarios**:

1. **Given** I am authenticated, **When** I click the Upload button, **Then** a modal appears with file picker and account selector (Checking, Savings, Credit Card).
2. **Given** I select a Credit Card CSV (Format A), **When** I upload, **Then** the system auto-detects the format and parses all transactions correctly.
3. **Given** I select a Checking/Savings CSV (Format B), **When** I upload, **Then** the system skips header rows and parses transaction rows correctly.
4. **Given** I upload a file with 100 transactions, **When** processing completes, **Then** I see a summary showing "X new, Y duplicates, Z need review".
5. **Given** I upload the same file twice, **When** processing the second upload, **Then** all transactions are detected as duplicates and not re-inserted.
6. **Given** a CSV has amounts with comma separators like "1,704.53", **When** uploaded, **Then** the amount is correctly parsed as 1704.53.

---

### User Story 3 - Transaction Viewing (Priority: P1)

As the app owner, I want to view my transactions in a sortable, filterable table so that I can explore my spending history.

**Why this priority**: Core functionality for financial awareness.

**Independent Test**: Load transaction viewer, apply date filter, verify results update.

**Acceptance Scenarios**:

1. **Given** I have transactions loaded, **When** I view the transaction list, **Then** I see columns for Date, Account, Category, Description, and Amount.
2. **Given** I am viewing transactions, **When** I click a column header, **Then** the table sorts by that column.
3. **Given** I select "This Month" from the date filter, **When** the filter applies, **Then** only transactions from the current month appear.
4. **Given** I type "WHOLE FOODS" in the search box, **When** the search executes, **Then** only transactions with "WHOLE FOODS" in the description appear.
5. **Given** I have filtered transactions, **When** I click Export, **Then** a CSV file downloads containing only the filtered results.

---

### User Story 4 - Manual Categorization (Priority: P2)

As the app owner, I want to categorize transactions so that I can understand my spending by category.

**Why this priority**: Categorization enables meaningful analysis but depends on having transactions first.

**Independent Test**: Click an uncategorized transaction, assign category, verify it updates.

**Acceptance Scenarios**:

1. **Given** I click on a transaction row, **When** the edit modal opens, **Then** I see a dropdown with all available categories.
2. **Given** I select a category and save, **When** I return to the transaction list, **Then** the transaction shows the new category.
3. **Given** I categorize a transaction, **When** I am prompted "Create rule for similar transactions?", **Then** I can choose Yes to create an auto-categorization rule.
4. **Given** I am editing a transaction, **When** I click "Skip" or close without saving, **Then** the transaction remains unchanged.

---

### User Story 5 - Auto-Categorization Rules (Priority: P2)

As the app owner, I want the system to automatically categorize transactions based on patterns so that I spend less time on manual categorization.

**Why this priority**: Reduces tedious work after initial setup.

**Independent Test**: Create rule for "SAFEWAY" -> "Groceries", upload new CSV with SAFEWAY transaction, verify it's auto-categorized.

**Acceptance Scenarios**:

1. **Given** I navigate to Rules in Settings, **When** I click Add Rule, **Then** I can enter a pattern, select a category, and set priority.
2. **Given** a rule exists for pattern "WHOLE FOODS" -> "Groceries", **When** I upload a CSV with "WHOLE FOODS MARKET #123", **Then** that transaction is automatically categorized as Groceries.
3. **Given** two rules match a transaction (e.g., "AMAZON" and "AMAZON MKTPL"), **When** applied, **Then** the rule with lower priority number wins.
4. **Given** I delete a rule, **When** I upload new transactions, **Then** the deleted rule no longer applies.

---

### User Story 6 - Review Queue (Priority: P2)

As the app owner, I want to see transactions that need categorization so that I can efficiently process new uploads.

**Why this priority**: Streamlines the categorization workflow.

**Independent Test**: Upload CSV with new vendor, verify transaction appears in review queue.

**Acceptance Scenarios**:

1. **Given** there are 12 uncategorized transactions, **When** I view the dashboard, **Then** the Review Queue card shows "(12)".
2. **Given** I click on the Review Queue card, **When** the modal opens, **Then** I see all uncategorized transactions with category dropdowns.
3. **Given** I select categories for 5 transactions, **When** I click "Save All", **Then** all 5 are updated and removed from the queue.
4. **Given** I categorize a transaction and check "Create rule", **When** I save, **Then** a rule is created for that vendor pattern.

---

### User Story 7 - Dashboard Summary Cards (Priority: P2)

As the app owner, I want to see summary statistics on my dashboard so that I have instant awareness of my financial status.

**Why this priority**: Provides at-a-glance insights without drilling into details.

**Independent Test**: Load dashboard, verify all four summary cards display correct values.

**Acceptance Scenarios**:

1. **Given** I have transaction data, **When** I load the dashboard, **Then** I see four summary cards: Net Worth Trend, Monthly Spending, Top Category, and Pending Review.
2. **Given** my checking has $10,000 and savings has $5,000, **When** I view Net Worth Trend, **Then** it shows $15,000 (or reflects all account totals).
3. **Given** I spent $2,500 this month, **When** I view Monthly Spending, **Then** it shows $2,500 with comparison to last month.
4. **Given** Food is my highest spending category, **When** I view Top Category, **Then** it shows "Food" with the amount.

---

### User Story 8 - Dashboard Charts (Priority: P3)

As the app owner, I want to see visual charts of my spending so that I can quickly understand patterns and trends.

**Why this priority**: Enhances awareness but not essential for core functionality.

**Independent Test**: Load dashboard with 3+ months of data, verify line chart shows income vs expenses trend.

**Acceptance Scenarios**:

1. **Given** I have categorized transactions, **When** I view the dashboard, **Then** I see a pie/donut chart showing spending by category.
2. **Given** I have 6+ months of data, **When** I view the Monthly Trend chart, **Then** I see a line chart with Income and Expenses over time.
3. **Given** I select "Last Month" from the time period filter, **When** charts refresh, **Then** all visualizations update to show only last month's data.
4. **Given** I hover over a chart segment, **When** the tooltip appears, **Then** it shows the category name and amount.

---

### User Story 9 - Budget Management (Priority: P3)

As the app owner, I want to set monthly budgets per category so that I can track whether I'm staying within limits.

**Why this priority**: Valuable for financial discipline but app works without it.

**Independent Test**: Set $500 budget for Food, spend $400, verify progress bar shows 80%.

**Acceptance Scenarios**:

1. **Given** I navigate to Budgets in Settings, **When** I select a category, **Then** I can enter a monthly budget amount.
2. **Given** I have a $500 Food budget and spent $400, **When** I view the Budget vs Actual display, **Then** I see a progress bar at 80%.
3. **Given** I have a $500 Food budget and spent $600, **When** I view the display, **Then** the category is highlighted as over budget (red indicator).
4. **Given** I update a budget amount, **When** I save, **Then** the Budget vs Actual display immediately reflects the new limit.

---

### Edge Cases

- **Empty CSV**: File with only headers should show "0 new transactions" message, not error.
- **Malformed CSV**: Invalid format should show clear error message identifying the problem.
- **Negative amounts in Checking CSV**: Some credits may be positive while debits negative - handle both correctly.
- **Very long descriptions**: Descriptions exceeding typical lengths should be stored fully but may truncate in UI display.
- **Special characters in payee names**: UTF-8 characters, quotes, commas within quoted fields should all parse correctly.
- **Timezone handling**: Dates should be stored as-is from CSV (local dates), not converted to UTC.
- **Concurrent uploads**: If user accidentally uploads same file in two tabs, duplicate detection should still work.

---

## Requirements

### Functional Requirements

**Authentication**

- **FR-AUTH-001**: System MUST display login modal when no valid JWT token exists in localStorage.
- **FR-AUTH-002**: System MUST validate password against bcrypt hash stored in environment.
- **FR-AUTH-003**: System MUST issue JWT token with 24-hour expiry on successful authentication.
- **FR-AUTH-004**: System MUST reject API requests with missing, invalid, or expired tokens (401 response).
- **FR-AUTH-005**: System MUST NOT store the plaintext password anywhere.

**Transaction Upload**

- **FR-UPLOAD-001**: System MUST accept CSV file uploads up to 5MB.
- **FR-UPLOAD-002**: System MUST auto-detect CSV format from header row (Format A vs Format B).
- **FR-UPLOAD-003**: System MUST parse amounts with comma thousands separators correctly.
- **FR-UPLOAD-004**: System MUST handle quoted fields containing commas.
- **FR-UPLOAD-005**: System MUST skip non-transaction rows in Format B (summary headers).
- **FR-UPLOAD-006**: System MUST generate deterministic hash for duplicate detection:
  - Credit Card: Hash(Posted Date + Reference Number)
  - Checking/Savings: Hash(Date + Amount + Description[0:50])
- **FR-UPLOAD-007**: System MUST report upload results: new count, duplicate count, needs review count.

**Categorization**

- **FR-CAT-001**: System MUST provide predefined category hierarchy (Income, Housing, Transportation, Food, Health, Shopping, Entertainment, Financial, Other).
- **FR-CAT-002**: System MUST allow manual category assignment to any transaction.
- **FR-CAT-003**: System MUST apply auto-categorization rules on upload in priority order.
- **FR-CAT-004**: System MUST support CRUD operations for categorization rules.
- **FR-CAT-005**: System MUST mark uncategorized transactions with needs_review=true.
- **FR-CAT-006**: System MUST support batch categorization of multiple transactions.

**Transaction Viewer**

- **FR-VIEW-001**: System MUST display transactions in sortable data grid.
- **FR-VIEW-002**: System MUST support filtering by date range (This Month, Last Month, YTD, Custom).
- **FR-VIEW-003**: System MUST support filtering by category and account.
- **FR-VIEW-004**: System MUST support text search across descriptions.
- **FR-VIEW-005**: System MUST support pagination (25/50/100 rows per page).
- **FR-VIEW-006**: System MUST export filtered results as CSV.

**Dashboard**

- **FR-DASH-001**: System MUST display four summary cards (Net Worth Trend, Monthly Spending, Top Category, Pending Review).
- **FR-DASH-002**: System MUST display Spending by Category pie/donut chart.
- **FR-DASH-003**: System MUST display Monthly Trend line chart (Income vs Expenses).
- **FR-DASH-004**: System MUST support time period filtering for all visualizations.
- **FR-DASH-005**: System MUST support account filtering for all visualizations.

**Budget Management**

- **FR-BUD-001**: System MUST allow setting monthly budget amounts per category.
- **FR-BUD-002**: System MUST display budget vs actual comparison with progress indicators.
- **FR-BUD-003**: System MUST visually highlight categories exceeding budget.

---

### Non-Functional Requirements

- **NFR-001**: Page load time SHOULD be under 2 seconds.
- **NFR-002**: CSV processing SHOULD complete within 5 seconds for 1000 transactions.
- **NFR-003**: Chart rendering SHOULD complete within 1 second.
- **NFR-004**: API responses SHOULD return within 500ms for typical queries.
- **NFR-005**: System MUST use HTTPS (CloudFront SSL termination).
- **NFR-006**: System MUST NOT store PII (no names, account numbers stored).
- **NFR-007**: System MUST be functional on tablet and mobile devices (responsive design).
- **NFR-008**: System SHOULD provide clear loading states during async operations.
- **NFR-009**: System SHOULD provide actionable error messages on failures.

---

### Key Entities

**Account**
- id (string, primary key)
- name (string, required: "Checking", "Savings", "Credit Card")
- account_type (string: "checking", "savings", "credit")
- created_at (datetime)

**Category**
- id (integer, primary key)
- name (string, required)
- category_type (string: "income", "expense", "transfer")
- parent_id (integer, nullable, self-reference)
- display_order (integer)

**Transaction**
- id (string, primary key, UUID)
- account_id (string, foreign key)
- date (date, required)
- description (string, required)
- amount (decimal, required)
- category_id (integer, foreign key, nullable)
- needs_review (boolean, default true)
- hash (string, unique, for duplicate detection)
- raw_data (json, original CSV row)
- created_at (datetime)

**CategorizationRule**
- id (integer, primary key)
- pattern (string, required)
- category_id (integer, foreign key)
- priority (integer, default 100)
- account_filter (string, nullable)
- created_at (datetime)

**Budget**
- id (integer, primary key)
- category_id (integer, foreign key)
- monthly_amount (decimal, required)
- effective_date (date, required)

---

## Initial Data

### Categories (seed data)

| id | name | category_type | parent_id |
|----|------|---------------|-----------|
| 1 | Income | income | null |
| 2 | Salary/Payroll | income | 1 |
| 3 | Interest | income | 1 |
| 4 | Housing | expense | null |
| 5 | Mortgage | expense | 4 |
| 6 | HOA Dues | expense | 4 |
| 7 | Utilities | expense | 4 |
| 8 | Transportation | expense | null |
| 9 | Gas | expense | 8 |
| 10 | Parking | expense | 8 |
| 11 | Food & Dining | expense | null |
| 12 | Groceries | expense | 11 |
| 13 | Restaurants | expense | 11 |
| 14 | Coffee | expense | 11 |
| 15 | Health & Fitness | expense | null |
| 16 | Gym | expense | 15 |
| 17 | Medical | expense | 15 |
| 18 | Shopping | expense | null |
| 19 | Amazon | expense | 18 |
| 20 | Clothing | expense | 18 |
| 21 | Entertainment | expense | null |
| 22 | Streaming | expense | 21 |
| 23 | Transfers | transfer | null |
| 24 | Credit Card Payment | transfer | 23 |
| 25 | Internal Transfer | transfer | 23 |
| 26 | Other | expense | null |

### Accounts (seed data)

| id | name | account_type |
|----|------|--------------|
| checking | Checking | checking |
| savings | Savings | savings |
| credit | Credit Card | credit |

### Sample Categorization Rules (seed data)

| pattern | category | priority |
|---------|----------|----------|
| COLLABERA | Salary/Payroll | 1 |
| Interest Earned | Interest | 1 |
| UNITEDWHOLESALE | Mortgage | 1 |
| Denny Way Condos | HOA Dues | 1 |
| BANK OF AMERICA CREDIT CARD | Credit Card Payment | 1 |
| Online Banking transfer | Internal Transfer | 1 |
| SAFEWAY | Groceries | 10 |
| QFC | Groceries | 10 |
| UWAJIMAYA | Groceries | 10 |
| WHOLE FOODS | Groceries | 10 |
| SHELL | Gas | 20 |
| AMAZON | Amazon | 20 |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of valid CSV files upload without error.
- **SC-002**: >80% of transactions auto-categorized after initial rule training.
- **SC-003**: All page interactions complete within 2 seconds.
- **SC-004**: Zero transaction amount errors (100% accuracy in parsing).
- **SC-005**: Dashboard loads in under 3 seconds with 5000+ transactions.
- **SC-006**: User can complete full workflow (upload -> categorize -> view dashboard) in under 5 minutes.

---

## Assumptions

- User has Bank of America accounts (CSV format is specific to this bank).
- User will manually download and upload CSV files (no automatic bank sync).
- Single user only - no multi-user or sharing requirements.
- User is comfortable with basic web interfaces.
- AWS infrastructure is available and configured.
- User will review and approve auto-categorization rules for accuracy.

---

## Out of Scope (Future Considerations)

- Automatic bank account synchronization (Plaid, etc.)
- Multiple user accounts and authentication
- Shared household budgeting
- Bill payment reminders and scheduling
- Investment portfolio tracking
- Tax preparation features
- Recurring transaction detection and prediction
- AI-powered spending recommendations
- Mobile native applications
- Support for banks other than Bank of America

---

## Dependencies

- AWS Lambda (Python 3.12 runtime)
- AWS API Gateway (HTTP API)
- AWS S3 (SQLite storage, static frontend hosting)
- AWS CloudFront (CDN, HTTPS)
- Chart.js v4 (frontend charting)
- Tabulator.js v5 (data grid)
- PyJWT (token handling)
- bcrypt (password hashing)
