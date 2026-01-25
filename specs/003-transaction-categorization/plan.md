# Transaction Categorization - Implementation Plan

## Executive Summary

This feature builds the frontend UI for transaction categorization on top of the **existing backend infrastructure**. The backend already implements:
- Categorization engine with priority-based pattern matching
- Review queue API endpoints
- Rule CRUD operations
- Batch categorization with rule creation

The implementation focuses on three React components and integrating them with the existing navigation and API client.

## Architecture Overview

### Component Hierarchy

```
App.tsx
├── Navigation
│   └── ReviewBadge (shows uncategorized count)
├── Pages
│   ├── Dashboard (existing placeholder)
│   ├── Transactions (existing placeholder)
│   ├── ReviewQueue (NEW)
│   │   ├── ReviewList
│   │   │   └── ReviewItem (category dropdown + save/create rule)
│   │   │       └── RuleCreationForm (inline, expandable)
│   │   └── EmptyState
│   └── Settings
│       └── RulesManager (NEW)
│           ├── RulesTable
│           │   └── RuleRow (edit/delete/toggle)
│           └── RuleCreateModal
└── Shared
    ├── CategoryDropdown (hierarchical select)
    ├── Toast (success/error feedback)
    └── ConfirmDialog (delete confirmations)
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Client    │────▶│   React Query   │────▶│   Components    │
│   (api.ts)      │◀────│   (Cache)       │◀────│   (UI)          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │ Invalidation on mutations
        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Lambda)                          │
│  /transactions/review  /rules  /categories  /transactions/{id}  │
└─────────────────────────────────────────────────────────────────┘
```

### State Management

Use **React Query** (TanStack Query) for server state:
- Automatic caching of review queue, rules, and categories
- Optimistic updates for better UX
- Cache invalidation after mutations

Local component state for:
- Form inputs (pattern, priority, selected category)
- UI state (expanded rows, modals open/closed)
- Filter/search text

## Technology Decisions

### Already Decided (from existing codebase)
- **React 18 + TypeScript** - Main framework
- **Tailwind CSS + shadcn/ui** - Styling and components
- **Vite** - Build tool

### New Dependencies Needed
| Dependency | Purpose | Rationale |
|------------|---------|-----------|
| `@tanstack/react-query` | Server state management | Caching, optimistic updates, automatic refetching |
| `@radix-ui/react-select` | Accessible dropdown | Required for hierarchical category selector (via shadcn) |
| `@radix-ui/react-dialog` | Modal dialogs | Rule creation, confirmations (via shadcn) |
| `@radix-ui/react-switch` | Toggle switch | Active/inactive rule toggle (via shadcn) |
| `sonner` | Toast notifications | Lightweight, beautiful toasts for feedback |

### Component Approach

Extend existing shadcn/ui components:
- `Select` with grouped options for category hierarchy
- `Dialog` for confirmations and forms
- `Switch` for active toggles
- `Table` for rules list
- `Badge` for review count

## Implementation Phases

### Phase 1: Foundation & Category Dropdown

**Goal**: Create reusable CategoryDropdown and set up React Query

**Components**:
1. Install and configure React Query provider
2. Create API hooks (`useCategories`, `useReviewQueue`, `useRules`)
3. Build `CategoryDropdown` component with hierarchy support
4. Add shadcn/ui components: Select, Dialog, Switch

**API Integration**:
- `GET /categories` → `useCategories()` hook
- Categories cached for session (rarely change)

**Deliverables**:
- [ ] React Query configured in App.tsx
- [ ] CategoryDropdown renders hierarchical options
- [ ] API hooks with proper types

### Phase 2: Review Queue UI

**Goal**: Users can view and categorize uncategorized transactions

**Components**:
1. `ReviewQueue` page with list of items
2. `ReviewItem` with date, description, amount, account
3. Category dropdown per item
4. "Save" button for simple categorization
5. Empty state when queue is clear

**API Integration**:
- `GET /transactions/review` → List items
- `PATCH /transactions/{id}` → Save category
- Invalidate review queue cache on save

**Deliverables**:
- [ ] Review queue page accessible from navigation
- [ ] Transactions display with all required fields
- [ ] Save button updates transaction and removes from queue
- [ ] Badge shows current count

### Phase 3: Rule Creation from Review

**Goal**: Users can create rules while categorizing

**Components**:
1. "Create Rule" button (appears when category selected)
2. Inline `RuleCreationForm` that expands below the item
3. Pattern field pre-filled with description
4. Priority field with default value (10)
5. Submit creates rule + categorizes transaction

**API Integration**:
- `POST /transactions/review/batch` with `create_rule: true`
- OR separate calls: `POST /rules` then `PATCH /transactions/{id}`
- Invalidate both review queue and rules cache

