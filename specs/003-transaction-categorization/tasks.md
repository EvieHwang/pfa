# Transaction Categorization Feature - Task Breakdown

## Phase 1: API Client Extensions

### Task 1.1: Add Rules API Methods
**File:** `frontend/js/api.js`
**Estimate:** 15 min

```javascript
// Add to API object:
rules: {
    list() { return API.get('/rules'); },
    create(data) { return API.post('/rules', data); },
    update(id, data) { return API.patch(`/rules/${id}`, data); },
    delete(id) { return API.delete(`/rules/${id}`); }
}
```

**Checklist:**
- [ ] Add `API.patch()` method if missing
- [ ] Add `API.delete()` method if missing
- [ ] Add `API.rules` namespace with all CRUD methods
- [ ] Test each method with browser console

---

## Phase 2: Review Queue Enhancement

### Task 2.1: Add Create Rule UI Elements
**File:** `frontend/js/dashboard.js` → `renderReviewList()`
**Estimate:** 30 min

Modify the review item template to include:
- Checkbox: "Create rule for similar transactions"
- Collapsible section (shown when checked):
  - Pattern input (text field)
  - Priority input (number, default 50)

**Checklist:**
- [ ] Add checkbox with label after category dropdown
- [ ] Add hidden div for pattern/priority inputs
- [ ] Add CSS class to show/hide based on checkbox state
- [ ] Wire up change listener to toggle visibility

### Task 2.2: Implement Pattern Suggestion
**File:** `frontend/js/dashboard.js`
**Estimate:** 20 min

```javascript
suggestPattern(description) {
    // Port logic from backend categorization.py
    const excludeWords = ['THE', 'AND', 'OR', 'OF', 'LLC', 'INC', ...];
    const words = description.toUpperCase().split(' ');
    const meaningful = words.filter(w =>
        !excludeWords.includes(w) && w.length > 2 && !/^\d+$/.test(w)
    );
    return meaningful[0] || words[0] || description.slice(0, 20);
}
```

**Checklist:**
- [ ] Create `suggestPattern()` function
- [ ] Call it when checkbox is checked to pre-fill pattern
- [ ] Allow user to edit the suggested pattern

### Task 2.3: Update Save Logic for Rule Creation
**File:** `frontend/js/dashboard.js` → `saveReviews()`
**Estimate:** 30 min

Modify to:
1. Collect rule creation requests for checked items
2. After batch categorize succeeds, create each rule
3. Report combined results in toast

**Checklist:**
- [ ] Collect rule data from checked items (pattern, category_id, priority)
- [ ] After `batchCategorize()`, loop through and call `API.rules.create()`
- [ ] Track success/failure counts
- [ ] Update toast message: "Updated X transactions, created Y rules"
- [ ] Handle partial failures gracefully

### Task 2.4: Add Review Item Styles
**File:** `frontend/css/styles.css`
**Estimate:** 15 min

**Checklist:**
- [ ] Style the "Create Rule" checkbox
- [ ] Style the collapsible pattern/priority section
- [ ] Add transition for smooth show/hide
- [ ] Ensure mobile responsiveness

---

## Phase 3: Rules Management - View & Toggle

### Task 3.1: Refactor Rules Tab Rendering
**File:** `frontend/js/app.js`
**Estimate:** 30 min

Replace simple list with structured table:
```html
<table class="rules-table">
  <thead>
    <tr><th>Pattern</th><th>Category</th><th>Priority</th><th>Active</th><th>Actions</th></tr>
  </thead>
  <tbody id="rules-tbody"></tbody>
</table>
```

**Checklist:**
- [ ] Create `loadRules()` function (or refactor existing)
- [ ] Fetch rules and categories
- [ ] Render table rows with rule data
- [ ] Add loading state

### Task 3.2: Implement Active Toggle
**File:** `frontend/js/app.js`
**Estimate:** 20 min

