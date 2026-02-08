# Burn Rate: Personal Finance Awareness App

## Product Specification

**Version:** 2.0
**Date:** February 8, 2026
**Author:** Evie Hwang + Claude

---

## 1. Vision

Burn Rate cultivates intuitive awareness of spending patterns rather than enforcing rigid budgets. The core insight: track how spending *resolves toward equilibrium* over time, not whether you're "over budget."

The system learns your personal comfort zone through sentiment feedback. Your "target" isn't a number you set — it emerges from your responses over time.

### Core Principles

1. **No guilt, no shock** — Attune to trends, don't punish decisions
2. **Opinion-based targeting** — Your sentiment feedback shapes the targets, not the other way around
3. **Sustainability over restriction** — Optimize for spending levels that feel right
4. **Minimal friction** — Glanceable status on your phone, detailed work on your computer

---

## 2. User Profile

- Single user (Evie)
- Bank of America accounts: Checking, Savings 1, Savings 2, Credit Card
- One shared account with spouse (transfers only — excluded from burn rate)
- Comfortable income; wants awareness, not strict budgeting
- Wants to trust instincts while having data to validate them

---

## 3. System Architecture

### 3.1 Platform Overview

The system has three components:

Desktop (web browser): Where you do all the work — upload CSVs, review/categorize transactions, provide sentiment feedback, view full dashboard.

AWS Backend: Processes CSVs, runs categorization rules, computes burn rate curves, serves API endpoints for both web UI and iOS app.

iOS App + Widget: Read-only. Pulls computed burn rate data from the API. Displays resolution curves. Widget shows at-a-glance status on your home screen. Updates whenever you've processed new data on your computer.

### 3.2 Technology Stack

- Backend: AWS SAM (API Gateway + Lambda + S3)
- Database: SQLite on S3
- Web frontend: S3 static hosting + CloudFront, vanilla JS
- iOS app: SwiftUI (developed in Xcode with Claude Agent)
- iOS widget: WidgetKit
- Auth: Password-only with JWT (web), API key or JWT (iOS)

### 3.3 API Design

| Endpoint | Method | Purpose | Consumer |
|----------|--------|---------|----------|
| /auth/login | POST | Authenticate, return JWT | Web |
| /transactions/upload | POST | Upload CSV file | Web |
| /transactions | GET | List transactions (filterable) | Web |
| /transactions/{id}/categorize | PUT | Assign category | Web |
| /transactions/review-queue | GET | Uncategorized transactions | Web |
| /rules | GET/POST/PUT/DELETE | Manage auto-categorization rules | Web |
| /feedback | POST | Submit sentiment feedback | Web |
| /burn-rate | GET | Current burn rate curves + arrows | iOS + Web |
| /burn-rate/history | GET | Historical curve snapshots | Web |
| /categories | GET | List categories | iOS + Web |
| /status | GET | Last update timestamp, pending review count | iOS |

---

## 4. Data Model

### 4.1 Accounts

- id (INTEGER PK)
- name (TEXT): "Checking", "Savings 1", "Savings 2", "Credit Card"
- type (TEXT): "checking", "savings", "credit_card"
- csv_format (TEXT): "credit_card_boa" or "checking_savings_boa"
- include_in_burn_rate (BOOLEAN): False for shared/transfer-only accounts

### 4.2 Transactions

- id (INTEGER PK)
- account_id (INTEGER FK)
- date (DATE)
- description (TEXT): Raw description from CSV
- amount (DECIMAL): Negative = expense, positive = income/credit
- category_id (INTEGER FK): Nullable until categorized
- needs_review (BOOLEAN): True if uncategorized
- is_recurring (BOOLEAN): True for fixed/recurring expenses
- is_explosion (BOOLEAN): True for excluded one-off large purchases
- reference_number (TEXT): For credit card duplicate detection
- dedup_hash (TEXT): Hash for checking/savings duplicate detection
- created_at (DATETIME)

### 4.3 Categories

- id (INTEGER PK)
- name (TEXT): e.g., "Food", "Discretionary"
- burn_rate_group (TEXT): "food", "discretionary", "recurring", "explosion", "excluded"
- parent_id (INTEGER FK): Optional hierarchy for future use

Initial burn_rate_group values:
- food — Restaurants, groceries, coffee, takeout, delivery
- discretionary — Everything else that's not recurring/explosion/excluded
- recurring — Bills, subscriptions, fixed costs (segmented off, not in burn rate)
- explosion — One-off large purchases explicitly excluded from burn rate
- excluded — Transfers, income, shared account activity

### 4.4 Categorization Rules

- id (INTEGER PK)
- pattern (TEXT): Case-insensitive substring match
- category_id (INTEGER FK)
- priority (INTEGER): Lower = higher priority, first match wins
- account_filter (INTEGER FK): Optional

### 4.5 Sentiment Feedback

- id (INTEGER PK)
- burn_rate_group (TEXT): "food" or "discretionary"
- feedback_date (DATE)
- period_end_date (DATE)
- sentiment (TEXT): "good" or "bad"
- burn_rate_at_feedback (DECIMAL): Computed daily burn rate at time of feedback
- created_at (DATETIME)

