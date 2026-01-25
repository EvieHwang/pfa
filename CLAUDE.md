# Claude Agent Autonomy Settings

This document defines the operational autonomy levels for the Claude agent working on this project.

## Allowed Commands

The following bash commands are pre-approved and should be run without prompting:

```bash
# Package management
pip install *
pip uninstall *
pip freeze *
npm install *
npm run *

# Python execution
python *
python3 *
pytest *

# AWS CLI
aws s3 *
aws lambda *
aws apigateway *
aws cloudformation *
aws cloudfront *
aws dynamodb *
aws sts *

# AWS SAM
sam build *
sam deploy *
sam local *
sam validate *
sam package *

# Git operations
git add *
git commit *
git push *
git pull *
git fetch *
git checkout *
git branch *
git merge *
git status
git log *
git diff *
git stash *

# Directory and file operations
mkdir *
cp *
mv *
rm -rf node_modules
rm -rf __pycache__
rm -rf .pytest_cache
rm -rf dist
rm -rf build
rm *.pyc

# Development tools
curl *
wget *
zip *
unzip *
tar *
cat *
head *
tail *
grep *
find *
ls *
cd *
pwd
echo *
export *
source *
chmod *
```

## Autonomous Operations (No Approval Required)

### Git Operations
- **Create feature branches**: Create branches from main for all feature work
- **Commit to branches**: Create commits with descriptive messages on feature branches
- **Push to remote**: Push branches to GitHub remote repository
- **Create PRs**: Open pull requests for all changes targeting main
- **Do not merge PRs**: Leave PRs open for human review unless explicitly instructed

### Development and Deployment
- **Run deployments**: Execute deployment scripts and commands (AWS SAM, etc.)
- **Build and test**: Run build processes, test suites, and validation scripts
- **Install dependencies**: Add, update, or remove project dependencies as needed

### AWS Operations
- **SAM build/deploy**: Run `sam build` and `sam deploy` for Lambda deployments
- **S3 sync**: Upload files to S3 buckets
- **S3 bucket creation**: Create new S3 buckets for hosting or storage
- **S3 website configuration**: Enable static website hosting on S3 buckets
- **CloudFormation operations**: Create/update stacks via SAM
- **Lambda updates**: Deploy new versions of Lambda functions
- **API Gateway**: Create and configure API Gateway endpoints

### GitHub Integration
- **Read issues**: Fetch issue details for implementation specs
- **Update issues**: Close issues, add comments, update labels
- **Create branches**: Create feature branches from issues

### File Operations
- **Create files**: Generate new source files, tests, documentation, or specs
- **Edit files**: Modify existing files to implement features or fix bugs
- **Move/rename files**: Reorganize project structure as needed
- **Create directories**: Add new folders for organizational purposes

## Operations Requiring Approval

Always ask before performing these operations:

### Destructive Operations
- **Delete tracked files**: Removing source files from the repository
- **Drop AWS resources**: Deleting S3 buckets, Lambda functions, API Gateways
- **Force push**: Rewriting git history that has been pushed to remote
- **Delete branches**: Removing branches from remote repository

### Major Architectural Changes
- **Change core architecture**: Switching deployment approach or major services
- **Replace major dependencies**: Swapping out Claude API, changing AWS services
- **Modify data schemas**: Changing data structures in breaking ways

## AWS Cost Guardrails

**NEVER configure these without explicit user approval:**
- Lambda Provisioned Concurrency
- Lambda Reserved Concurrency
- NAT Gateways
- Dedicated hosts
- Any "always-on" or "pre-warmed" compute resources

Cold starts are acceptable for most use cases. Pay-per-invocation only.

## DNS & Custom Domain Setup

Apps deploy to custom domains using the pattern: `{repo-name}.evehwang.com`

### Pre-configured Resources (Do Not Create)

These resources already exist and are configured in template.yaml defaults:

- **Wildcard Certificate ARN**: `arn:aws:acm:us-east-1:070840362692:certificate/7358ccd1-846d-4b50-9ccc-b511faa8a4b1`
- **Route 53 Hosted Zone ID**: `Z05581993IIU4AAT9GY4N`
- **Domain**: `evehwang.com`

### How It Works

1. The SAM template creates a CloudFront distribution with the custom domain alias
2. An ACM certificate (wildcard `*.evehwang.com`) provides SSL
3. A Route 53 A record points the domain to CloudFront

### Deployment

On first deployment (or to set a custom domain):

```bash
sam deploy --parameter-overrides DomainName=my-app.evehwang.com
```

The GitHub Actions workflow automatically sets `DomainName` to `{repo-name}.evehwang.com`.

### Important Notes

- The certificate must be in `us-east-1` for CloudFront (it already is)
- `Z2FDTNDATAQYW2` is CloudFront's global hosted zone ID (a constant, not ours)
- If `DomainName` is empty, the template falls back to the CloudFront domain (e.g., `d123.cloudfront.net`)
- Domain can be overridden if you want something other than the repo name

## Spec-Driven Workflow

This project uses a specification-driven development approach. Features live in the `/specs` directory.

### Workflow Sequence