**Deliverables**:
- [ ] Create Rule expands inline form
- [ ] Pattern editable, pre-filled with description
- [ ] Save creates rule and categorizes transaction
- [ ] Validation prevents empty patterns

### Phase 4: Rules Management Page

**Goal**: Users can view, edit, and delete rules

**Components**:
1. `RulesManager` page in Settings
2. `RulesTable` with columns: priority, pattern, category, active, actions
3. Inline edit mode or edit modal
4. Delete with confirmation
5. Active/inactive toggle
6. "Add Rule" button with creation form

**API Integration**:
- `GET /rules` → List rules
- `POST /rules` → Create
- `PATCH /rules/{id}` → Update
- `DELETE /rules/{id}` → Delete

**Deliverables**:
- [ ] Rules page lists all rules sorted by priority
- [ ] Edit updates pattern, category, priority
- [ ] Delete with confirmation dialog
- [ ] Toggle active/inactive inline
- [ ] Add new rule manually

### Phase 5: Upload Integration & Polish

**Goal**: Upload shows categorization results, overall polish

**Components**:
1. Update upload modal to show results summary
2. Link from results to review queue
3. Toast notifications for all actions
4. Keyboard navigation in review queue
5. Mobile responsive adjustments

**API Integration**:
- Upload response already includes stats
- Parse and display: `new_count`, `categorized_count`, `review_count`

**Deliverables**:
- [ ] Upload shows "X added, Y categorized, Z need review"
- [ ] Button/link to jump to review queue
- [ ] Toast feedback on save, create rule, delete
- [ ] Tab/Enter navigation works in review queue

## File Structure

```
frontend/src/
├── main.tsx
├── App.tsx                          # Add QueryClientProvider
├── api/
│   └── hooks.ts                     # React Query hooks (NEW)
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── select.tsx               # Add grouped select
│   │   ├── dialog.tsx               # Add
│   │   ├── switch.tsx               # Add
│   │   └── table.tsx                # Add
│   ├── CategoryDropdown.tsx         # NEW - hierarchical select
│   ├── ReviewBadge.tsx              # NEW - nav badge
│   └── Toast.tsx                    # NEW - sonner wrapper
├── pages/
│   ├── ReviewQueue.tsx              # NEW
│   │   ├── ReviewList.tsx
│   │   ├── ReviewItem.tsx
│   │   └── RuleCreationForm.tsx
│   └── Settings/
│       └── RulesManager.tsx         # NEW
│           ├── RulesTable.tsx
│           └── RuleCreateModal.tsx
└── types/
    └── index.ts                     # Type definitions
```

## API Types

```typescript
// Matches backend models

interface Category {
  id: number;
  name: string;
  category_type: 'income' | 'expense' | 'transfer';
  parent_id: number | null;
  display_order: number;
}

interface CategorizationRule {
  id: number;
  pattern: string;
  category_id: number;
  category_name?: string;  // Joined from backend
  priority: number;
  is_active: boolean;
  account_filter?: string;
}

interface Transaction {
  id: string;
  account_id: string;
  account_name?: string;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  category_name?: string;
  needs_review: boolean;
}

interface ReviewQueueResponse {
  transactions: Transaction[];
  total_count: number;
}

interface UploadResponse {
  new_count: number;
  duplicate_count: number;
  categorized_count: number;
  review_count: number;
}
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Category dropdown performance with many categories | Virtual scrolling if > 100 categories; current seed has 34 |
| Review queue with hundreds of items | Pagination via API (already supports limit/offset) |
| Optimistic updates causing stale data | React Query handles this; ensure proper cache invalidation |
| Mobile usability | Test on mobile; use responsive Tailwind classes |
| User creates duplicate rules | Backend allows it; consider frontend warning if pattern exists |

## Testing Strategy

### Unit Tests
- CategoryDropdown renders hierarchy correctly
- ReviewItem handles save and create rule flows
- RulesTable sorts by priority

### Integration Tests
- Upload → Review Queue flow
- Create rule from review → appears in rules list
- Delete rule → confirm dialog → removed from list

### Manual Testing Checklist
- [ ] Upload CSV, verify counts
- [ ] Categorize transaction, verify removed from queue
- [ ] Create rule, verify rule appears in rules page
- [ ] Edit rule, verify change persists
- [ ] Delete rule, verify removed
- [ ] Toggle rule inactive, upload new CSV, verify rule not applied

## Definition of Done

- [ ] All Phase 1-5 deliverables complete
- [ ] Review queue shows badge with accurate count
- [ ] User can categorize and create rules from review queue
- [ ] Rules page shows all rules with CRUD operations
- [ ] Upload results show categorization summary
- [ ] No TypeScript errors, passes linting
- [ ] Mobile responsive (tested on 375px width)
- [ ] Accessibility: keyboard navigation, screen reader labels
