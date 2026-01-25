# Transaction Categorization Feature Specification

## Overview

This feature provides a semi-automated workflow for categorizing financial transactions. New transactions are automatically categorized when they match predefined text patterns, while unmatched transactions are flagged for manual review. The system learns from manual categorizations by allowing users to create new rules on the fly.

### Current State

The backend infrastructure for categorization is **already implemented**:
- Database schema with `categories`, `categorization_rules`, and `transactions` tables
- Auto-categorization engine (`categorization.py`) with priority-based pattern matching
- API endpoints for rules CRUD, review queue, and batch categorization
- 34 seed categories and 21 seed rules

**What's needed**: Frontend UI components to expose this functionality to users.

## User Stories

### US-1: View Upload Results (P1)

**As a** user uploading transactions
**I want to** see how many transactions were auto-categorized vs. need review
**So that** I understand what work remains after each upload

**Acceptance Criteria:**
- [ ] After CSV upload completes, display summary: "X added, Y auto-categorized, Z need review"
- [ ] If Z > 0, show a prominent link/button to the review queue
- [ ] Display is shown in an upload results modal or toast notification
- [ ] Summary persists until dismissed so user can act on it

### US-2: Access Review Queue (P1)

**As a** user
**I want to** see a badge showing how many transactions need review
**So that** I know when there's pending categorization work

**Acceptance Criteria:**
- [ ] Navigation shows "Review (N)" where N is the count of uncategorized transactions
- [ ] Badge is visible from any page in the application
- [ ] Count updates after uploads and after categorizing transactions
- [ ] Badge is hidden or shows "Review" with no number when N = 0

### US-3: Review Uncategorized Transactions (P1)

**As a** user
**I want to** see a list of all uncategorized transactions
**So that** I can decide how to categorize each one

**Acceptance Criteria:**
- [ ] Review queue displays: date, description, amount, account name
- [ ] Transactions are sorted by date (newest first) by default
- [ ] Each row has a category dropdown populated with all active categories
- [ ] Hierarchical categories display with indentation (e.g., "  └ Groceries" under "Food & Dining")
- [ ] User can search/filter within the review queue
- [ ] Empty state shown when no transactions need review

### US-4: Simple Categorization (P1)

**As a** user reviewing a transaction
**I want to** assign a category and save
**So that** the transaction is categorized without creating a rule

**Acceptance Criteria:**
- [ ] Select category from dropdown, click "Save" button
- [ ] Transaction is updated with the category
- [ ] Transaction is removed from the review queue immediately
- [ ] Review count badge updates
- [ ] Success feedback shown briefly (toast or row highlight)

### US-5: Create Rule While Categorizing (P1)

**As a** user reviewing a transaction
**I want to** create a categorization rule while assigning a category
**So that** similar future transactions are auto-categorized

**Acceptance Criteria:**
- [ ] "Create Rule" button appears next to "Save" when category is selected
- [ ] Clicking "Create Rule" expands an inline form with:
  - Pattern field pre-filled with transaction description
  - Editable pattern (user can simplify, e.g., remove reference numbers)
  - Priority field with sensible default (10)
  - Selected category (read-only, inherited from dropdown)
- [ ] Submitting creates the rule AND categorizes the current transaction
- [ ] Transaction removed from queue, rule visible in rules list
- [ ] Validation: pattern cannot be empty

### US-6: View Rules List (P2)

**As a** user
**I want to** see all my categorization rules
**So that** I can understand and manage my auto-categorization setup

**Acceptance Criteria:**
- [ ] Rules page shows table: pattern, category, priority, status (active/inactive)
- [ ] Sorted by priority (lowest number first = highest priority)
- [ ] Category names shown (not IDs)
- [ ] Active/inactive status is clearly indicated (toggle or badge)
- [ ] Search/filter by pattern text

### US-7: Edit Rule (P2)

