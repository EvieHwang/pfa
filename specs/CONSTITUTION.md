# Burn Rate Constitution

This document establishes the foundational architectural principles, design philosophy, and decision-making framework for the Burn Rate project.

## Project Mission

Burn Rate is a personal finance awareness app that cultivates intuitive understanding of spending patterns through trend visualization and sentiment feedback. It does not enforce budgets — it helps the user find their own equilibrium.

## Architectural Principles

### 1. Awareness Over Budgeting

**Rationale**: Traditional budgeting creates guilt and anxiety. Burn Rate instead cultivates awareness of spending trends, helping users find sustainable patterns without rigid constraints.

**Implementation**:
- No budget ceilings or overspend warnings
- Focus on trend visualization (resolution curves)
- Sentiment-based feedback shapes targets over time
- No guilt, no shock — just data to inform intuition

**Trade-offs Accepted**:
- Less prescriptive than traditional budget apps
- Requires user engagement with feedback loop
- Targets emerge over time rather than being set upfront

### 2. Opinion-Based Targeting

**Rationale**: Users know how their spending feels better than any algorithm. Targets should emerge from sentiment feedback, not arbitrary numbers.

**Implementation**:
- "Good" and "Bad" sentiment feedback after reviewing spending
- Targets adjust based on weighted moving average when user indicates comfort
- Two independent tracking groups: Food and Discretionary
- Recurring expenses segmented and excluded from burn rate

**Trade-offs Accepted**:
- Requires consistent user feedback to learn targets
- Initial targets set manually before learning kicks in
- Less "set and forget" than fixed budget apps

### 3. Three-Component Architecture

**Rationale**: Different interfaces for different contexts — detailed work on desktop, glanceable status on mobile.

**Implementation**:
- **AWS Backend**: SAM/Lambda/S3/CloudFront — all business logic lives here
- **Web Frontend**: Vanilla JS, desktop-focused — CSV upload, categorization, sentiment feedback, full dashboard
- **iOS App**: SwiftUI + WidgetKit, read-only — resolution curves, widgets, trend visualization

**Trade-offs Accepted**:
- iOS app is a thin client with no data entry
- Desktop required for transaction management
- Two codebases to maintain (web + iOS)

### 4. Simplicity First

**Rationale**: Complexity is the enemy of maintainability. Optimize for clarity and ease of understanding.

**Implementation**:
- SQLite on S3 for data storage
- Static hosting for web frontend (S3 + CloudFront)
- Minimal infrastructure to maintain
- No over-engineering for hypothetical scale
- Single-user system with password-only auth

**Trade-offs Accepted**:
- Not designed for multi-user or enterprise use
- Manual backup responsibility
- Limited to reasonable data volumes

### 5. Serverless When Dynamic

**Rationale**: Pay only for what you use, zero server maintenance.

**Implementation**:
- AWS Lambda for all server-side processing
- API Gateway for API endpoints
- S3 for static frontend hosting and database
- CloudFront for CDN and HTTPS

**Cost Guardrails**:
- No always-on compute
- No provisioned concurrency
- Cold starts are acceptable
- Target: < $5/month AWS costs

### 6. Data Portability

**Rationale**: Data belongs to the user; they should be able to take it anywhere.

**Implementation**:
- CSV import from Bank of America (credit card + checking/savings)
- All data exportable in standard formats
- No proprietary formats
- SQLite database is directly accessible
- Clear documentation of data structure

## Data Principles

### Data Integrity
- Duplicate detection on CSV import (hash-based)
- Data validation at API boundaries
- Consistent schemas across all endpoints

### Data Access
- Password-only authentication with JWT
- API key or JWT for iOS app
- No sharing or multi-user access

## Development Principles

### Specification-Driven
- Features start with specs in `/specs`
- Specs define requirements before implementation
- Implementation follows specs; deviations require spec updates

### Test Coverage
- Core burn rate calculations must have tests
- CSV parsing and duplicate detection must be tested
- API endpoints should have integration tests
- UI can have lighter test coverage

### Incremental Delivery
- Phase 1: Backend + Web MVP (upload, categorize, list)
- Phase 2: Categorization engine (rules, review queue)
- Phase 3: Burn rate + feedback (curves, targets, learning)
- Phase 4: iOS app + widgets (built separately in Xcode)
- Phase 5: Polish (alerts, history, export)

## Technology Constraints

### Must Use
- Python 3.12+ for backend
- AWS SAM for infrastructure
- SQLite for data storage
- Vanilla JS for web frontend
- SwiftUI for iOS app

### Prefer
- Chart.js for curve visualization (web)
- Tabulator.js for data tables (web)
- WidgetKit for iOS widgets

### Avoid
- Heavy frameworks (React, Vue) — vanilla JS is sufficient
- Managed databases — SQLite is sufficient
- Complex build systems for frontend
- Dependencies with large footprints

## Success Metrics

### MVP Success (Phase 1-2)
- [ ] CSV upload works for both BoA formats
- [ ] Duplicate detection prevents reimporting
- [ ] Transactions can be categorized manually
- [ ] Auto-categorization rules work
- [ ] Review queue shows uncategorized items

### Core Success (Phase 3)
- [ ] Resolution curves render correctly (5-30 day windows)
- [ ] Arrows indicate trend direction
- [ ] Sentiment feedback adjusts targets
- [ ] Food and Discretionary tracked independently

### Full Success (Phase 4-5)
- [ ] iOS app displays current burn rate
- [ ] Widgets show at-a-glance status
- [ ] Recurring expenses tracked separately
- [ ] Historical snapshots available
- [ ] AWS costs under $5/month

## Revision History

- **2026-02-08**: Constitution reset for Burn Rate v2 — awareness over budgeting, three-component architecture, sentiment-based targeting
