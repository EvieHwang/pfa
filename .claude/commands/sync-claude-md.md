# Sync CLAUDE.md from flying-stick

Copy the shared development settings from the flying-stick repository's CLAUDE.md to this project's CLAUDE.md.

## Instructions

1. Read `/Users/evehwang/GitHub/flying-stick/CLAUDE.md` (the source of truth for shared settings)
2. Read this project's `/Users/evehwang/GitHub/pfa/CLAUDE.md`
3. Identify sections that should be shared across projects:
   - Allowed Commands
   - Git and Deployment Workflow
   - Autonomous Operations
   - Operations Requiring Approval
   - AWS Cost Guardrails
   - DNS & Custom Domain Setup (except project-specific distribution IDs)
   - Aerie Skills Integration
   - Spec-Driven Workflow
   - Development Philosophy
   - Communication Style
   - Documentation Requirements
   - Active Technologies

4. Preserve project-specific sections in pfa's CLAUDE.md:
   - CloudFront Cache Invalidation (with pfa's distribution ID)
   - Any other pfa-specific settings

5. Update pfa's CLAUDE.md with the latest shared sections from flying-stick
6. Commit the changes with message: "Sync CLAUDE.md from flying-stick"
7. Push to remote

Report what was updated.