**As a** user
**I want to** modify an existing rule's pattern, category, or priority
**So that** I can refine my categorization logic

**Acceptance Criteria:**
- [ ] Click row or edit button to open edit mode (inline or modal)
- [ ] Can modify: pattern, category, priority, active status
- [ ] Save updates the rule immediately
- [ ] Cancel discards changes
- [ ] Validation: pattern cannot be empty, priority must be positive integer

### US-8: Delete Rule (P2)

**As a** user
**I want to** delete a rule I no longer need
**So that** it stops affecting future categorizations

**Acceptance Criteria:**
- [ ] Delete button/icon on each rule row
- [ ] Confirmation dialog: "Delete rule for pattern 'X'? This won't affect already-categorized transactions."
- [ ] After deletion, rule is removed from list
- [ ] Existing transactions remain unchanged (no retroactive effect)

### US-9: Toggle Rule Active Status (P2)

**As a** user
**I want to** disable a rule without deleting it
**So that** I can temporarily stop it from matching without losing the configuration

**Acceptance Criteria:**
- [ ] Toggle switch or checkbox for active/inactive
- [ ] Inactive rules are visually dimmed
- [ ] Inactive rules are not applied during upload categorization
- [ ] State change is immediate (no separate save)

### US-10: Create Rule Manually (P3)

**As a** user
**I want to** create a new rule from the rules management page
**So that** I can proactively set up categorization without waiting for uploads

**Acceptance Criteria:**
- [ ] "Add Rule" button opens creation form
- [ ] Fields: pattern (required), category (required dropdown), priority (default 10)
- [ ] Save creates the rule and adds to list
- [ ] New rule applies to future uploads only

### US-11: View Categories (P3)

**As a** user
**I want to** see all available categories
**So that** I understand my categorization options

**Acceptance Criteria:**
- [ ] Categories page shows hierarchical list
- [ ] Parent categories are expandable/collapsible
- [ ] Shows category type (Income/Expense/Transfer)
- [ ] Shows count of transactions per category (optional)

## Functional Requirements

### FR-1: Pattern Matching

- **FR-1.1**: Patterns use case-insensitive substring matching
- **FR-1.2**: If pattern "ELECTRIC" exists, it matches "PUGET SOUND ELECTRIC CO" and "electric bill"
- **FR-1.3**: Rules are evaluated in priority order (lower number = higher priority)
- **FR-1.4**: First matching rule wins; no subsequent rules are checked
- **FR-1.5**: Only active rules are applied during categorization

### FR-2: Upload Integration

- **FR-2.1**: Every CSV upload triggers auto-categorization before saving
- **FR-2.2**: Categorization happens server-side, not in browser
- **FR-2.3**: Upload response includes: `new_count`, `duplicate_count`, `categorized_count`, `review_count`
- **FR-2.4**: Duplicate transactions (same hash) are skipped, not re-categorized

### FR-3: Review Queue

- **FR-3.1**: Review queue shows transactions where `needs_review = true` AND `category_id IS NULL`
- **FR-3.2**: Categorizing a transaction sets `needs_review = false`
- **FR-3.3**: Queue count is fetched from `GET /transactions/review` endpoint
- **FR-3.4**: Batch operations supported via `POST /transactions/review/batch`

### FR-4: Rule Lifecycle

- **FR-4.1**: New rules do NOT retroactively categorize existing transactions
- **FR-4.2**: Rules only affect newly uploaded transactions
- **FR-4.3**: Deleting a rule does not uncategorize previously matched transactions
- **FR-4.4**: Rules can be created, read, updated, deleted, and toggled active/inactive

### FR-5: Category Hierarchy

- **FR-5.1**: Categories have parent-child relationships (max 2 levels)
- **FR-5.2**: Transactions are assigned to leaf categories (subcategories)
- **FR-5.3**: Dropdowns display hierarchy with visual indentation
- **FR-5.4**: Category type (income/expense/transfer) is inherited from parent or set directly

