# Personal Finance Awareness (PFA) Application

## Requirements Specification

**Version:** 1.0  
**Date:** January 24, 2026  
**Author:** Evie Hwang

---

## 1. Executive Summary

PFA is a single-user personal finance tracking application that provides awareness and visualization of personal spending patterns. Users manually upload CSV transaction exports from their bank accounts. The system processes these files, categorizes transactions, and presents financial data through an interactive web dashboard.

### Core Value Proposition

- **Awareness over automation**: The goal is financial visibility, not optimization recommendations
- **Manual upload workflow**: Accepts the limitation of CSV file uploads as the data ingestion method
- **Simple categorization**: Transaction categorization with pattern learning
- **Visual insights**: Charts and summaries that make spending patterns clear

---

## 2. Functional Requirements

### 2.1 Authentication

| Requirement | Description |
|-------------|-------------|
| Single-user system | One password protects all access |
| Password-only login | No username field required |
| Session persistence | JWT token with 24-hour expiry stored in localStorage |
| Secure storage | Password hashed with bcrypt, stored as environment parameter |

**User Flow:**
1. User navigates to application URL
2. Login modal appears if no valid token exists
3. User enters password
4. On success, JWT token stored and dashboard loads
5. Token auto-refreshes or prompts re-login on expiry

### 2.2 Transaction Upload

| Requirement | Description |
|-------------|-------------|
| CSV format support | Accept Bank of America CSV exports (two formats) |
| Multiple account support | Track transactions across: Checking, Savings, Credit Card |
| Duplicate detection | Prevent re-importing same transactions |
| Batch processing | Handle files with hundreds of transactions |

**Supported CSV Formats:**

The system must support two distinct bank export formats:

*Format A: Credit Card (Bank of America)*
```
Posted Date,Reference Number,Payee,Address,Amount
01/12/2026,24251386011030100885519,"FRAME CENTRAL - PIKE SEATTLE WA","SEATTLE WA",-22.94
```
- Columns: Posted Date, Reference Number, Payee, Address, Amount
- Date format: MM/DD/YYYY
- Amount: Negative for purchases, positive for payments/credits
- Reference Number: Unique transaction identifier (use for duplicate detection)

*Format B: Checking/Savings (Bank of America)*
```
Description,,Summary Amt.
Beginning balance as of 07/01/2025,,"11,229.33"
...header rows...

Date,Description,Amount,Running Bal.
07/03/2025,"COLLABERA LLC DES:DIRECT DEP...","1,704.53","12,933.86"
```
- Header section: Summary info (skip during import)
- Transaction section: Date, Description, Amount, Running Bal.
- Date format: MM/DD/YYYY
- Amount: Positive for credits, negative for debits (may include commas)
- Running Balance: Can be used for validation

**CSV Parsing Requirements:**
- Detect format automatically based on header row
- Handle quoted fields with commas inside
- Parse amounts with comma thousands separators
- Skip summary/header rows in Format B
- Handle empty Amount fields (balance-only rows)

**Upload Workflow:**
1. User selects CSV file and specifies source account (Checking, Savings, Credit Card)
2. System auto-detects CSV format from header row
3. System parses and validates CSV structure
4. Duplicate detection:
   - Credit Card: Hash of Posted Date + Reference Number
   - Checking/Savings: Hash of Date + Amount + Description (first 50 chars)
5. New transactions inserted with `needs_review = true` for uncategorized items
6. Auto-categorization rules applied
7. Summary shown: X new, Y duplicates, Z need review

### 2.3 Transaction Categorization

#### 2.3.1 Category Structure

| Category Type | Examples |
|---------------|----------|
| Income | Salary, Interest, Refunds, Side Income |
| Housing | Rent/Mortgage, Utilities, Insurance, Maintenance |
| Transportation | Gas, Car Payment, Insurance, Parking, Transit |
| Food | Groceries, Restaurants, Coffee, Delivery |
| Health | Medical, Pharmacy, Fitness, Insurance |
| Shopping | Clothing, Electronics, Home Goods |
| Entertainment | Streaming, Events, Hobbies, Travel |
| Financial | Savings Transfer, Investment, Fees, Taxes |
| Other | Uncategorized |

#### 2.3.2 Auto-Categorization Rules

| Feature | Description |
|---------|-------------|
| Pattern matching | Text patterns in description → category mapping |
| Priority ordering | Rules applied in priority order (first match wins) |
| User-defined rules | CRUD interface for managing patterns |
| Learning capability | Option to create rule when manually categorizing |