### 4.6 Burn Rate Snapshots

Computed and cached each time new data is processed.

- id (INTEGER PK)
- computed_at (DATETIME)
- burn_rate_group (TEXT): "food" or "discretionary"
- window_days (INTEGER): 5, 6, 7, ... 30
- daily_burn_rate (DECIMAL): Average daily spend for this window
- target_rate (DECIMAL): Current learned target
- deviation (DECIMAL): burn_rate - target

---

## 5. Core Features

### 5.1 CSV Upload & Processing

Supported formats:

Format A: Credit Card (Bank of America)
- Columns: Posted Date, Reference Number, Payee, Address, Amount
- Date format: MM/DD/YYYY
- Amount: Negative for purchases, positive for payments/credits
- Duplicate detection: Hash of Posted Date + Reference Number

Format B: Checking/Savings (Bank of America)
- Header section with summary rows must be skipped
- Transaction columns: Date, Description, Amount, Running Bal.
- Amounts may include comma thousands separators
- Duplicate detection: Hash of Date + Amount + Description (first 50 chars)

Upload workflow:
1. User selects CSV file and specifies source account
2. System auto-detects CSV format from header row
3. Parse and validate
4. Duplicate detection — report count of duplicates skipped
5. Auto-categorization rules applied to new transactions
6. Remaining uncategorized flagged needs_review = true
7. Summary displayed: X new, Y duplicates, Z need review
8. Burn rate curves recomputed
9. iOS app data refreshed on next poll

### 5.2 Transaction Categorization

Auto-categorization: Rules applied in priority order (first match wins). Pattern = case-insensitive substring match on description/payee. When manually categorizing, prompt: "Create a rule for similar transactions?"

Review queue: Shows all needs_review transactions. Inline category assignment via dropdown. Batch mode for similar descriptions. Skip option to defer.

Recurring expense detection: Flag as recurring manually or auto-detect (same payee, similar amount, monthly cadence). Recurring transactions segmented into own view, excluded from burn rate.

### 5.3 The Resolution Curve

The core innovation. Computes burn rate for every window from 5 to 30 days (26 data points) rendered as a smooth curve.

Calculation: daily_burn_rate(N) = sum(qualifying_expenses in last N days) / N

Where qualifying = transactions in the relevant burn_rate_group, excluding recurring, explosions, excluded.

Target line: Initialized manually (e.g., $30/day food, $20/day discretionary). Adjusted by weighted moving average when user gives "good" feedback.

Target learning:
- "Good" feedback: new_target = (0.8 * old_target) + (0.2 * current_14day_burn)
- "Bad" feedback: no adjustment (confirms target is correct)

Curve interpretation (X = time horizon 5-30d, Y = deviation from target):
- Wiggly left, flat right = healthy
- Flat and elevated = consistent overspending
- Rising left to right = recent improvement
- Falling left to right = recent spike not yet resolved

The Arrow: slope of the resolution curve. Green = converging toward target. Red = diverging.

### 5.4 Sentiment Feedback

Presented on web interface after upload/review. Per-category (Food and Discretionary independently). Shows 2-week daily burn rate and asks "How does this feel?" with Good/Bad buttons. Optional — can skip.

### 5.5 Recurring Expenses View

Separate section showing all recurring transactions grouped by payee, monthly total, last occurrence, alert if expected recurring hasn't appeared.

---

## 6. iOS App (SwiftUI) — Phase 4

Read-only companion. No data entry.

Home screen: Two resolution curves stacked (Food + Discretionary), arrows, last updated timestamp, pull to refresh.

Curve detail (tap): Expanded curve with labeled axes, numeric values at 7/14/30 day points, recent transaction list.

WidgetKit medium widget: Two bezier curves with center target line, arrows + color per category, timestamp.

WidgetKit small widget: Just arrows and status colors.

Widget refresh: Timeline-based, updates when app detects new API data, fallback periodic refresh every 4-6 hours.

---

## 7. Web Interface (Desktop)

Auth: Password-only, JWT 24h expiry, bcrypt hash in env var.

Pages: Dashboard (curves + summary cards), Upload (file picker + account selector + feedback prompt), Review Queue, Transactions (sortable/filterable table), Rules (CRUD), Recurring expenses view.

Tech: S3 + CloudFront static hosting, vanilla JS, Chart.js for curves, Tabulator.js for tables.

---

## 8. Implementation Phases

Phase 1 — Backend + Web MVP: AWS SAM infra, auth, DB schema, CSV upload/parsing, duplicate detection, transaction list, basic category assignment.

Phase 2 — Categorization Engine: Auto-categorization rules, review queue UI, rule CRUD, batch categorization, recurring detection.

Phase 3 — Burn Rate + Feedback: Burn rate computation (5-30 day windows), target init + learning, resolution curve viz, arrow calculation, sentiment feedback, dashboard.

Phase 4 — iOS App + Widget: SwiftUI app, API client, curve rendering, WidgetKit widgets, refresh logic. (Built separately in Xcode with Claude Agent.)

Phase 5 — Polish: Recurring alerts, historical snapshots, macOS app (future), additional categories, export/backup.
