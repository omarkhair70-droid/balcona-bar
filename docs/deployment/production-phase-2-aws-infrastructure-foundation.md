# Production Phase 2 AWS Infrastructure Foundation

## Goal

Production Phase 2 adds AWS infrastructure-as-code scaffolding and deployment
planning for the Cafe AI Waiter App / Smart Cafe Operating System. It does not
create real AWS resources, does not commit secrets, and does not choose final
account, domain, certificate, or sizing values.

## Target Architecture

- Route 53 plans DNS for app and API domains.
- ACM issues TLS certificates after real domains are chosen.
- CloudFront can sit at the edge for the public web/API entry point.
- Application Load Balancer routes traffic to Web and API target groups.
- ECS Fargate runs separate API and Web containers.
- ECR stores API and Web container images.
- RDS PostgreSQL stores production relational data.
- ElastiCache Redis supports realtime, jobs, and cache needs.
- Secrets Manager stores database, Redis, and future provider secrets.
- CloudWatch Logs stores API, Web, and Redis logs.
- A VPC separates public ALB subnets, private app subnets, and private data
  subnets.

## Why ECS Fargate

ECS Fargate is a good fit for this stage because the application already has
production Dockerfiles, the API and Web services are separate long-running
containers, and the team can avoid managing EC2 hosts while still keeping direct
control over networking, security groups, logging, and rollout behavior.

Fargate also leaves room to split workers later if jobs need a dedicated runtime.

## Routing Options

Recommended first public demo shape:

- `app.example.com` -> CloudFront or ALB -> Web ECS service
- `api.example.com` -> CloudFront or ALB -> API ECS service

Alternative later shape:

- one domain with path routing, for example `/api/*` to API and all other paths
  to Web

The Terraform scaffold includes ALB path routing for `/api/*` and `/health`.
Domain-specific Route 53, ACM, and CloudFront resources are left in
`infra/aws/terraform/domain-placeholders.tf.example` until real DNS values exist.

## Required AWS Services

- VPC
- public and private subnets
- Internet Gateway
- optional NAT Gateway
- Security Groups
- ECR
- ECS Fargate
- ALB
- RDS PostgreSQL
- ElastiCache Redis
- Secrets Manager
- CloudWatch Logs
- Route 53 and ACM when real domains are ready
- CloudFront when the edge/CDN shape is finalized

S3 is not required for the current app. It can be added later for uploads,
media, or static asset workflows.

## Environment Variable Mapping

| App variable | AWS source | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | ECS Web task environment | Must be the public browser-facing API URL, such as `https://api.example.com/api/v1`. |
| `CORS_ORIGINS` | ECS API task environment | Must include the deployed web origin, such as `https://app.example.com`. |
| `DATABASE_URL` | Secrets Manager | PostgreSQL URL for RDS. Populate after RDS endpoint and password are known. |
| `REDIS_URL` | Secrets Manager | ElastiCache Redis URL. Use `rediss://` if TLS is enabled. |
| `NODE_ENV` | ECS task environment | `production`. |
| `PORT` | ECS task environment | API `3000`, Web `3001`. |
| `STAFF_AUTH_DEV_BOOTSTRAP_ENABLED` | ECS API task environment | `false` in production. |
| `SWAGGER_ENABLED` | ECS API task environment | `false` by default in production. |
| `OPENAI_API_KEY` | Secrets Manager placeholder | Optional future provider key only. |
| `ANTHROPIC_API_KEY` | Secrets Manager placeholder | Optional future provider key only. |

## Secrets Strategy

- No secrets in git.
- Use Secrets Manager or SSM Parameter Store for runtime secrets.
- The scaffold creates Secrets Manager placeholders for `DATABASE_URL`,
  `REDIS_URL`, and future AI provider keys.
- RDS master password is managed by AWS.
- Rotate database and provider credentials through AWS-managed workflows where
  possible.
- ECS task definitions reference secret ARNs instead of literal secret values.

## Database Strategy

RDS PostgreSQL is the production database target. The scaffold uses private data
subnets, storage encryption, backup retention, and a deletion protection
variable.

Deployment migration flow:

```bash
pnpm install --frozen-lockfile
pnpm --filter @balcona-bar/api prisma:generate
pnpm api:prisma:migrate:deploy
```

Backups are required before production migrations. Do not use
`prisma migrate dev` in AWS environments.

## Redis Strategy

ElastiCache Redis is the production Redis target. The scaffold keeps Redis in
private data subnets and allows ingress only from ECS tasks.

If transit encryption is enabled, use a `rediss://` URL in `REDIS_URL`.

## Logging Strategy

CloudWatch log groups are created for:

- API ECS task logs
- Web ECS task logs
- Redis slow logs

Retention is controlled by `log_retention_days`.

## Security Basics

- Public ALB accepts HTTP/HTTPS from configured CIDR blocks.
- ECS tasks accept traffic only from the ALB security group.
- RDS accepts PostgreSQL only from ECS tasks.
- Redis accepts Redis only from ECS tasks.
- RDS and Redis live in private data subnets.
- ECS tasks live in private app subnets.
- Keep public ports limited to ALB listeners.

## Cost Awareness

- NAT Gateway can cost money continuously. The scaffold defaults
  `enable_nat_gateway` to `false`.
- RDS and ElastiCache run continuously.
- CloudWatch Logs, ALB, ECS tasks, and ECR storage can incur cost.
- Use small staging sizes first, then resize based on real usage.

## Deployment Flow

1. Review Terraform variables and choose real AWS account, region, and domains.
2. Build Docker images from the Phase 1 Dockerfiles.
3. Push API and Web images to ECR.
4. Populate Secrets Manager values for `DATABASE_URL` and `REDIS_URL`.
5. Run Prisma migrations with `pnpm api:prisma:migrate:deploy`.
6. Update ECS task image URIs.
7. Deploy or force a new ECS service rollout.
8. Smoke test:
   - API health endpoint
   - Web root
   - `/demo/balkona`
   - `/customer/table/balcona-main-t01`
   - `/staff/login`

## Rollback Plan

- Keep previous ECR image tags.
- Roll ECS services back to the previous task definition revision.
- Do not roll database migrations backward automatically.
- Restore RDS from backup only with an explicit incident plan.
- Keep CloudWatch logs for the failed deployment window.

## What Remains For Production Phase 3

- First Public Demo Deploy
- real AWS account values
- first API/Web image push
- DNS and TLS finalization
- CloudFront decision and cache policy verification
- seed/demo tenant verification
- public smoke test
