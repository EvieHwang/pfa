# Burn Rate: Implementation Tasks

## Phase 1 — Backend + Web MVP ✅

### 1.1 Infrastructure Setup
- [x] Update template.yaml for Burn Rate (rename, update descriptions)
- [x] Add SQLite database layer with S3 sync
- [x] Create schema.sql with all tables (accounts, transactions, categories, rules, feedback, snapshots)
- [x] Seed initial categories (Food subcategories, Discretionary, Recurring, Explosion, Excluded)
- [x] Seed initial accounts (Checking, Savings 1, Savings 2, Credit Card)

### 1.2 Authentication
- [x] Implement password-only auth with bcrypt verification
- [x] JWT token generation (24h expiry)
- [x] Auth middleware for protected routes
- [x] POST /auth/login endpoint

### 1.3 CSV Upload & Parsing
- [x] Credit card CSV parser (Posted Date, Reference Number, Payee, Address, Amount)
- [x] Checking/savings CSV parser (skip header section, parse Date, Description, Amount, Running Bal.)
- [x] Auto-detect CSV format from header row
- [x] Duplicate detection: hash-based (reference number for CC, date+amount+desc for checking)
- [x] POST /transactions/upload endpoint
- [x] Return summary: new count, duplicate count, needs_review count

### 1.4 Transaction Management
- [x] GET /transactions endpoint with filters (date range, account, category, needs_review)
- [x] PUT /transactions/{id}/categorize endpoint
- [x] GET /transactions/review-queue endpoint (needs_review=true)
- [x] Basic transaction model with all fields from spec

### 1.5 Categories API
- [x] GET /categories endpoint
- [x] Category model with burn_rate_group field

### 1.6 Web Frontend — Auth
- [x] Login page with password field
- [x] JWT storage in localStorage
- [x] Auth state management
- [x] Logout functionality

### 1.7 Web Frontend — Upload
- [x] File picker for CSV
- [x] Account selector dropdown
- [x] Upload progress/status display
- [x] Summary display after upload (new, duplicates, needs review)

### 1.8 Web Frontend — Transactions
- [x] Transaction list table (Tabulator.js)
- [x] Date, description, amount, category, account columns
- [x] Inline category dropdown for assignment
- [x] Filter controls (date range, account, category)
- [x] Highlight uncategorized rows

---

## Phase 2 — Categorization Engine ✅

### 2.1 Rules System
- [x] GET /rules endpoint
- [x] POST /rules endpoint (create rule)
- [x] PUT /rules/{id} endpoint (update rule)
- [x] DELETE /rules/{id} endpoint
- [x] Rule model: pattern, category_id, priority, account_filter

### 2.2 Auto-Categorization
- [x] Apply rules on CSV upload (priority order, first match wins)
- [x] Case-insensitive substring matching
- [x] Flag unmatched as needs_review=true

### 2.3 Review Queue UI
- [x] Dedicated review queue view
- [x] Inline category assignment
- [x] "Create rule for similar?" (auto-creates rule when categorizing)
- [ ] Batch mode: group similar descriptions
- [ ] Skip/defer option

### 2.4 Recurring Detection
- [x] Manual flag as recurring (PATCH /transactions/{id}/recurring)
- [ ] Auto-detect: same payee, similar amount (±10%), monthly cadence
- [x] is_recurring field on transactions
- [ ] Recurring expenses view (grouped by payee, monthly total)

### 2.5 Rules Management UI
- [x] Rules list in settings
- [x] Add/edit/delete rules
- [ ] Priority ordering (drag or manual)
- [ ] Test rule against existing transactions

---

## Phase 3 — Burn Rate + Feedback ✅

### 3.1 Burn Rate Computation
- [x] Calculate daily burn rate for windows 5-30 days
- [x] Filter by burn_rate_group (food, discretionary)
- [x] Exclude recurring, explosion, excluded transactions
- [ ] Cache results in burn_rate_snapshots table

### 3.2 Target Management
- [x] Store targets per burn_rate_group
- [x] Initialize with defaults ($30/day food, $20/day discretionary)
- [x] Target learning: new_target = (0.8 * old) + (0.2 * current_14day) on "good" feedback

### 3.3 Burn Rate API
- [x] GET /burn-rate endpoint (current curves + arrows for both groups)
- [ ] GET /burn-rate/history endpoint (historical snapshots)
- [x] Compute arrow direction (slope of resolution curve)
- [x] Return deviation from target at each window

### 3.4 Sentiment Feedback
- [x] POST /feedback endpoint
- [x] Store feedback with burn_rate_at_feedback
- [x] Trigger target adjustment on "good" feedback
- [x] GET /status endpoint (last update, pending review count)

### 3.5 Dashboard UI
- [x] Resolution curve visualization (Chart.js bezier)
- [x] Two curves: Food and Discretionary
- [x] Target line overlay
- [x] Arrow indicators (improving/worsening/stable)
- [x] Summary cards (current 14-day burn, target)

### 3.6 Sentiment Feedback UI
- [x] Feedback buttons on dashboard cards
- [x] Show 14-day daily burn rate per category
- [x] "Feels Good" / "Too High" buttons
- [x] Optional — can skip

### 3.7 Explosion Handling
- [x] Mark transaction as "explosion" (one-off large purchase)
- [x] Exclude from burn rate calculation (is_explosion field exists)
- [x] UI to flag/unflag explosions

---

## Phase 4 — iOS App + Widget (Separate Xcode Project)

### 4.1 API Preparation
- [x] /burn-rate returns iOS-friendly format
- [x] /categories returns iOS-friendly format
- [x] /status returns last_updated timestamp
- [ ] API key auth for iOS client

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
- [x] Support adding custom categories
- [x] Category hierarchy (parent_id)
- [x] Category management UI

### 5.5 UI Polish
- [x] Loading states
- [x] Error handling and messages (toasts)
- [ ] Mobile-responsive web UI (for occasional phone access)
- [x] Dark mode (default theme)

---

## Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5
                              ↓
                          Phase 4 (parallel, separate repo)
```

Phase 4 (iOS) can be built in parallel with Phase 5 once Phase 3 API is stable.
