# Data Model: PFA Core Application

**Spec**: [spec.md](./spec.md)
**Created**: January 24, 2026

## Overview

PFA uses SQLite as its database, stored in S3 and downloaded to Lambda on each invocation. This approach keeps infrastructure simple while providing full SQL capabilities. The schema supports transaction storage, categorization, and budget tracking.

## Entities

### Account

Represents a bank account (Checking, Savings, Credit Card).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | Primary Key | Unique identifier (e.g., "checking", "savings", "credit") |
| name | TEXT | Required | Display name |
| account_type | TEXT | Required | Type: "checking", "savings", "credit" |
| created_at | TEXT | Required, auto | ISO 8601 timestamp |

**Relationships**:
- Has many Transactions

### Category

Represents a spending/income category with optional hierarchy.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | Primary Key, Auto-increment | Unique identifier |
| name | TEXT | Required | Display name |
| category_type | TEXT | Required | Type: "income", "expense", "transfer" |
| parent_id | INTEGER | Foreign Key, Nullable | Parent category for hierarchy |
| display_order | INTEGER | Default 0 | Sort order for UI display |
| created_at | TEXT | Required, auto | ISO 8601 timestamp |

**Relationships**:
- Has many Transactions
- Has many CategorizationRules
- Has many Budgets
- Self-referential (parent/children)

### Transaction

Represents a single financial transaction from CSV upload.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | Primary Key | UUID |
| account_id | TEXT | Foreign Key, Required | Reference to Account |
| date | TEXT | Required | Transaction date (YYYY-MM-DD) |
| description | TEXT | Required | Payee/description from CSV |
| amount | REAL | Required | Transaction amount (positive = income, negative = expense) |
| category_id | INTEGER | Foreign Key, Nullable | Assigned category |
| needs_review | INTEGER | Default 1 | Boolean: 1 = needs categorization |
| hash | TEXT | Unique, Required | Deterministic hash for duplicate detection |
| raw_data | TEXT | Nullable | Original CSV row as JSON |
| created_at | TEXT | Required, auto | ISO 8601 timestamp |

**Relationships**:
- Belongs to Account
- Belongs to Category (optional)

### CategorizationRule

Defines patterns for auto-categorizing transactions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | Primary Key, Auto-increment | Unique identifier |
| pattern | TEXT | Required | Case-insensitive substring to match |
| category_id | INTEGER | Foreign Key, Required | Target category |
| priority | INTEGER | Default 100 | Lower = higher priority (first match wins) |
| account_filter | TEXT | Nullable | Optional: only apply to specific account_id |
| is_active | INTEGER | Default 1 | Boolean: 1 = active |
| created_at | TEXT | Required, auto | ISO 8601 timestamp |

**Relationships**:
- Belongs to Category

### Budget

Defines monthly spending limits per category.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | Primary Key, Auto-increment | Unique identifier |
| category_id | INTEGER | Foreign Key, Required | Category this budget applies to |
| monthly_amount | REAL | Required | Budget limit in dollars |
| effective_date | TEXT | Required | Start date (YYYY-MM-DD), typically first of month |
| created_at | TEXT | Required, auto | ISO 8601 timestamp |

**Relationships**:
- Belongs to Category

### Setting

Key-value store for application configuration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | TEXT | Primary Key | Setting name |
| value | TEXT | Required | Setting value (may be JSON) |
| updated_at | TEXT | Required, auto | ISO 8601 timestamp |

---

## Database Schema

### SQLite Implementation

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Accounts table
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories table (hierarchical)
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'transfer')),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions table
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    needs_review INTEGER DEFAULT 1,
    hash TEXT UNIQUE NOT NULL,
    raw_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorization rules table
CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 100,
    account_filter TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgets table
CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    monthly_amount REAL NOT NULL CHECK (monthly_amount >= 0),
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category_id, effective_date)
);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_needs_review ON transactions(needs_review);
CREATE INDEX idx_categorization_rules_priority ON categorization_rules(priority);
CREATE INDEX idx_budgets_category_date ON budgets(category_id, effective_date);
```

### Views

```sql
-- Transaction summary with joined category and account names
CREATE VIEW v_transaction_summary AS
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.needs_review,
    t.created_at,
    a.id AS account_id,
    a.name AS account_name,
    a.account_type,
    c.id AS category_id,
    c.name AS category_name,
    c.category_type,
    pc.name AS parent_category_name
FROM transactions t
JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id;

-- Monthly totals by category
CREATE VIEW v_monthly_summary AS
SELECT
    strftime('%Y-%m', t.date) AS month,
    c.id AS category_id,
    c.name AS category_name,
    c.category_type,
    pc.name AS parent_category_name,
    a.account_type,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_amount,
    SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END) AS total_spent,
    SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS total_income
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
JOIN accounts a ON t.account_id = a.id
GROUP BY strftime('%Y-%m', t.date), c.id, a.account_type;

-- Daily running totals for current month chart
CREATE VIEW v_daily_spending AS
SELECT
    t.date,
    SUM(t.amount) AS daily_total,
    SUM(SUM(t.amount)) OVER (ORDER BY t.date) AS running_total
FROM transactions t
WHERE t.amount < 0
  AND strftime('%Y-%m', t.date) = strftime('%Y-%m', 'now')
GROUP BY t.date
ORDER BY t.date;

-- Budget vs actual comparison
CREATE VIEW v_budget_actual AS
SELECT
    b.id AS budget_id,
    b.category_id,
    c.name AS category_name,
    b.monthly_amount AS budget_amount,
    strftime('%Y-%m', b.effective_date) AS budget_month,
    COALESCE(SUM(ABS(t.amount)), 0) AS actual_spent,
    b.monthly_amount - COALESCE(SUM(ABS(t.amount)), 0) AS remaining,
    CASE
        WHEN b.monthly_amount > 0
        THEN ROUND(COALESCE(SUM(ABS(t.amount)), 0) / b.monthly_amount * 100, 1)
        ELSE 0
    END AS percent_used
FROM budgets b
JOIN categories c ON b.category_id = c.id
LEFT JOIN transactions t ON t.category_id = b.category_id
    AND strftime('%Y-%m', t.date) = strftime('%Y-%m', b.effective_date)
    AND t.amount < 0
GROUP BY b.id, b.category_id, c.name, b.monthly_amount, b.effective_date;

-- Review queue (uncategorized transactions)
CREATE VIEW v_review_queue AS
SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    a.name AS account_name,
    t.created_at
FROM transactions t
JOIN accounts a ON t.account_id = a.id
WHERE t.needs_review = 1
ORDER BY t.date DESC;
```

---

## Python Dataclasses

```python
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
import uuid

@dataclass
class Account:
    id: str
    name: str
    account_type: str  # "checking", "savings", "credit"
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Category:
    id: int
    name: str
    category_type: str  # "income", "expense", "transfer"
    parent_id: Optional[int] = None
    display_order: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Transaction:
    id: str
    account_id: str
    date: date
    description: str
    amount: Decimal
    hash: str
    category_id: Optional[int] = None
    needs_review: bool = True
    raw_data: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    @staticmethod
    def generate_id() -> str:
        return str(uuid.uuid4())

@dataclass
class CategorizationRule:
    id: int
    pattern: str
    category_id: int
    priority: int = 100
    account_filter: Optional[str] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Budget:
    id: int
    category_id: int
    monthly_amount: Decimal
    effective_date: date
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Setting:
    key: str
    value: str
    updated_at: datetime = field(default_factory=datetime.utcnow)