**Rule Structure:**
```
{
  pattern: "WHOLE FOODS",      // Case-insensitive substring match
  category_id: 5,              // Maps to "Groceries"
  priority: 10,                // Lower = higher priority
  account_filter: null         // Optional: only apply to specific account
}
```

**Sample Initial Rules (derived from transaction patterns):**

| Pattern | Category | Priority |
|---------|----------|----------|
| COLLABERA | Salary/Payroll | 1 |
| Interest Earned | Interest | 1 |
| UNITEDWHOLESALE | Mortgage | 1 |
| Denny Way Condos | HOA Dues | 1 |
| BANK OF AMERICA CREDIT CARD | Credit Card Payment | 1 |
| Online Banking transfer | Internal Transfer | 1 |
| Zelle payment | Zelle | 5 |
| T-MOBILE | Phone | 10 |
| COMCAST | Internet | 10 |
| XFINITY | Internet | 10 |
| YMCA | Gym | 10 |
| UWAJIMAYA | Groceries | 10 |
| CENTRAL CO-OP | Groceries | 10 |
| SAFEWAY | Groceries | 10 |
| QFC | Groceries | 10 |
| DAY 1 COFFEE | Coffee | 10 |
| DAY 1-MKT CAFE | Coffee | 10 |
| VICTROLA | Coffee | 10 |
| AMAZON MKTPL | Amazon | 20 |
| AMAZON RETA | Amazon | 20 |
| NORDSTROM | Clothing | 20 |
| PAYBYPHONE | Parking | 20 |
| SHELL | Gas | 20 |

#### 2.3.3 Review Queue

| Feature | Description |
|---------|-------------|
| Flagged transactions | Items with `needs_review = true` |
| Category assignment | Dropdown to select category |
| Rule creation prompt | "Create rule for similar transactions?" |
| Batch review | Process multiple similar items at once |

### 2.4 Transaction Viewer

| Feature | Description |
|---------|-------------|
| Interactive table | Sortable, filterable data grid |
| Column display | Date, Account, Category, Description, Amount |
| Date range filter | Quick filters: This Month, Last Month, YTD, Custom |
| Category filter | Filter by one or more categories |
| Account filter | Filter by source account |
| Search | Text search across descriptions |
| Pagination | 25/50/100 rows per page |
| Export | Download filtered view as CSV |

### 2.5 Dashboard & Visualizations

#### 2.5.1 Summary Cards

| Card | Content |
|------|---------|
| Net Worth Trend | Total across all accounts with period change |
| Monthly Spending | Current month total vs. previous month |
| Top Category | Highest spending category this period |
| Pending Review | Count of transactions needing categorization |

#### 2.5.2 Charts

| Chart | Type | Description |
|-------|------|-------------|
| Spending by Category | Pie/Donut | Category breakdown for selected period |
| Monthly Trend | Line | Income vs. Expenses over 12 months |
| Category Comparison | Horizontal Bar | This month vs. last month by category |
| Daily Spending | Area | Running total through current month |

#### 2.5.3 Filters

| Filter | Options |
|--------|---------|
| Time Period | This Month, Last Month, Last 3 Months, YTD, Custom Range |
| Account | All, Checking, Savings, Credit Card |

### 2.6 Budget Management

| Feature | Description |
|---------|-------------|
| Monthly budgets | Set target amounts per category |
| Budget vs. Actual | Compare planned vs. actual spending |
| Visual indicators | Progress bars showing budget utilization |
| Alerts | Highlight categories over budget |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target |
|--------|--------|
| Page load | < 2 seconds |
| CSV processing | < 5 seconds for 1000 transactions |
| Chart rendering | < 1 second |
| API response | < 500ms for typical queries |

### 3.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Password hashing | bcrypt with salt rounds ≥ 10 |
| Token security | HS256 JWT with secure secret |
| HTTPS only | CloudFront SSL termination |
| No PII storage | No names, account numbers stored |

### 3.3 Reliability

| Requirement | Implementation |
|-------------|----------------|
| Data persistence | SQLite database stored in S3 |
| Backup capability | S3 versioning enabled |
| Error handling | Graceful degradation with user feedback |

### 3.4 Usability

| Requirement | Description |
|-------------|-------------|
| Mobile responsive | Functional on tablet and mobile |
| Keyboard navigation | Tab through forms, Enter to submit |
| Loading states | Spinners/skeletons during data fetch |
| Error messages | Clear, actionable error descriptions |