**Checklist:**
- [ ] Add checkbox/toggle in Active column
- [ ] Wire up change listener
- [ ] Call `API.rules.update(id, { is_active: checked })`
- [ ] Show visual feedback (toggle state, row opacity)
- [ ] Handle errors (revert toggle on failure)

### Task 3.3: Add Rules Table Styles
**File:** `frontend/css/styles.css`
**Estimate:** 15 min

**Checklist:**
- [ ] Style rules table (borders, padding, alignment)
- [ ] Style active toggle
- [ ] Style inactive rows (gray/muted)
- [ ] Responsive: stack on mobile or horizontal scroll

---

## Phase 4: Rules Management - Create & Edit

### Task 4.1: Add "Add Rule" Button and Form
**File:** `frontend/js/app.js`
**Estimate:** 30 min

**Checklist:**
- [ ] Add "Add Rule" button in tab header
- [ ] Create form template (pattern, category dropdown, priority, active)
- [ ] Show form when button clicked (prepend to table or modal)
- [ ] Populate category dropdown from API

### Task 4.2: Implement Create Rule Logic
**File:** `frontend/js/app.js`
**Estimate:** 20 min

**Checklist:**
- [ ] Validate form (pattern required, category required)
- [ ] Call `API.rules.create()`
- [ ] On success: hide form, prepend new row to table, show toast
- [ ] On error: show error message, keep form open

### Task 4.3: Implement Inline Edit Mode
**File:** `frontend/js/app.js`
**Estimate:** 40 min

**Checklist:**
- [ ] Add Edit button/icon per row
- [ ] On click: transform row into editable form fields
- [ ] Add Save/Cancel buttons in edit mode
- [ ] Save: validate, call `API.rules.update()`, restore row view
- [ ] Cancel: restore original values, exit edit mode

### Task 4.4: Add Form Styles
**File:** `frontend/css/styles.css`
**Estimate:** 15 min

**Checklist:**
- [ ] Style add/edit form
- [ ] Style action buttons (Edit, Save, Cancel)
- [ ] Inline edit: style form fields to match row height

---

## Phase 5: Rules Management - Delete

### Task 5.1: Add Delete Button
**File:** `frontend/js/app.js`
**Estimate:** 15 min

**Checklist:**
- [ ] Add Delete button/icon per row (next to Edit)
- [ ] Style as destructive action (red icon/text)

### Task 5.2: Implement Delete with Confirmation
**File:** `frontend/js/app.js`
**Estimate:** 20 min

**Checklist:**
- [ ] On click: show confirmation dialog (reuse modal or use `confirm()`)
- [ ] On confirm: call `API.rules.delete(id)`
- [ ] On success: remove row from DOM, show toast
- [ ] On error: show error message

---

## Testing Checklist

### Phase 2 Testing
- [ ] Create transaction via upload
- [ ] Open review queue, verify transactions appear
- [ ] Categorize without rule creation → verify transaction updated
- [ ] Categorize with rule creation → verify both transaction and rule created
- [ ] Upload new transaction matching new rule → verify auto-categorized

### Phase 3-5 Testing
- [ ] Open Settings → Rules tab → verify rules load
- [ ] Toggle rule active → verify saved (check API response)
- [ ] Create new rule → verify appears in list
- [ ] Edit rule → verify changes saved
- [ ] Delete rule → verify removed from list
- [ ] Upload transaction matching deleted rule → verify NOT auto-categorized

---

## Summary

| Phase | Tasks | Est. Total |
|-------|-------|------------|
| 1: API Client | 1 task | 15 min |
| 2: Review Queue | 4 tasks | 1.5 hr |
| 3: Rules View/Toggle | 3 tasks | 1 hr |
| 4: Rules Create/Edit | 4 tasks | 1.75 hr |
| 5: Rules Delete | 2 tasks | 35 min |
| **Total** | **14 tasks** | **~5 hr** |