```

---

## Seed Data

### Accounts (initial data)

| id | name | account_type |
|----|------|--------------|
| checking | Checking | checking |
| savings | Savings | savings |
| credit | Credit Card | credit |

### Categories (initial data)

```sql
-- Top-level categories
INSERT INTO categories (id, name, category_type, parent_id, display_order) VALUES
(1, 'Income', 'income', NULL, 1),
(2, 'Housing', 'expense', NULL, 2),
(3, 'Transportation', 'expense', NULL, 3),
(4, 'Food & Dining', 'expense', NULL, 4),
(5, 'Health & Fitness', 'expense', NULL, 5),
(6, 'Shopping', 'expense', NULL, 6),
(7, 'Entertainment', 'expense', NULL, 7),
(8, 'Transfers', 'transfer', NULL, 8),
(9, 'Other', 'expense', NULL, 99);

-- Income subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Salary/Payroll', 'income', 1, 1),
('Interest', 'income', 1, 2),
('Refunds', 'income', 1, 3),
('Other Income', 'income', 1, 99);

-- Housing subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Mortgage', 'expense', 2, 1),
('HOA Dues', 'expense', 2, 2),
('Internet', 'expense', 2, 3),
('Phone', 'expense', 2, 4),
('Utilities', 'expense', 2, 5);

-- Transportation subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Gas', 'expense', 3, 1),
('Parking', 'expense', 3, 2),
('Rideshare', 'expense', 3, 3);

-- Food & Dining subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Groceries', 'expense', 4, 1),
('Restaurants', 'expense', 4, 2),
('Coffee', 'expense', 4, 3),
('Delivery', 'expense', 4, 4);

-- Health & Fitness subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Gym', 'expense', 5, 1),
('Medical', 'expense', 5, 2),
('Pharmacy', 'expense', 5, 3);

-- Shopping subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Amazon', 'expense', 6, 1),
('Clothing', 'expense', 6, 2),
('Home', 'expense', 6, 3);

-- Entertainment subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Streaming', 'expense', 7, 1),
('Events', 'expense', 7, 2),
('Travel', 'expense', 7, 3);

-- Transfers subcategories
INSERT INTO categories (name, category_type, parent_id, display_order) VALUES
('Credit Card Payment', 'transfer', 8, 1),
('Internal Transfer', 'transfer', 8, 2),
('Zelle', 'transfer', 8, 3);
```

### Sample Categorization Rules (initial data)

```sql
INSERT INTO categorization_rules (pattern, category_id, priority) VALUES
-- High priority (exact matches)
('COLLABERA', (SELECT id FROM categories WHERE name = 'Salary/Payroll'), 1),
('Interest Earned', (SELECT id FROM categories WHERE name = 'Interest'), 1),
('UNITEDWHOLESALE', (SELECT id FROM categories WHERE name = 'Mortgage'), 1),
('Denny Way Condos', (SELECT id FROM categories WHERE name = 'HOA Dues'), 1),
('BANK OF AMERICA CREDIT CARD', (SELECT id FROM categories WHERE name = 'Credit Card Payment'), 1),
('Online Banking transfer', (SELECT id FROM categories WHERE name = 'Internal Transfer'), 1),
('Zelle payment', (SELECT id FROM categories WHERE name = 'Zelle'), 5),

-- Medium priority (utilities)
('T-MOBILE', (SELECT id FROM categories WHERE name = 'Phone'), 10),
('COMCAST', (SELECT id FROM categories WHERE name = 'Internet'), 10),
('XFINITY', (SELECT id FROM categories WHERE name = 'Internet'), 10),

-- Medium priority (food)
('SAFEWAY', (SELECT id FROM categories WHERE name = 'Groceries'), 10),
('QFC', (SELECT id FROM categories WHERE name = 'Groceries'), 10),
('UWAJIMAYA', (SELECT id FROM categories WHERE name = 'Groceries'), 10),
('CENTRAL CO-OP', (SELECT id FROM categories WHERE name = 'Groceries'), 10),
('WHOLE FOODS', (SELECT id FROM categories WHERE name = 'Groceries'), 10),
('VICTROLA', (SELECT id FROM categories WHERE name = 'Coffee'), 10),
('DAY 1 COFFEE', (SELECT id FROM categories WHERE name = 'Coffee'), 10),
('YMCA', (SELECT id FROM categories WHERE name = 'Gym'), 10),

