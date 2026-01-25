# PFA - Personal Finance Awareness

A single-user personal finance tracking app for managing Bank of America transactions, categorization, and budgets.

**Live URL**: https://pfa.evehwang.com

[![CI](https://github.com/EvieHwang/pfa/actions/workflows/ci.yml/badge.svg)](https://github.com/EvieHwang/pfa/actions/workflows/ci.yml)
[![Deploy](https://github.com/EvieHwang/pfa/actions/workflows/deploy.yml/badge.svg)](https://github.com/EvieHwang/pfa/actions/workflows/deploy.yml)

## Features

- **CSV Upload**: Import Bank of America transaction exports (credit card and checking/savings formats)
- **Auto-Categorization**: Rule-based categorization with priority matching
- **Transaction Management**: Browse, search, filter, and manually categorize transactions
- **Review Queue**: Flag uncategorized transactions for manual review
- **Dashboard**: Summary cards, spending by category chart, and income/expense trends
- **Budget Tracking**: Set monthly budgets by category and track progress
- **Data Export**: Download transactions as CSV

## Usage

1. Visit https://pfa.evehwang.com
2. Log in with the password
3. Click "Upload CSV" to import Bank of America transaction exports
4. Review and categorize flagged transactions
5. View spending patterns on the dashboard
6. Set budgets in Settings > Budgets

### Supported CSV Formats

**Credit Card Format**:
```
Posted Date,Reference Number,Payee,Address,Amount
01/15/2026,12345678,AMAZON PRIME,SEATTLE WA,-49.99
```

**Checking/Savings Format**:
```
Date,Description,Amount,Running Bal.
01/15/2026,DIRECT DEPOSIT ACME CORP,3500.00,15234.56
```

## Tech Stack

- **Backend**: Python 3.12, AWS Lambda, SQLite (stored in S3)
- **Frontend**: Vanilla JavaScript, Chart.js, Tabulator.js
- **Infrastructure**: AWS SAM, CloudFront, S3, Secrets Manager
- **Authentication**: JWT tokens with bcrypt password hashing
- **CI/CD**: GitHub Actions

## Project Structure

```
pfa/
├── backend/
│   ├── src/
│   │   ├── handler.py          # Lambda entry point with routing
│   │   ├── auth.py             # JWT authentication
│   │   ├── database.py         # SQLite + S3 sync
│   │   ├── csv_parser.py       # Bank of America CSV parsing
│   │   ├── categorization.py   # Auto-categorization engine
│   │   ├── models.py           # Data models
│   │   ├── schema.sql          # Database schema + seed data
│   │   └── routes/             # API route handlers
│   └── requirements.txt
├── frontend/
│   ├── index.html              # Main SPA
│   ├── css/styles.css          # Styles
│   └── js/
│       ├── api.js              # API client
│       ├── auth.js             # Login handling
│       ├── app.js              # Main app controller
│       ├── dashboard.js        # Charts and summary
│       ├── transactions.js     # Transaction table
│       └── upload.js           # CSV upload
├── specs/
│   └── 002-pfa-core/           # Feature specification
├── CLAUDE.md                   # AI agent instructions
└── template.yaml               # SAM template
```

## Deployment

### Automatic Deployment

Merging a PR to `main` triggers automatic deployment:

1. **CI** runs lint, tests, security scans (on PR)
2. **You approve and merge** the PR (your deploy gate)
3. **Deploy** runs SAM deploy and syncs frontend to S3
4. **CloudFront** cache is invalidated

### Rollback

If a deployment breaks:

1. Go to GitHub → Actions → Rollback
2. Click "Run workflow"
3. Select component (backend/frontend/both)
4. Type "ROLLBACK" to confirm
5. Click "Run workflow"

## Secrets Management

**No `.env` files in production!** Secrets are managed via AWS Secrets Manager.

### How It Works

1. Store secrets in AWS Secrets Manager
2. Lambda fetches secrets at runtime via `utils/secrets.py`
3. Secrets are cached for Lambda warm starts
4. No redeployment needed for secret rotation

### Adding a Secret

```bash
# Update the secret
aws secretsmanager update-secret \
  --secret-id pfa/prod \
  --secret-string '{"ANTHROPIC_API_KEY": "new-key", "OTHER_SECRET": "value"}'
```

### Using Secrets in Code

```python
from src.utils.secrets import get_secret_value

api_key = get_secret_value("pfa/prod", "ANTHROPIC_API_KEY")
```

## Spec-Driven Development

This project uses a spec-driven workflow. See [CLAUDE.md](./CLAUDE.md) for details.

### Workflow

1. **Spec**: Define requirements in `specs/XXX-feature/spec.md`
2. **Plan**: Design architecture in `plan.md`
3. **Tasks**: Break down into atomic tasks in `tasks.md`
4. **Implement**: Follow the plan
5. **PR**: Create pull request for review

### When to Use Full Spec Workflow

- Complex features with multiple approaches
- Architectural decisions needed
- Unclear requirements

### When to Skip Specs

- Bug fixes with clear solutions
- Documentation changes
- Small changes following existing patterns

## Design System

The frontend uses an **information-dense** design philosophy. See [frontend/DESIGN.md](./frontend/DESIGN.md) for:

- Typography and spacing scales
- Color system with CSS variables
- Component usage guidelines
- Dark mode implementation
- How to add new components

## Cost Guardrails

⚠️ **Never configure without explicit approval:**

- Lambda Provisioned Concurrency
- NAT Gateways
- Dedicated hosts
- Any "always-on" compute

Cold starts are acceptable. Pay-per-invocation only.

## Contributing

1. Create a feature branch: `git checkout -b 001-feature-name`
2. Follow the spec-driven workflow (if appropriate)
3. Ensure tests pass: `make test`
4. Ensure linting passes: `make lint`
5. Create a PR using the template

## License

[Choose a license]

