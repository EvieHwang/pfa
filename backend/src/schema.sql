-- PFA Database Schema
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories table (hierarchical)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'transfer')),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
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
CREATE TABLE IF NOT EXISTS categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 100,
    account_filter TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    monthly_amount REAL NOT NULL CHECK (monthly_amount >= 0),
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category_id, effective_date)
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions(needs_review);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_priority ON categorization_rules(priority);
CREATE INDEX IF NOT EXISTS idx_budgets_category_date ON budgets(category_id, effective_date);

-- Views

-- Transaction summary with joined category and account names
CREATE VIEW IF NOT EXISTS v_transaction_summary AS
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
CREATE VIEW IF NOT EXISTS v_monthly_summary AS
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

-- Budget vs actual comparison
CREATE VIEW IF NOT EXISTS v_budget_actual AS
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
CREATE VIEW IF NOT EXISTS v_review_queue AS
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

-- Seed Data: Accounts
INSERT OR IGNORE INTO accounts (id, name, account_type) VALUES
('checking', 'Checking', 'checking'),
('savings', 'Savings', 'savings'),
('credit', 'Credit Card', 'credit');

-- Seed Data: Categories (Top-level)
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(1, 'Income', 'income', NULL, 1),
(2, 'Housing', 'expense', NULL, 2),
(3, 'Transportation', 'expense', NULL, 3),
(4, 'Food & Dining', 'expense', NULL, 4),
(5, 'Health & Fitness', 'expense', NULL, 5),
(6, 'Shopping', 'expense', NULL, 6),
(7, 'Entertainment', 'expense', NULL, 7),
(8, 'Transfers', 'transfer', NULL, 8),
(9, 'Other', 'expense', NULL, 99);

-- Seed Data: Subcategories
-- Income subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(10, 'Salary/Payroll', 'income', 1, 1),
(11, 'Interest', 'income', 1, 2),
(12, 'Refunds', 'income', 1, 3),
(13, 'Other Income', 'income', 1, 99);

-- Housing subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(14, 'Mortgage', 'expense', 2, 1),
(15, 'HOA Dues', 'expense', 2, 2),
(16, 'Internet', 'expense', 2, 3),
(17, 'Phone', 'expense', 2, 4),
(18, 'Utilities', 'expense', 2, 5);

-- Transportation subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(19, 'Gas', 'expense', 3, 1),
(20, 'Parking', 'expense', 3, 2),
(21, 'Rideshare', 'expense', 3, 3);

-- Food & Dining subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(22, 'Groceries', 'expense', 4, 1),
(23, 'Restaurants', 'expense', 4, 2),
(24, 'Coffee', 'expense', 4, 3),
(25, 'Delivery', 'expense', 4, 4);

-- Health & Fitness subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(26, 'Gym', 'expense', 5, 1),
(27, 'Medical', 'expense', 5, 2),
(28, 'Pharmacy', 'expense', 5, 3);

-- Shopping subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(29, 'Amazon', 'expense', 6, 1),
(30, 'Clothing', 'expense', 6, 2),
(31, 'Home', 'expense', 6, 3);

-- Entertainment subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(32, 'Streaming', 'expense', 7, 1),
(33, 'Events', 'expense', 7, 2),
(34, 'Travel', 'expense', 7, 3);

-- Transfers subcategories
INSERT OR IGNORE INTO categories (id, name, category_type, parent_id, display_order) VALUES
(35, 'Credit Card Payment', 'transfer', 8, 1),
(36, 'Internal Transfer', 'transfer', 8, 2),
(37, 'Zelle', 'transfer', 8, 3);

-- Seed Data: Sample Categorization Rules
INSERT OR IGNORE INTO categorization_rules (pattern, category_id, priority) VALUES
-- High priority (exact matches)
('COLLABERA', 10, 1),
('Interest Earned', 11, 1),
('UNITEDWHOLESALE', 14, 1),
('Denny Way Condos', 15, 1),
('BANK OF AMERICA CREDIT CARD', 35, 1),
('Online Banking transfer', 36, 1),
('Zelle payment', 37, 5),

-- Medium priority (utilities)
('T-MOBILE', 17, 10),
('COMCAST', 16, 10),
('XFINITY', 16, 10),

-- Medium priority (food)
('SAFEWAY', 22, 10),
('QFC', 22, 10),
('UWAJIMAYA', 22, 10),
('CENTRAL CO-OP', 22, 10),
('WHOLE FOODS', 22, 10),
('VICTROLA', 24, 10),
('DAY 1 COFFEE', 24, 10),
('YMCA', 26, 10),

-- Lower priority (broader matches)
('AMAZON', 29, 20),
('SHELL', 19, 20),
('PAYBYPHONE', 20, 20),
('NORDSTROM', 30, 20);
