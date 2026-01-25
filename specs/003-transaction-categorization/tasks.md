# Transaction Categorization - Task Breakdown

## Overview

Total estimated tasks: 28
Phases: 5
Critical path: Phase 1 → Phase 2 → Phase 3 (sequential)
Parallelizable: Phase 4 can start after Phase 1; Phase 5 after Phase 3

## Phase 1: Foundation & Category Dropdown

### Task 1.1: Install React Query
**Description**: Add @tanstack/react-query and configure provider
**Files**:
- `package.json` - Add dependency
- `frontend/src/main.tsx` - Wrap app with QueryClientProvider
**Dependencies**: None
**Acceptance**: App renders with QueryClient available

### Task 1.2: Install Additional shadcn/ui Components
**Description**: Add Select, Dialog, Switch, Table components via shadcn CLI
**Commands**:
```bash
npx shadcn@latest add select dialog switch table badge
```
**Files**:
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/switch.tsx`
- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/badge.tsx`
**Dependencies**: None
**Parallelizable with**: Task 1.1

### Task 1.3: Install Toast Library
**Description**: Add sonner for toast notifications
**Files**:
- `package.json` - Add sonner
- `frontend/src/main.tsx` - Add Toaster component
**Dependencies**: None
**Parallelizable with**: Task 1.1, 1.2

### Task 1.4: Create TypeScript Types
**Description**: Define interfaces for API responses
**Files**:
- `frontend/src/types/index.ts` (NEW)
**Types needed**:
- Category, CategorizationRule, Transaction
- ReviewQueueResponse, UploadResponse
- API error types
**Dependencies**: None
**Parallelizable with**: Task 1.1, 1.2, 1.3

### Task 1.5: Create API Hooks
**Description**: React Query hooks for all categorization endpoints
**Files**:
- `frontend/src/api/hooks.ts` (NEW)
**Hooks**:
- `useCategories()` - GET /categories
- `useReviewQueue()` - GET /transactions/review
- `useRules()` - GET /rules
- `useUpdateTransaction()` - PATCH /transactions/{id}
- `useCreateRule()` - POST /rules
- `useUpdateRule()` - PATCH /rules/{id}
- `useDeleteRule()` - DELETE /rules/{id}
- `useBatchCategorize()` - POST /transactions/review/batch
**Dependencies**: Task 1.1 (React Query), Task 1.4 (Types)

### Task 1.6: Create CategoryDropdown Component
**Description**: Hierarchical select with grouped options
**Files**:
- `frontend/src/components/CategoryDropdown.tsx` (NEW)
**Features**:
- Groups by parent category
- Indented child categories
- Search/filter support
- Controlled component (value, onChange)
**Dependencies**: Task 1.2 (Select component), Task 1.5 (useCategories hook)

### Phase 1 Summary
| Task | Can Parallel | Depends On |
|------|--------------|------------|
| 1.1 | Yes | - |
| 1.2 | Yes | - |
| 1.3 | Yes | - |
| 1.4 | Yes | - |
| 1.5 | No | 1.1, 1.4 |
| 1.6 | No | 1.2, 1.5 |

---

## Phase 2: Review Queue UI

### Task 2.1: Create ReviewQueue Page Shell
**Description**: Basic page layout with header and container
**Files**:
- `frontend/src/pages/ReviewQueue.tsx` (NEW)
**Features**:
- Page title "Review Transactions"
- Count display "(X transactions)"
- Container for list
**Dependencies**: Phase 1 complete

### Task 2.2: Create ReviewItem Component
**Description**: Single transaction row with category dropdown
**Files**:
- `frontend/src/pages/ReviewQueue/ReviewItem.tsx` (NEW)
**Features**:
- Display: date, description (truncated), amount, account name
- CategoryDropdown
- Save button (disabled until category selected)
- Visual feedback for amount (red for negative, green for positive)
**Dependencies**: Task 1.6 (CategoryDropdown), Task 2.1

