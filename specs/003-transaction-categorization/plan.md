# Transaction Categorization Feature - Implementation Plan

## Architecture Overview

This feature is **frontend-only** - the backend is complete. All work involves enhancing the vanilla JavaScript frontend to utilize existing API endpoints.

### File Structure

```
frontend/
├── js/
│   ├── api.js          # Add rules API methods (exists, needs additions)
│   ├── dashboard.js    # Enhance review modal with rule creation
│   └── app.js          # Enhance settings modal with rules CRUD
├── css/
│   └── styles.css      # Add styles for new UI elements
└── index.html          # Already has rules-tab structure
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REVIEW QUEUE FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. User clicks Review Card                                     │
│          ↓                                                       │
│   2. GET /api/transactions?needs_review=true                     │
│          ↓                                                       │
│   3. Display transactions with:                                  │
│      • Category dropdown                                         │
│      • [NEW] "Create Rule" checkbox                              │
│      • [NEW] Pattern input (when checked)                        │
│          ↓                                                       │
│   4. User categorizes + optionally enables rule creation         │
│          ↓                                                       │
│   5. On Save:                                                    │
│      • POST /api/transactions/batch (categorize)                 │
│      • [NEW] POST /api/rules (for each rule to create)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    RULES MANAGEMENT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. User opens Settings → Rules tab                             │
│          ↓                                                       │
│   2. GET /api/rules + GET /api/categories                        │
│          ↓                                                       │
│   3. Display rules table with inline actions:                    │
│      • Active toggle (PATCH on change)                           │
│      • Edit button → inline form                                 │
│      • Delete button → confirm → DELETE                          │
│      • [NEW] Add Rule button → form                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: API Client Extensions
**Scope:** Add missing API methods to `api.js`
**Effort:** Small

- Add `API.rules.create(data)`
- Add `API.rules.update(id, data)`
- Add `API.rules.delete(id)`
- Add `API.rules.list()` (if not present)

### Phase 2: Review Queue Enhancement
**Scope:** Add rule creation to review modal
**Effort:** Medium

- Add "Create Rule" checkbox per review item
- Show/hide pattern input based on checkbox
- Implement pattern suggestion (call backend or use simple frontend logic)
- Update `saveReviews()` to create rules for checked items
- Add success feedback for rules created

### Phase 3: Rules Management - View & Toggle
**Scope:** Enhanced rules display with active toggle
**Effort:** Medium

- Refactor `loadRules()` in app.js to render a table
- Add active/inactive toggle with immediate PATCH
- Visual distinction for inactive rules
- Loading state while fetching

### Phase 4: Rules Management - Create & Edit
**Scope:** Full CRUD for rules
**Effort:** Medium

- Add "Add Rule" button and form
- Inline edit mode for existing rules
- Form validation (pattern + category required)
- Save/Cancel actions

### Phase 5: Rules Management - Delete
**Scope:** Delete with confirmation
**Effort:** Small

- Add delete button per rule
- Confirmation dialog before deletion
- Remove from list on success

---

## Deployment Strategy

Each phase can be deployed independently. Recommended approach:

1. **Single PR per phase** - easier to review and rollback
2. **No backend changes needed** - pure frontend deployment
3. **Test on live site** after each merge using test transactions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API contract mismatch | Low | Medium | Test each API call manually first |
| CSS conflicts | Low | Low | Scope new styles carefully |
| Batch save complexity | Medium | Medium | Handle partial failures gracefully |

---

## Dependencies

- No new npm packages required (vanilla JS)
- No backend changes required
- No infrastructure changes required

---

## Success Metrics

- Users can create rules during review (track rule creation count)
- Review queue items decrease over time as rules accumulate
- No increase in error rates from API calls
