# Production Phase 3B First Public Demo Deploy Checklist

Use this checklist only after Production Phase 3A is merged and the team is
ready to create real AWS resources. This is the deploy checklist, not permission
to deploy during Phase 3A.

## Decisions

- Choose the AWS account.
- Choose the AWS region.
- Choose the public web domain or subdomain.
- Choose the public API domain or subdomain.
- Confirm the Route 53 hosted zone or external DNS plan.
- Confirm the ACM certificate region and validation method.
- Decide whether ECS private app subnets use NAT gateway or VPC endpoints.
- Configure AWS budget alerts manually before creating paid resources.

## Repository Readiness

- Confirm `main` includes Production Phase 3A.
- Confirm GitHub Actions CI is passing.
- Confirm Docker build validation is passing.
- Confirm Terraform validation is passing.
- Review `infra/aws/terraform/terraform.tfvars.example`.
- Create a local or secure CI `terraform.tfvars` with real non-secret values.
- Keep real secrets out of git, PR descriptions, and workflow logs.

## Terraform Review

From `infra/aws/terraform`:

```bash
terraform fmt -recursive
terraform init
terraform validate
terraform plan
```

Before apply:

- Review all resources in the plan.
- Review expected monthly cost for RDS, Redis, ALB, NAT gateway or VPC endpoints,
  ECS, CloudWatch Logs, and data transfer.
- Confirm RDS deletion protection and final snapshot settings.
- Confirm log retention.
- Confirm security group ingress and egress.
- Confirm image URI placeholders are replaced with real ECR image tags.

Only after review:

```bash
terraform apply
```

## Image Build And Push

- Configure the manual ECR push workflow secrets:
  - `AWS_REGION`
  - `API_ECR_REPOSITORY`
  - `WEB_ECR_REPOSITORY`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `AWS_ROLE_TO_ASSUME`, or `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Run the manual ECR push workflow.
- Record the API image tag.
- Record the Web image tag.
- Update Terraform variables or ECS task definitions to use the pushed image
  tags.

## Secrets And Runtime Configuration

- Populate Secrets Manager or SSM values for:
  - `DATABASE_URL`
  - `REDIS_URL`
  - JWT/session secrets
  - `CORS_ORIGINS`
  - optional AI/provider keys
- Confirm `CORS_ORIGINS` exactly includes the public Web origin.
- Confirm `NEXT_PUBLIC_API_BASE_URL` points at the public API URL and includes
  the API prefix expected by the Web app.
- Confirm Redis TLS expectations match the deployed Redis endpoint and app
  configuration.

## Database And Seed Data

- Run Prisma migrations against the deployed database before API rollout.
- Verify migration output.
- Seed required demo data for the public demo.
- Confirm the Balkona demo table slug is available:
  `/customer/table/balcona-main-t01`.

## ECS Rollout

- Deploy or update the API service.
- Deploy or update the Web service.
- Watch ECS service events.
- Watch CloudWatch logs for API startup, Prisma connection, Redis connection,
  and Web startup.
- Confirm ALB target groups are healthy.
- Confirm health checks are using the intended paths.

## Smoke Tests

Run:

```bash
WEB_BASE_URL=https://app.example.com \
API_BASE_URL=https://api.example.com \
./scripts/deploy/smoke-test-public-demo.sh
```

Or:

```powershell
.\scripts\deploy\smoke-test-public-demo.ps1 `
  -WEB_BASE_URL https://app.example.com `
  -API_BASE_URL https://api.example.com
```

Then manually verify:

- Customer demo launcher opens.
- Customer table flow opens.
- Customer can browse menu.
- Customer can add to cart.
- Customer can submit an order.
- Staff login works.
- Staff dashboard opens.
- Staff can see the demo order state expected for the current UI phase.

## Rollback Plan

Before public traffic:

- Record prior ECS task definition revisions.
- Keep prior known-good ECR image tags.
- Confirm rollback command access.
- Confirm database backup status.

If rollout fails:

- Stop new manual demo traffic.
- Revert ECS services to prior task definitions or image tags.
- Re-run smoke tests.
- Review CloudWatch logs.
- Do not apply additional Terraform changes until the failure is understood.