### Task 2.3: Create ReviewList Component
**Description**: List container that maps transactions to ReviewItems
**Files**:
- `frontend/src/pages/ReviewQueue/ReviewList.tsx` (NEW)
**Features**:
- Maps useReviewQueue data to ReviewItem components
- Loading skeleton while fetching
- Empty state component
**Dependencies**: Task 1.5 (useReviewQueue), Task 2.2 (ReviewItem)

### Task 2.4: Implement Save Categorization
**Description**: Wire up save button to update transaction
**Files**:
- Modify `ReviewItem.tsx`
**Features**:
- Call useUpdateTransaction on save
- Optimistic update (remove from list)
- Show toast on success
- Handle error state
**Dependencies**: Task 1.5 (useUpdateTransaction), Task 2.2

### Task 2.5: Create ReviewBadge Component
**Description**: Navigation badge showing review count
**Files**:
- `frontend/src/components/ReviewBadge.tsx` (NEW)
**Features**:
- Polls review count (or uses cached query)
- Displays count in badge
- Hidden when count is 0
- Animates on count change
**Dependencies**: Task 1.5 (useReviewQueue)

### Task 2.6: Add Review Queue to Navigation
**Description**: Add Review link with badge to app navigation
**Files**:
- Modify `frontend/src/App.tsx` or navigation component
**Features**:
- "Review" nav item with ReviewBadge
- Routes to /review
**Dependencies**: Task 2.1 (ReviewQueue page), Task 2.5 (ReviewBadge)

### Phase 2 Summary
| Task | Can Parallel | Depends On |
|------|--------------|------------|
| 2.1 | No | Phase 1 |
| 2.2 | No | 2.1 |
| 2.3 | No | 2.2 |
| 2.4 | No | 2.2 |
| 2.5 | Yes | 1.5 |
| 2.6 | No | 2.1, 2.5 |

---

## Phase 3: Rule Creation from Review

### Task 3.1: Add "Create Rule" Button
**Description**: Button appears when category is selected
**Files**:
- Modify `ReviewItem.tsx`
**Features**:
- Hidden until category selected
- Toggles inline form visibility
- Changes to "Cancel" when form open
**Dependencies**: Phase 2 complete

### Task 3.2: Create RuleCreationForm Component
**Description**: Inline form for creating rules
**Files**:
- `frontend/src/pages/ReviewQueue/RuleCreationForm.tsx` (NEW)
**Features**:
- Pattern input (pre-filled with transaction description)
- Priority input (default 10)
- Category display (read-only, from parent)
- Cancel button (closes form)
- Submit button "Save Rule & Categorize"
**Dependencies**: Task 3.1

### Task 3.3: Implement Rule Creation + Categorization
**Description**: Wire form submission to API
**Files**:
- Modify `RuleCreationForm.tsx`
- Modify `ReviewItem.tsx` (pass handlers)
**Features**:
- Validate pattern not empty
- Call useCreateRule then useUpdateTransaction
- OR use useBatchCategorize for atomic operation
- Invalidate both queries
- Show success toast
- Remove item from queue
**Dependencies**: Task 1.5 (hooks), Task 3.2

### Task 3.4: Pattern Validation
**Description**: Add validation and error display
**Files**:
- Modify `RuleCreationForm.tsx`
**Features**:
- Trim whitespace before validation
- Show error if pattern empty after trim
- Show error if priority < 1
- Disable submit when invalid
**Dependencies**: Task 3.2

### Phase 3 Summary
| Task | Can Parallel | Depends On |
|------|--------------|------------|
| 3.1 | No | Phase 2 |
| 3.2 | No | 3.1 |
| 3.3 | No | 3.2 |
| 3.4 | No | 3.2 |

---

## Phase 4: Rules Management Page

**Note**: Can start after Phase 1 is complete (parallel with Phase 2/3)

### Task 4.1: Create RulesManager Page Shell
**Description**: Settings page for rules management
**Files**:
- `frontend/src/pages/Settings/RulesManager.tsx` (NEW)
**Features**:
- Page title "Categorization Rules"
- "Add Rule" button
- Container for table
**Dependencies**: Phase 1 complete

