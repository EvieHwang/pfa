# Burn Rate

A personal finance awareness app that cultivates intuitive understanding of spending patterns through trend visualization and sentiment feedback. Burn Rate doesn't enforce budgets — it helps you find your own equilibrium by tracking how spending *resolves toward a target* over time, with targets that emerge from your own sense of what feels sustainable.

**Status**: Resetting for v2 — Phase 1 in progress

## Architecture

Burn Rate uses a three-component architecture:

1. **AWS Backend** (SAM/Lambda/S3/CloudFront) — All business logic, CSV processing, burn rate computation, API endpoints
2. **Web Frontend** (Vanilla JS, desktop) — CSV upload, transaction categorization, sentiment feedback, full dashboard
3. **iOS App** (SwiftUI + WidgetKit, read-only) — Resolution curves, widgets, at-a-glance status on home screen

## Tech Stack

- **Backend**: Python 3.12, AWS Lambda, SQLite on S3
- **Frontend**: Vanilla JavaScript, Chart.js, Tabulator.js
- **iOS**: SwiftUI, WidgetKit (Phase 4)
- **Infrastructure**: AWS SAM, CloudFront, S3, API Gateway
- **Auth**: Password-only with JWT
- **CI/CD**: GitHub Actions

## Full Specification

See [`specs/001-burn-rate-core/spec.md`](./specs/001-burn-rate-core/spec.md) for the complete product specification.
