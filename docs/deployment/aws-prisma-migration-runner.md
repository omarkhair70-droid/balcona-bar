# AWS Prisma Migration Runner

Prisma migrations must run against the deployed RDS database before the API
rollout expects the new schema.

Use `prisma migrate deploy` for deployed environments. Do not use
`prisma migrate dev` against staging or production because it is designed for
local development, can create or modify migrations interactively, and may reset
or change database state in ways that are not safe for a public demo.

## Required Commands

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm api:prisma:migrate:deploy
```

These commands require a secure `DATABASE_URL` for the target RDS database.
Never commit the URL or print it into PR comments.

## Option A: Local Operator Machine Through Secure Access

Run migrations from a trusted operator machine that has:

- the exact repository commit to deploy
- dependencies installed with `pnpm install --frozen-lockfile`
- secure network access to RDS
- `DATABASE_URL` loaded from an approved secret source

This is simple for the first demo but requires careful network and credential
handling.

## Option B: Temporary ECS Task Migration Runner

Build or reuse the API image and run a one-off ECS task with:

- the API task role and network configuration
- the deployed image tag
- `DATABASE_URL` from Secrets Manager
- command override for `pnpm api:prisma:migrate:deploy` or the equivalent API
  package migrate command

This keeps migration traffic inside AWS but requires more ECS command detail and
operator care.

## Option C: GitHub Actions Migration Job Later

A future workflow can run migrations after review by using:

- GitHub environment approval
- OIDC role assumption
- secure secret retrieval
- a private network path to RDS, or a migration runner inside AWS

Do not add an automatic migration job until deployment access, approvals, and
rollback procedures are settled.

## First Demo Recommendation

For the first public demo, choose either local secure access or a temporary ECS
task migration runner in the deploy decision document. Keep the command
manual and approval-gated.

Minimum safe sequence:

1. Confirm the exact git commit and image tag.
2. Confirm `DATABASE_URL` points at the staging/demo RDS instance.
3. Run `pnpm --filter @balcona-bar/api prisma:generate`.
4. Run `pnpm api:prisma:migrate:deploy`.
5. Save migration output in the deploy record without exposing secrets.
6. Roll out API tasks after migrations complete.
