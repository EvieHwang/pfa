# Burn Rate: Implementation Tasks

## Phase 1 — Backend + Web MVP

### 1.1 Infrastructure Setup
- [ ] Update template.yaml for Burn Rate (rename, update descriptions)
- [ ] Add SQLite database layer with S3 sync
- [ ] Create schema.sql with all tables (accounts, transactions, categories, rules, feedback, snapshots)
- [ ] Seed initial categories (Food subcategories, Discretionary, Recurring, Explosion, Excluded)
- [ ] Seed initial accounts (Checking, Savings 1, Savings 2, Credit Card)

### 1.2 Authentication
- [ ] Implement password-only auth with bcrypt verification
- [ ] JWT token generation (24h expiry)
- [ ] Auth middleware for protected routes
- [ ] POST /auth/login endpoint

### 1.3 CSV Upload & Parsing
- [ ] Credit card CSV parser (Posted Date, Reference Number, Payee, Address, Amount)
- [ ] Checking/savings CSV parser (skip header section, parse Date, Description, Amount, Running Bal.)
- [ ] Auto-detect CSV format from header row
- [ ] Duplicate detection: hash-based (reference number for CC, date+amount+desc for checking)
- [ ] POST /transactions/upload endpoint
- [ ] Return summary: new count, duplicate count, needs_review count

### 1.4 Transaction Management
- [ ] GET /transactions endpoint with filters (date range, account, category, needs_review)
- [ ] PUT /transactions/{id}/categorize endpoint
- [ ] GET /transactions/review-queue endpoint (needs_review=true)
- [ ] Basic transaction model with all fields from spec

### 1.5 Categories API
- [ ] GET /categories endpoint
- [ ] Category model with burn_rate_group field

### 1.6 Web Frontend — Auth
- [ ] Login page with password field
- [ ] JWT storage in localStorage
- [ ] Auth state management
- [ ] Logout functionality

### 1.7 Web Frontend — Upload
- [ ] File picker for CSV
- [ ] Account selector dropdown
- [ ] Upload progress/status display
- [ ] Summary display after upload (new, duplicates, needs review)

### 1.8 Web Frontend — Transactions
- [ ] Transaction list table (Tabulator.js)
- [ ] Date, description, amount, category, account columns
- [ ] Inline category dropdown for assignment
- [ ] Filter controls (date range, account, category)
- [ ] Highlight uncategorized rows

---

## Phase 2 — Categorization Engine

### 2.1 Rules System
- [ ] GET /rules endpoint
- [ ] POST /rules endpoint (create rule)
- [ ] PUT /rules/{id} endpoint (update rule)
- [ ] DELETE /rules/{id} endpoint
- [ ] Rule model: pattern, category_id, priority, account_filter

### 2.2 Auto-Categorization
- [ ] Apply rules on CSV upload (priority order, first match wins)
- [ ] Case-insensitive substring matching
- [ ] Flag unmatched as needs_review=true

### 2.3 Review Queue UI
- [ ] Dedicated review queue view
- [ ] Inline category assignment
- [ ] "Create rule for similar?" prompt after manual categorization
- [ ] Batch mode: group similar descriptions
- [ ] Skip/defer option

### 2.4 Recurring Detection
- [ ] Manual flag as recurring
- [ ] Auto-detect: same payee, similar amount (±10%), monthly cadence
- [ ] is_recurring field on transactions
- [ ] Recurring expenses view (grouped by payee, monthly total)

### 2.5 Rules Management UI
- [ ] Rules list in settings
- [ ] Add/edit/delete rules
- [ ] Priority ordering (drag or manual)
- [ ] Test rule against existing transactions

---

## Phase 3 — Burn Rate + Feedback

### 3.1 Burn Rate Computation
- [ ] Calculate daily burn rate for windows 5-30 days
- [ ] Filter by burn_rate_group (food, discretionary)
- [ ] Exclude recurring, explosion, excluded transactions
- [ ] Cache results in burn_rate_snapshots table

### 3.2 Target Management
- [ ] Store targets per burn_rate_group
- [ ] Initialize with defaults ($30/day food, $20/day discretionary)
- [ ] Target learning: new_target = (0.8 * old) + (0.2 * current_14day) on "good" feedback

### 3.3 Burn Rate API
- [ ] GET /burn-rate endpoint (current curves + arrows for both groups)
- [ ] GET /burn-rate/history endpoint (historical snapshots)
- [ ] Compute arrow direction (slope of resolution curve)
- [ ] Return deviation from target at each window

### 3.4 Sentiment Feedback
- [ ] POST /feedback endpoint
- [ ] Store feedback with burn_rate_at_feedback
- [ ] Trigger target adjustment on "good" feedback
- [ ] GET /status endpoint (last update, pending review count)

### 3.5 Dashboard UI
- [ ] Resolution curve visualization (Chart.js bezier)
- [ ] Two curves: Food and Discretionary
- [ ] Target line overlay
- [ ] Arrow indicators (green/red)
- [ ] Summary cards (current 14-day burn, target, deviation)

### 3.6 Sentiment Feedback UI
- [ ] Post-upload feedback prompt
- [ ] Show 2-week daily burn rate per category
- [ ] "How does this feel?" with Good/Bad buttons
- [ ] Optional — can skip

### 3.7 Explosion Handling
- [ ] Mark transaction as "explosion" (one-off large purchase)
- [ ] Exclude from burn rate calculation
- [ ] UI to flag/unflag explosions

---

## Phase 4 — iOS App + Widget

### 4.1 API Preparation
- [ ] Ensure /burn-rate returns iOS-friendly format
- [ ] Ensure /categories returns iOS-friendly format
- [ ] Ensure /status returns last_updated timestamp
- [ ] API key or JWT auth for iOS client

### 4.2 iOS App (SwiftUI) — Built in Xcode
- [ ] Home screen: two resolution curves stacked
- [ ] Arrows and color indicators
- [ ] Last updated timestamp
- [ ] Pull to refresh
- [ ] Curve detail view (tap to expand)
- [ ] Numeric values at 7/14/30 day points
- [ ] Recent transaction list in detail view

### 4.3 WidgetKit Widgets — Built in Xcode
- [ ] Medium widget: two bezier curves, arrows, timestamp
- [ ] Small widget: arrows and status colors only
- [ ] Timeline-based refresh
- [ ] Background refresh every 4-6 hours

---

## Phase 5 — Polish

### 5.1 Recurring Alerts
- [ ] Detect missing expected recurring transactions
- [ ] Alert on dashboard if recurring hasn't appeared

### 5.2 Historical Snapshots
- [ ] Store daily snapshots of burn rate
- [ ] Historical trend visualization
- [ ] Compare current to past periods

### 5.3 Export/Backup
- [ ] Export transactions as CSV
- [ ] Export full database backup
- [ ] Download SQLite file option

### 5.4 Additional Categories
- [ ] Support adding custom categories
- [ ] Category hierarchy (parent_id)
- [ ] Category management UI

### 5.5 UI Polish
- [ ] Loading states
- [ ] Error handling and messages
- [ ] Mobile-responsive web UI (for occasional phone access)
- [ ] Dark mode (already default in placeholder)

---

## Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5
                              ↓
                          Phase 4 (parallel, separate repo)
```

Phase 4 (iOS) can be built in parallel with Phase 5 once Phase 3 API is stable.