1. **Specification Phase**: Define feature in `spec.md` with user stories, acceptance scenarios, requirements
2. **Planning Phase**: Create `plan.md` with architecture, phases, deployment strategy
3. **Task Breakdown**: Generate `tasks.md` with detailed tasks, dependencies, parallelization opportunities
4. **Implementation Phase**: Execute tasks following the plan, with tests at each phase
5. **Deployment**: Use SAM for infrastructure, git for version control, create PRs for review

### When to Use Full Spec Workflow

**Use the full spec workflow when:**
- Requirements are vague or open-ended
- Multiple valid approaches exist and architectural decisions are needed
- Complex features touching many files or systems
- New capabilities without clear implementation path

**Direct implementation is acceptable when:**
- Issue already contains detailed specs with code snippets
- Bug fixes with clear reproduction steps and obvious solutions
- Documentation-only changes
- Small changes following established patterns

### Feature Folder Structure

Each feature gets a numbered folder in `/specs`:

```
specs/
├── CONSTITUTION.md
├── 001-feature-name/
│   ├── spec.md          # Requirements and acceptance criteria
│   ├── plan.md          # Technical architecture and phases
│   ├── tasks.md         # Detailed task breakdown
│   ├── data-model.md    # Database schema and entities
│   └── contracts/
│       └── api.yaml     # OpenAPI specification
├── 002-another-feature/
│   └── ...
```

## Development Philosophy

- **Ship early, ship often**: Bias toward action and deployment
- **Prototype mindset**: Optimize for learning and iteration, not perfection
- **Descriptive commits**: Write clear commit messages that explain *why* not just *what*
- **Spec-driven**: Specifications guide implementation; diverge only with good reason
- **Cost-conscious**: Keep AWS costs minimal, use Claude Haiku where possible
- **Self-documenting**: Code and commits should tell the story
- **Run autonomously**: Don't stop to ask permission for routine operations

## Communication Style

- Be concise and action-oriented
- Explain decisions briefly in commit messages
- Report blockers or ambiguities immediately
- Summarize what was done after completing tasks
- Do not ask for permission on allowed operations - just execute

## Documentation Requirements

### Automatic README Updates

**After completing any feature or significant change, automatically update README.md** to reflect the current state of the project. Do not wait for a separate prompt - this is part of completing the feature.

The README must always include:

1. **Project Overview**: Brief description of what the app does
2. **Features List**: Current capabilities (keep updated as features are added/changed)
3. **Tech Stack**: Languages, frameworks, and services used
4. **Setup/Deployment Instructions**: How to install dependencies, build, and deploy
5. **Usage Guide**: How to use the main features

When updating README.md:
- Keep it concise but complete
- Update the features list if new capabilities were added
- Update usage instructions if UI/workflow changed
- Commit the README update as part of the feature commit or immediately after

## Code Quality Requirements

### Python Code Style

**ALWAYS run `ruff check backend/src/ --fix` before committing Python code.** This ensures CI will pass.

Key style rules enforced by ruff:
- **Import sorting**: Use `isort` style (stdlib first, then third-party, then local)
- **Modern type hints**: Use `tuple` instead of `typing.Tuple`, `X | None` instead of `Optional[X]`
- **No bare except**: Always catch specific exceptions (e.g., `except (ValueError, TypeError):` not `except:`)
- **No unused variables**: Prefix unused loop variables with underscore (e.g., `_unused`)
- **Explicit zip strict**: Use `zip(a, b, strict=False)` or `strict=True`

Example of correct modern Python:
```python
# Good - modern type hints
def process(data: dict) -> list[str] | None:
    ...

# Good - unused loop variables
for _index, value in enumerate(items):
    print(value)

# Good - specific exceptions
try:
    data = json.loads(body)
except (json.JSONDecodeError, ValueError, TypeError):
    return error_response(400, "Invalid JSON")

# Bad - deprecated typing
from typing import Dict, List, Optional
def process(data: Dict) -> Optional[List[str]]:
    ...
```

### Pre-Commit Checklist

**CRITICAL: Run these before every commit to avoid CI failures:**

1. Run `ruff check backend/src/ --fix` to auto-fix linting issues
2. Run `ruff check backend/src/` to verify no remaining issues
3. If tests exist, run `pytest backend/tests/ -v` to verify they pass
4. If you modified handler.py or routes, ensure tests still import correctly

### Test Maintenance

**When refactoring code, always update corresponding tests:**

- If you remove or rename a function, update test imports
- If you change function signatures, update test calls
- Tests import from `src.*` - ensure these paths remain valid
- Run tests locally before pushing when possible

Example issue to avoid:
```python
# If you remove health_check() function from handler.py,
# also remove it from test imports:
# BAD: from src.handler import health_check, lambda_handler
# GOOD: from src.handler import lambda_handler
```

### SAM Deployment

**Always use `--resolve-s3` flag** when deploying with SAM to auto-create the deployment bucket:

```bash
sam deploy \
  --stack-name pfa \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides DomainName=pfa.evehwang.com
```

**Use consistent stack naming**: The stack name is `pfa` (matching the repo name). Always use this name in:
- `sam deploy --stack-name pfa`
- CloudFormation queries
- GitHub Actions workflows

