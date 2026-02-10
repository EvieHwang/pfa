-- Burn Rate Database Schema

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card')),
    csv_format TEXT NOT NULL CHECK (csv_format IN ('credit_card_boa', 'checking_savings_boa')),
    include_in_burn_rate BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    burn_rate_group TEXT NOT NULL CHECK (burn_rate_group IN ('food', 'discretionary', 'recurring', 'explosion', 'excluded')),
    parent_id INTEGER REFERENCES categories(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    needs_review BOOLEAN NOT NULL DEFAULT 1,
    is_recurring BOOLEAN NOT NULL DEFAULT 0,
    is_explosion BOOLEAN NOT NULL DEFAULT 0,
    reference_number TEXT,
    dedup_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_transactions_dedup ON transactions(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions(needs_review);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

-- Categorization rules table
CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    priority INTEGER NOT NULL DEFAULT 100,
    account_filter INTEGER REFERENCES accounts(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);

-- Sentiment feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    burn_rate_group TEXT NOT NULL CHECK (burn_rate_group IN ('food', 'discretionary')),
    feedback_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('good', 'bad')),
    burn_rate_at_feedback DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Burn rate snapshots table
CREATE TABLE IF NOT EXISTS burn_rate_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computed_at DATETIME NOT NULL,
    burn_rate_group TEXT NOT NULL CHECK (burn_rate_group IN ('food', 'discretionary')),
    window_days INTEGER NOT NULL,
    daily_burn_rate DECIMAL(10, 2) NOT NULL,
    target_rate DECIMAL(10, 2) NOT NULL,
    deviation DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_computed ON burn_rate_snapshots(computed_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_group ON burn_rate_snapshots(burn_rate_group);

-- Targets table (stores learned targets)
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    burn_rate_group TEXT NOT NULL UNIQUE CHECK (burn_rate_group IN ('food', 'discretionary')),
    daily_target DECIMAL(10, 2) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed accounts
INSERT OR IGNORE INTO accounts (id, name, type, csv_format, include_in_burn_rate) VALUES
    (1, 'Checking', 'checking', 'checking_savings_boa', 1),
    (2, 'Savings 1', 'savings', 'checking_savings_boa', 1),
    (3, 'Savings 2', 'savings', 'checking_savings_boa', 1),
    (4, 'Credit Card', 'credit_card', 'credit_card_boa', 1);

-- Seed categories (5 base categories)
INSERT OR IGNORE INTO categories (id, name, burn_rate_group, parent_id) VALUES
    (1, 'Food', 'food', NULL),
    (2, 'Discretionary', 'discretionary', NULL),
    (3, 'Recurring', 'recurring', NULL),
    (4, 'Explosion', 'explosion', NULL),
    (5, 'Excluded', 'excluded', NULL);

-- Seed default targets
INSERT OR IGNORE INTO targets (burn_rate_group, daily_target) VALUES
    ('food', 30.00),
    ('discretionary', 20.00);