---

## 4. Technical Architecture

### 4.1 Infrastructure (AWS SAM)

| Resource | Service | Purpose |
|----------|---------|---------|
| DataBucket | S3 | SQLite database storage |
| FrontendBucket | S3 | Static web hosting |
| ApiFunction | Lambda | Python API handler |
| HttpApi | API Gateway | HTTP API with CORS |
| CloudFront | CDN | SSL, caching, routing |

### 4.2 Backend Stack

| Component | Technology |
|-----------|------------|
| Runtime | Python 3.12 |
| Database | SQLite (downloaded from S3 per invocation) |
| API Framework | AWS Lambda function URLs or API Gateway HTTP API |
| Authentication | PyJWT for token handling |

### 4.3 Frontend Stack

| Component | Technology |
|-----------|------------|
| Framework | Vanilla HTML/CSS/JavaScript (no framework) |
| Charts | Chart.js v4 |
| Data Tables | Tabulator.js v5 |
| Architecture | Single Page Application with modals |

### 4.4 Data Model

#### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| accounts | Account definitions | id, name, account_type |
| categories | Category definitions | id, name, category_type, parent_id |
| transactions | All transactions | id, account_id, date, description, amount, category_id, needs_review, hash |
| categorize_rules | Auto-categorization patterns | id, pattern, category_id, priority |
| settings | App configuration | key, value |

#### Views

| View | Purpose |
|------|---------|
| v_transaction_summary | Transactions with category names joined |
| v_monthly_summary | Aggregated monthly totals by category |

### 4.5 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | None | Authenticate, return JWT |
| GET | /api/auth/verify | Bearer | Validate token |
| GET | /api/dashboard | Bearer | Dashboard summary data |
| GET | /api/transactions | Bearer | List transactions (with filters) |
| POST | /api/transactions/upload | Bearer | Upload CSV file |
| PATCH | /api/transactions/{id} | Bearer | Update transaction category |
| GET | /api/transactions/review | Bearer | Get items needing review |
| POST | /api/transactions/review/batch | Bearer | Batch update categories |
| GET | /api/categories | Bearer | List all categories |
| POST | /api/categories | Bearer | Create new category |
| PATCH | /api/categories/{id} | Bearer | Update category |
| DELETE | /api/categories/{id} | Bearer | Delete category (if unused) |
| GET | /api/rules | Bearer | List categorization rules |
| POST | /api/rules | Bearer | Create rule |
| PATCH | /api/rules/{id} | Bearer | Update rule |
| DELETE | /api/rules/{id} | Bearer | Delete rule |
| GET | /api/budgets | Bearer | List budgets |
| POST | /api/budgets | Bearer | Create/update budget |
| GET | /api/export | Bearer | Export transactions as CSV |

---

## 5. User Interface Specifications

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PFA Logo                              [Upload] [Settings]  │
├─────────────────────────────────────────────────────────────┤
│  [This Month ▼]  [All Accounts ▼]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Net Worth│ │ Monthly  │ │   Top    │ │  Review  │       │
│  │ $XX,XXX  │ │ Spending │ │ Category │ │  Queue   │       │
│  │  +$XXX   │ │  $X,XXX  │ │   Food   │ │   (12)   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │                     │  │                     │          │
│  │   Spending by       │  │   Monthly Trend     │          │
│  │   Category (Pie)    │  │   (Line Chart)      │          │
│  │                     │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Recent Transactions                        [View All →]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Date     │ Description      │ Category │ Amount    │   │
│  │ 01/24    │ Whole Foods      │ Grocery  │ -$127.43  │   │
│  │ 01/23    │ Shell Gas        │ Gas      │ -$45.00   │   │
│  │ 01/22    │ Direct Deposit   │ Income   │ +$3,200   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Modal Dialogs

| Modal | Trigger | Content |
|-------|---------|---------|
| Login | Page load (no token) | Password field, submit button |
| Upload | Upload button | File picker, account selector, preview |
| Review | Badge click | Transaction list, category dropdowns |
| Rules | Settings menu | Rule list, add/edit/delete |
| Transaction Edit | Row click | Category selector, notes, rule creation |

### 5.3 Color Palette

| Use | Color | Hex |
|-----|-------|-----|
| Income/Positive | Green | #22C55E |
| Expense/Negative | Red | #EF4444 |
| Primary Action | Blue | #3B82F6 |
| Background | Light Gray | #F8FAFC |
| Card Background | White | #FFFFFF |
| Text Primary | Dark Gray | #1E293B |
| Text Secondary | Medium Gray | #64748B |