### Task 4.2: Create RulesTable Component
**Description**: Table displaying all rules
**Files**:
- `frontend/src/pages/Settings/RulesTable.tsx` (NEW)
**Features**:
- Columns: Priority, Pattern, Category, Active, Actions
- Sorted by priority (ascending)
- Uses shadcn Table component
- Loading state
**Dependencies**: Task 1.2 (Table), Task 1.5 (useRules), Task 4.1

### Task 4.3: Add Active/Inactive Toggle
**Description**: Toggle switch in each row
**Files**:
- Modify `RulesTable.tsx`
**Features**:
- Switch component per row
- On toggle, call useUpdateRule
- Optimistic update
- Visual dimming for inactive rows
**Dependencies**: Task 1.2 (Switch), Task 4.2

### Task 4.4: Add Edit Functionality
**Description**: Inline edit or modal for rule editing
**Files**:
- Modify `RulesTable.tsx` or create `RuleEditModal.tsx`
**Features**:
- Edit button opens edit mode
- Editable fields: pattern, category, priority
- Save/Cancel buttons
- Validation same as creation
**Dependencies**: Task 4.2, Task 1.6 (CategoryDropdown)

### Task 4.5: Add Delete Functionality
**Description**: Delete with confirmation
**Files**:
- Modify `RulesTable.tsx`
- Create confirmation dialog (or use Dialog component)
**Features**:
- Delete button opens confirmation
- Confirm dialog shows pattern
- On confirm, call useDeleteRule
- Remove from list
- Toast on success
**Dependencies**: Task 1.2 (Dialog), Task 4.2

### Task 4.6: Create RuleCreateModal
**Description**: Modal for creating new rules manually
**Files**:
- `frontend/src/pages/Settings/RuleCreateModal.tsx` (NEW)
**Features**:
- Opens from "Add Rule" button
- Fields: pattern, category, priority
- Same validation as inline form
- On save, adds to list
**Dependencies**: Task 1.2 (Dialog), Task 1.6 (CategoryDropdown), Task 4.1

### Task 4.7: Add Rules to Settings Navigation
**Description**: Link from Settings to Rules page
**Files**:
- Modify settings navigation/routing
**Features**:
- Settings → Rules link
- Route: /settings/rules
**Dependencies**: Task 4.1

### Phase 4 Summary
| Task | Can Parallel | Depends On |
|------|--------------|------------|
| 4.1 | Yes | Phase 1 |
| 4.2 | No | 4.1 |
| 4.3 | No | 4.2 |
| 4.4 | No | 4.2 |
| 4.5 | No | 4.2 |
| 4.6 | No | 4.1 |
| 4.7 | No | 4.1 |

---

## Phase 5: Upload Integration & Polish

### Task 5.1: Update Upload Results Display
**Description**: Show categorization stats after upload
**Files**:
- Modify upload modal/component
**Features**:
- Parse upload response stats
- Display: "X added, Y auto-categorized, Z need review"
- Conditional styling (green for good, yellow for review needed)
**Dependencies**: Existing upload component

### Task 5.2: Add Link to Review Queue from Upload
**Description**: Button to navigate to review queue
**Files**:
- Modify upload results component
**Features**:
- "Review Transactions" button (shown when review_count > 0)
- Navigates to /review
- Closes upload modal
**Dependencies**: Task 5.1, Task 2.1 (ReviewQueue exists)

### Task 5.3: Add Toast Notifications
**Description**: Toast feedback for all mutations
**Files**:
- Modify all components with save/delete actions
**Features**:
- Success toasts: "Transaction categorized", "Rule created", etc.
- Error toasts: Show error message from API
- Consistent positioning (bottom-right)
**Dependencies**: Task 1.3 (Toast library)

