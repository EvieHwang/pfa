# Transaction Categorization Feature - Specification

## Overview

Enhance the existing transaction categorization system with frontend UI for creating rules during review and managing rules in settings. The backend categorization engine is already complete; this spec focuses on the missing frontend functionality.

## Current State Analysis

### Already Implemented

**Backend (Complete):**
- `categorization.py`: Pattern matching engine, batch categorization, rule creation
- `rule_routes.py`: Full CRUD API for categorization rules
- `category_routes.py`: Category management API
- `transaction_routes.py`: Review queue endpoint, batch categorize endpoint
- Auto-categorization applied during CSV upload
- `needs_review` flag on uncategorized transactions

**Frontend (Partial):**
- Review queue modal with category dropdown (simple categorization works)
- Dashboard shows pending review count
- Settings modal with Rules tab (view-only, no CRUD)

### Missing (Scope of This Feature)

1. **Rule Creation from Review Queue**: "Create Rule" button with inline form
2. **Rules Management CRUD**: Create, edit, delete rules in Settings
3. **Pattern Suggestion**: Pre-fill pattern from transaction description

---

## User Stories

### US-1: Create Rule During Review
**As a** user reviewing uncategorized transactions
**I want to** create a categorization rule while categorizing a transaction
**So that** similar future transactions are automatically categorized

**Acceptance Criteria:**
- Each review item has a "Create Rule" checkbox or button
- When enabled, an inline form appears with:
  - Pattern field (pre-filled with suggested pattern from description)
  - Category dropdown (synced with the selected category)
  - Priority input (default: 50)
- Saving applies the category to the transaction AND creates the rule
- Success toast confirms both actions

### US-2: View Rules in Settings
**As a** user
**I want to** see all my categorization rules
**So that** I can understand how transactions are being auto-categorized

**Acceptance Criteria:**
- Rules tab in Settings shows all rules in a list/table
- Each rule displays: pattern, category name, priority, active status
- Rules are sorted by priority (highest first)

### US-3: Edit Existing Rule
**As a** user
**I want to** modify an existing categorization rule
**So that** I can fix mistakes or update patterns

**Acceptance Criteria:**
- Each rule has an Edit button/icon
- Clicking opens an inline edit form or modal
- Can modify: pattern, category, priority, active status
- Save updates the rule; Cancel discards changes

### US-4: Delete Rule
**As a** user
**I want to** delete a categorization rule I no longer need
**So that** it stops affecting future categorizations

**Acceptance Criteria:**
- Each rule has a Delete button/icon
- Confirmation prompt before deletion
- Rule is removed from the list after deletion

### US-5: Toggle Rule Active Status
**As a** user
**I want to** enable/disable a rule without deleting it
**So that** I can temporarily stop it from matching

**Acceptance Criteria:**
- Each rule has a toggle/checkbox for active status
- Toggling immediately updates the rule
- Inactive rules are visually distinct (grayed out)

### US-6: Create Rule Manually
**As a** user
**I want to** create a new rule from the Settings page
**So that** I can proactively set up categorization patterns

**Acceptance Criteria:**
- "Add Rule" button in Rules tab
- Opens a form with: pattern, category dropdown, priority, active checkbox
- Validation: pattern and category required
- New rule appears in the list after creation

---

## API Contracts

All endpoints already exist. Frontend will use:

| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| List rules | GET | `/api/rules` | Returns `{ items: [...] }` |
| Create rule | POST | `/api/rules` | Body: `{ pattern, category_id, priority?, is_active? }` |
| Update rule | PATCH | `/api/rules/{id}` | Body: partial update |
| Delete rule | DELETE | `/api/rules/{id}` | Returns 204 |
| Batch categorize | POST | `/api/transactions/batch` | Body: `{ updates: [{ id, category_id }] }` |

---

## UI/UX Notes

### Review Queue Enhancement
- Add "Create Rule" checkbox below category dropdown
- When checked, show pattern input (pre-filled) and priority input
- Keep the flow simple: user sees transaction → picks category → optionally creates rule → clicks Save

### Rules Management
- Table view: Pattern | Category | Priority | Active | Actions
- Inline editing preferred over modals (simpler flow)
- Active toggle should be immediate (no save button needed)

### Pattern Suggestion Algorithm
Already exists in `categorization.py:suggest_pattern_from_description()`:
- Extracts meaningful words from description
- Filters out common words (THE, AND, LLC, etc.)
- Returns first meaningful word(s)

---

## Out of Scope

- Regex pattern matching (keep simple substring matching)
- Retroactive rule application (intentionally excluded per feature doc)
- Bulk rule import/export
- Rule testing/preview