-- Lower priority (broader matches)
('AMAZON', (SELECT id FROM categories WHERE name = 'Amazon'), 20),
('SHELL', (SELECT id FROM categories WHERE name = 'Gas'), 20),
('PAYBYPHONE', (SELECT id FROM categories WHERE name = 'Parking'), 20),
('NORDSTROM', (SELECT id FROM categories WHERE name = 'Clothing'), 20);
```

---

## Data Validation Rules

- **Account.id**: Non-empty, lowercase alphanumeric
- **Account.account_type**: Must be one of: "checking", "savings", "credit"
- **Category.name**: Non-empty, max 100 characters
- **Category.category_type**: Must be one of: "income", "expense", "transfer"
- **Transaction.amount**: Non-zero decimal
- **Transaction.date**: Valid date in YYYY-MM-DD format
- **Transaction.hash**: Unique across all transactions
- **CategorizationRule.pattern**: Non-empty string
- **CategorizationRule.priority**: Positive integer
- **Budget.monthly_amount**: Non-negative decimal
- **Foreign keys**: Must reference existing records

---

## Query Patterns

### Common Queries

```sql
-- Get transactions for a date range with pagination
SELECT * FROM v_transaction_summary
WHERE date BETWEEN ? AND ?
ORDER BY date DESC
LIMIT ? OFFSET ?;

-- Get transactions needing review
SELECT * FROM v_review_queue
LIMIT 50;

-- Get monthly spending by category for dashboard
SELECT
    category_name,
    SUM(total_spent) AS spent
FROM v_monthly_summary
WHERE month = strftime('%Y-%m', 'now')
  AND category_type = 'expense'
GROUP BY category_id
ORDER BY spent;

-- Get income vs expenses trend (last 12 months)
SELECT
    month,
    SUM(total_income) AS income,
    SUM(total_spent) AS expenses
FROM v_monthly_summary
WHERE month >= strftime('%Y-%m', 'now', '-12 months')
GROUP BY month
ORDER BY month;

-- Check for duplicate transaction
SELECT id FROM transactions WHERE hash = ?;

-- Get active rules ordered by priority
SELECT r.*, c.name AS category_name
FROM categorization_rules r
JOIN categories c ON r.category_id = c.id
WHERE r.is_active = 1
ORDER BY r.priority, r.id;

-- Get budget status for current month
SELECT * FROM v_budget_actual
WHERE budget_month = strftime('%Y-%m', 'now');

-- Search transactions by description
SELECT * FROM v_transaction_summary
WHERE description LIKE '%' || ? || '%'
ORDER BY date DESC
LIMIT 100;
```

### Performance Considerations

- Index on `transactions.date` for date range queries (most common filter)
- Index on `transactions.hash` for duplicate detection (unique constraint provides this)
- Index on `transactions.needs_review` for review queue queries
- Index on `categorization_rules.priority` for ordered rule application
- Views pre-join common data to avoid repeated joins in application code
- Pagination required for transaction lists (LIMIT/OFFSET)
- Consider monthly partitioning strategy if data grows significantly

---

## S3 Storage Strategy

The SQLite database file is stored in S3 and downloaded to Lambda `/tmp` on each cold start:

1. **Cold Start**: Download `pfa.db` from S3 to `/tmp/pfa.db`
2. **Request Processing**: Execute queries against local file
3. **Write Operations**: After writes, upload modified database back to S3
4. **Concurrency**: Single-user system, so concurrent write conflicts are unlikely

```python
# Pseudo-code for S3 database handling
def get_database():
    local_path = '/tmp/pfa.db'
    if not os.path.exists(local_path):
        s3.download_file(BUCKET, 'pfa.db', local_path)
    return sqlite3.connect(local_path)

def save_database():
    s3.upload_file('/tmp/pfa.db', BUCKET, 'pfa.db')
```

**Backup Strategy**: Enable S3 versioning on the data bucket to maintain history of database states.