## Non-Functional Requirements

### NFR-1: Performance

- **NFR-1.1**: Review queue loads in < 2 seconds for up to 500 uncategorized transactions
- **NFR-1.2**: Categorizing a single transaction completes in < 500ms
- **NFR-1.3**: Rules list loads in < 1 second for up to 200 rules

### NFR-2: Usability

- **NFR-2.1**: Category dropdown supports type-ahead search
- **NFR-2.2**: Keyboard navigation works in review queue (Tab, Enter, Arrow keys)
- **NFR-2.3**: Mobile-responsive design for review queue (stacked cards on small screens)
- **NFR-2.4**: Clear visual feedback for all actions (loading states, success/error toasts)

### NFR-3: Data Integrity

- **NFR-3.1**: Rule patterns are trimmed of leading/trailing whitespace before saving
- **NFR-3.2**: Empty patterns are rejected with validation error
- **NFR-3.3**: Concurrent edits to same rule handled gracefully (last write wins)

## UI/UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN NAVIGATION                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐       │
│  │Dashboard │ │Transactions│ │Review (5) 🔴│ │ Settings │       │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  REVIEW QUEUE                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  5 transactions need review                     [Filter ▾]      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Jan 15  UNKNOWN MERCHANT 12345        -$45.00   Checking    ││
│  │         [Select Category ▾]  [Save] [Create Rule]           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Jan 14  SEATTLE CITY UTILITIES        -$120.50  Checking    ││
│  │         [Utilities ▾]  [Save] [Create Rule]                 ││
│  │                                                              ││
│  │  ┌─ Create Rule ──────────────────────────────────────────┐ ││
│  │  │ Pattern: [SEATTLE CITY UTILITIES____________]          │ ││
│  │  │ Priority: [10__]                                       │ ││
│  │  │ Category: Utilities (read-only)                        │ ││
│  │  │ [Cancel] [Save Rule & Categorize]                      │ ││
│  │  └────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SETTINGS > RULES                                                │
│  ─────────────────────────────────────────────────────────────  │
│  [+ Add Rule]                              [Search rules...]    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Priority │ Pattern              │ Category    │ Active    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │    1     │ COLLABERA            │ Salary      │ [✓]  [✎]│  │
│  │    1     │ UNITEDWHOLESALE      │ Mortgage    │ [✓]  [✎]│  │
│  │   10     │ SAFEWAY              │ Groceries   │ [✓]  [✎]│  │
│  │   10     │ T-MOBILE             │ Phone       │ [ ]  [✎]│  │
│  │   20     │ AMAZON               │ Amazon      │ [✓]  [✎]│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Existing Backend API Endpoints

These endpoints are **already implemented** and will be used by the frontend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transactions/upload` | POST | Upload CSV, returns categorization stats |
| `/transactions/review` | GET | List uncategorized transactions |
| `/transactions/review/batch` | POST | Batch categorize + create rules |
| `/transactions/{id}` | PATCH | Update single transaction |
| `/rules` | GET | List all rules |
| `/rules` | POST | Create new rule |
| `/rules/{id}` | PATCH | Update rule |
| `/rules/{id}` | DELETE | Delete rule |
| `/categories` | GET | List all categories |

## Out of Scope

- Retroactive rule application (re-categorizing existing transactions when rules change)
- Regex pattern matching (sticking with simple substring for usability)
- Machine learning / AI-based categorization suggestions
- Bulk import of rules from external sources
- Category creation/editing UI (categories are pre-seeded and managed rarely)

## Success Metrics

1. **Categorization Rate**: % of uploaded transactions auto-categorized should increase over time
2. **Review Queue Clearance**: Users should clear review queue within same session as upload
3. **Rule Growth**: Number of rules should grow as users create rules from reviews
4. **Time to Categorize**: Average time to manually categorize a transaction < 10 seconds
