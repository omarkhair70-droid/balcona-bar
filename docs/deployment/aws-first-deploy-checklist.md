# AWS First Deploy Checklist

Use this checklist for Production Phase 3. Do not treat it as permission to
deploy during Production Phase 2.

## Before Terraform Apply

- Confirm AWS account, region, and budget owner.
- Confirm app and API domain names.
- Confirm Route 53 hosted zone ownership.
- Confirm ACM certificate plan.
- Confirm whether NAT Gateway is required and accepted from a cost perspective.
- Confirm RDS deletion protection, backup retention, and snapshot policy.
- Confirm ElastiCache TLS choice and matching `REDIS_URL` scheme.
- Review `terraform.tfvars` for placeholder values.
- Run `terraform fmt -recursive`.
- Run `terraform validate`.
- Review `terraform plan`.

## Image Build And Push

- Build API Docker image.
- Build Web Docker image with the final `NEXT_PUBLIC_API_BASE_URL` build arg.
- Push API image to ECR.
- Push Web image to ECR.
- Update Terraform/ECS image variables or ECS task definitions with the pushed
  tags.

## Secrets

- Populate `DATABASE_URL` in Secrets Manager.
- Populate `REDIS_URL` in Secrets Manager.
- Keep optional AI provider keys unset unless a future phase enables them.
- Verify no real secret values are in git, Terraform variables, or PR comments.

## Database

- Confirm RDS is reachable from the migration runner.
- Run `pnpm --filter @balcona-bar/api prisma:generate`.
- Run `pnpm api:prisma:migrate:deploy`.
- Confirm backups exist before production data migrations.

## ECS Rollout

- Deploy API task definition.
- Deploy Web task definition.
- Confirm API/Web services reach steady state.
- Confirm CloudWatch logs show successful startup.
- Confirm ALB target groups are healthy.

## Smoke Test

- API health endpoint.
- Web root.
- `/demo/balkona`.
- `/customer/table/balcona-main-t01`.
- `/staff/login`.
- Submit a customer order if seeded demo data is available.
- Confirm staff dashboards load the operating flow.

## Rollback

- Keep previous ECR image tags.
- Roll ECS services back to previous task definition revisions.
- Do not reverse Prisma migrations without a manual database plan.
- Keep logs and failed task details for investigation.