**Never use a different stack name** (e.g., `pfa-stack`) as this creates orphaned resources.

### Frontend Types

This project supports two frontend types:

1. **Build-based** (React/Vite):
   - Has `package.json` with `"build"` script AND `package-lock.json`
   - Deploys from `dist/` after npm build

2. **Static** (Vanilla JS):
   - No build step needed
   - Deploys files directly from `frontend/`
   - May have `package.json` but no `package-lock.json`

**Important**: CI/CD workflows detect build-based frontends by checking for BOTH:
- `package.json` with a `"build"` script
- `package-lock.json` file

If you have a static frontend with a leftover `package.json` (from template), the workflow will correctly skip the build step as long as there's no `package-lock.json`.

## CI/CD Workflow Guidelines

### Workflow Debugging

When CI/CD fails:
1. Run `gh run view <run-id> --log-failed` to see error details
2. Check if it's a code issue (linting, tests) or infrastructure issue (permissions)
3. For permission errors, check AWS IAM policies for the `github-actions-wm2` user

### Required AWS Permissions

The GitHub Actions user needs these CloudFormation permissions for SAM deploy:
- `cloudformation:CreateChangeSet`
- `cloudformation:CreateStack`
- `cloudformation:DeleteChangeSet`
- `cloudformation:DescribeChangeSet`
- `cloudformation:DescribeStackEvents`
- `cloudformation:DescribeStacks`
- `cloudformation:ExecuteChangeSet`
- `cloudformation:GetTemplate`
- `cloudformation:GetTemplateSummary`
- `cloudformation:ListStackResources`
- `cloudformation:UpdateStack`
- `cloudformation:ValidateTemplate`

### Common CI Failures and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| Import sorting errors | Imports not in isort order | Run `ruff check --fix` |
| `typing.Tuple` deprecated | Using old type hints | Use `tuple` instead |
| Bare `except:` | Missing exception types | Use `except (TypeError, ValueError):` |
| Test import error | Function was removed/renamed | Update test imports |
| npm cache error | No package-lock.json | Ensure workflow checks for lock file |
| SAM S3 bucket error | Missing --resolve-s3 | Add flag to sam deploy |
| CloudFormation AccessDenied | Missing IAM permissions | Add required permissions to user |

## Post-Merge Deployment Monitoring

**After any PR is approved and merged, always verify the deployment succeeded:**

1. Wait 60 seconds for GitHub Actions to start
2. Check workflow status: `gh run list --limit 5`
3. If deploy shows `failure`:
   - Investigate: `gh run view <run-id> --log-failed`
   - Fix the issue immediately
   - Document the root cause in the "Deployment Lessons Learned" section below
4. If deploy shows `success`:
   - Verify the app works: `curl -s https://pfa.evehwang.com/api/health`
   - Spot-check any changed functionality

**The goal is to never repeat the same deployment mistake twice.**

## Active Technologies

- Python 3.12+ (Lambda runtime)
- Claude API (Anthropic SDK) for AI features
- AWS Lambda, API Gateway, S3, CloudFront
- AWS SAM for deployment

## Deployment Lessons Learned

Document root causes of deployment failures here to prevent recurrence:

### 2026-01-24: Python Linting Failures
**Symptom**: CI failed on ruff linting checks
**Root Cause**: Code used deprecated `typing.Tuple`, `typing.Optional`, bare `except:`, unsorted imports
**Fix**: Always run `ruff check backend/src/ --fix` before committing
**Prevention**: Added to Pre-Commit Checklist

### 2026-01-24: SAM Deploy Missing S3 Bucket
**Symptom**: Deploy failed with "S3 Bucket not specified"
**Root Cause**: `sam deploy` command missing `--resolve-s3` flag
**Fix**: Added `--resolve-s3` to deploy workflow
**Prevention**: Documented in SAM Deployment section

### 2026-01-24: Stack Name Mismatch
**Symptom**: Deploy workflow couldn't find stack outputs
**Root Cause**: Workflow used `pfa-stack` but manual deploy used `pfa`
**Fix**: Standardized on `pfa` as the stack name
**Prevention**: Added warning about consistent stack naming

### 2026-01-24: Frontend npm Cache Error
**Symptom**: Deploy failed with "unable to cache dependencies"
**Root Cause**: Workflow tried to cache npm with `package-lock.json` that didn't exist (static frontend)
**Fix**: Updated workflow to check for both `package.json` with build script AND `package-lock.json`
**Prevention**: Documented frontend type detection requirements

### 2026-01-24: Test Import Errors
**Symptom**: Tests failed to import removed function
**Root Cause**: Refactored `handler.py` but didn't update test imports
**Fix**: Updated test file to match new handler structure
**Prevention**: Added Test Maintenance section

### 2026-01-24: AWS IAM Permission Denied
**Symptom**: Deploy failed with CloudFormation AccessDenied errors
**Root Cause**: GitHub Actions IAM user missing CloudFormation permissions
**Fix**: Added comprehensive CloudFormation policy to user
**Prevention**: Documented required permissions in CI/CD Workflow Guidelines