---

## 6. Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] AWS infrastructure setup (SAM template)
- [ ] Authentication system
- [ ] Basic database schema
- [ ] CSV upload and parsing
- [ ] Transaction storage with duplicate detection
- [ ] Simple transaction list view

### Phase 2: Categorization
- [ ] Category management
- [ ] Manual transaction categorization
- [ ] Auto-categorization rules engine
- [ ] Review queue interface

### Phase 3: Visualization
- [ ] Dashboard layout
- [ ] Summary cards
- [ ] Spending by category chart
- [ ] Monthly trend chart
- [ ] Date range filtering

### Phase 4: Enhancement
- [ ] Budget management
- [ ] Budget vs. actual comparison
- [ ] Transaction search and export
- [ ] Mobile responsive refinements
- [ ] Performance optimization

---

## 7. Deployment

### Build & Deploy Commands

```bash
# Backend deployment
sam build
sam deploy --guided  # First time setup
sam deploy           # Subsequent deploys

# Frontend deployment
aws s3 sync frontend/ s3://pfa-frontend-{ACCOUNT_ID}
aws cloudfront create-invalidation --distribution-id {ID} --paths "/*"

# Local development
sam local start-api
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| PASSWORD_HASH | bcrypt hash of login password |
| JWT_SECRET | Secret key for token signing |
| DATA_BUCKET | S3 bucket name for database |
| CORS_ORIGIN | Allowed origin for CORS |

---

## 8. Success Criteria

| Metric | Target |
|--------|--------|
| Upload success rate | 100% for valid CSVs |
| Categorization accuracy | >80% auto-categorized after training |
| Page responsiveness | All interactions < 2 seconds |
| Data accuracy | Zero transaction amount errors |
| User satisfaction | Clear spending awareness achieved |

---

## 9. Out of Scope

The following features are explicitly excluded from this version:

- Automatic bank account sync (Plaid, etc.)
- Multiple user accounts
- Shared household budgeting
- Bill payment reminders
- Investment tracking
- Tax preparation features
- Recurring transaction detection
- Spending recommendations or AI insights

---

## 10. Appendix: Sample Category Hierarchy

```
Income
├── Salary/Payroll (COLLABERA, DIRECT DEP)
├── Interest (Interest Earned)
├── Resale (The RealReal)
└── Other Income

Housing
├── Mortgage (UNITEDWHOLESALE LOAN PAYMT)
├── HOA Dues (Denny Way Condos)
├── Utilities
│   ├── Internet (COMCAST/XFINITY)
│   └── Phone (T-MOBILE)
└── Maintenance

Transportation
├── Gas (SHELL)
├── Parking (PAYBYPHONE, LAZ PARKING)
└── Rideshare

Food & Dining
├── Groceries (UWAJIMAYA, CENTRAL CO-OP, SAFEWAY, QFC)
├── Restaurants (KIN DEE, BOILING POINT, CAFE CAMPAGNE)
├── Coffee (DAY 1 COFFEE, VICTROLA, SINGLE SHOT)
├── Bakery (BAKERY NOUVEAU, MACRINA, FRENCH GUYS)
└── Delivery (PAGLIACCI)

Health & Fitness
├── Gym (YMCA)
├── Pharmacy (Express Scripts, EnGuide)
├── Medical (PROVIDENCE)
└── Vision (EYE EYE PINE)

Shopping
├── Amazon (AMAZON MKTPL, AMAZON RETA)
├── Clothing (NORDSTROM, UNIQLO, ALO-YOGA)
├── Home (SUR LA TABLE, FRAME CENTRAL)
├── Books (KINOKUNIYA)
└── Pet Supplies (MUD BAY)

Entertainment & Subscriptions
├── Streaming (Disney Plus, APPLE.COM/BILL, BRAVE)
├── News (NYTIMES, ST SUBSCRIPTIONS, VANITY FAIR)
├── Memberships (GSBA, Patreon)
└── Events

Technology
├── Cloud Services (AWS, Google Workspace)
└── Software

Transfers & Payments
├── Credit Card Payment (BANK OF AMERICA CREDIT CARD)
├── Internal Transfer (Online Banking transfer)
└── Zelle (Zelle payment)

Other
└── Uncategorized
```

---

*End of Requirements Document*