### Task 5.4: Keyboard Navigation
**Description**: Improve accessibility in review queue
**Files**:
- Modify `ReviewItem.tsx`, `ReviewList.tsx`
**Features**:
- Tab through items
- Enter to expand/save
- Escape to cancel
- Arrow keys in dropdown
**Dependencies**: Phase 2 complete

### Task 5.5: Mobile Responsive Adjustments
**Description**: Ensure usability on small screens
**Files**:
- All new components
**Features**:
- ReviewItem stacks vertically on mobile
- RulesTable horizontal scroll or card view
- Touch-friendly tap targets (44px minimum)
**Dependencies**: Phase 2, 4 complete

### Task 5.6: Search/Filter in Rules Page
**Description**: Filter rules by pattern text
**Files**:
- Modify `RulesManager.tsx`
**Features**:
- Search input above table
- Client-side filter
- Debounced input
- Clear button
**Dependencies**: Task 4.2

### Phase 5 Summary
| Task | Can Parallel | Depends On |
|------|--------------|------------|
| 5.1 | Yes | Upload component exists |
| 5.2 | No | 5.1, 2.1 |
| 5.3 | Yes | 1.3 |
| 5.4 | No | Phase 2 |
| 5.5 | No | Phase 2, 4 |
| 5.6 | No | 4.2 |

---

## Dependency Graph

```
Phase 1 (Foundation)
   │
   ├──────────────────────────┐
   │                          │
   ▼                          ▼
Phase 2 (Review Queue)    Phase 4 (Rules Management)
   │                          │
   ▼                          │
Phase 3 (Rule Creation)       │
   │                          │
   └──────────┬───────────────┘
              │
              ▼
       Phase 5 (Polish)
```

## Parallelization Opportunities

### Maximum Parallelism Strategy

**Sprint 1** (Foundation):
- Tasks 1.1, 1.2, 1.3, 1.4 in parallel
- Then 1.5, then 1.6

**Sprint 2** (Core Features - 2 tracks):
- Track A: Tasks 2.1 → 2.2 → 2.3 → 2.4 (Review Queue)
- Track B: Tasks 4.1 → 4.2 → 4.3/4.4/4.5/4.6 (Rules Management)
- Task 2.5 can parallel with Track A
- Task 2.6 joins after 2.1 + 2.5

**Sprint 3** (Advanced + Polish):
- Tasks 3.1 → 3.2 → 3.3/3.4 (Rule Creation)
- Tasks 5.1 → 5.2 (Upload Integration)
- Tasks 5.3, 5.4, 5.5, 5.6 (Polish)

## Task Checklist

### Phase 1: Foundation
- [ ] 1.1 Install React Query
- [ ] 1.2 Install shadcn/ui components
- [ ] 1.3 Install Toast library
- [ ] 1.4 Create TypeScript types
- [ ] 1.5 Create API hooks
- [ ] 1.6 Create CategoryDropdown

### Phase 2: Review Queue
- [ ] 2.1 ReviewQueue page shell
- [ ] 2.2 ReviewItem component
- [ ] 2.3 ReviewList component
- [ ] 2.4 Save categorization
- [ ] 2.5 ReviewBadge component
- [ ] 2.6 Add to navigation

### Phase 3: Rule Creation
- [ ] 3.1 Create Rule button
- [ ] 3.2 RuleCreationForm component
- [ ] 3.3 Wire to API
- [ ] 3.4 Pattern validation

### Phase 4: Rules Management
- [ ] 4.1 RulesManager page shell
- [ ] 4.2 RulesTable component
- [ ] 4.3 Active/inactive toggle
- [ ] 4.4 Edit functionality
- [ ] 4.5 Delete functionality
- [ ] 4.6 RuleCreateModal
- [ ] 4.7 Add to settings navigation

### Phase 5: Polish
- [ ] 5.1 Upload results display
- [ ] 5.2 Link to review queue
- [ ] 5.3 Toast notifications
- [ ] 5.4 Keyboard navigation
- [ ] 5.5 Mobile responsive
- [ ] 5.6 Rules search/filter
