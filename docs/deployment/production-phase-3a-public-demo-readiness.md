# Production Phase 3A Public Demo Readiness

Production Phase 3A prepares Balcona Bar for the first real public AWS demo
deploy. It adds CI/CD guardrails, Docker build validation, Terraform validation,
public smoke test scripts, and deploy runbooks.

This is readiness work only. It does not create AWS resources, apply Terraform,
push images, populate secrets, run migrations against a real database, or expose
a public link.

## Goal

- Catch application build and test failures before merge.
- Catch API/Web Docker image build failures before deploy day.
- Validate Terraform formatting and syntax without AWS credentials.
- Provide a safe ECR push example for a future manual image release.
- Provide public smoke test scripts for the first demo environment.
- Document the Phase 3B path from reviewed infrastructure to public demo.

## CI Workflow

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`.

It uses Node.js 22, Corepack, and pnpm, then runs:

```bash
pnpm install --frozen-lockfile
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
```

The workflow does not require database, Redis, AWS, or AI provider credentials.

## Docker Build Validation

`.github/workflows/docker-build.yml` runs on pull requests and manual dispatch.

It builds:

- API image from `apps/api/Dockerfile`
- Web image from `apps/web/Dockerfile`

The Web image build passes a placeholder
`NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1`. This validates the
Docker build path only; it is not the public demo value.

The workflow does not push images and does not require AWS credentials.

## Terraform Validation

`.github/workflows/terraform-validate.yml` runs for Terraform changes on pull
requests, pushes to `main`, and manual dispatch.

It runs:

```bash
terraform fmt -check -recursive infra/aws/terraform
cd infra/aws/terraform
terraform init -backend=false
terraform validate
```

It does not run `terraform plan` or `terraform apply`, and it does not configure
AWS credentials. Provider download still depends on the GitHub runner reaching
the Terraform registry.

## ECR Push Example

`.github/workflows/aws-ecr-push.example.yml` is a manual example workflow for a
future Phase 3B image push.

Before it can be used, configure GitHub secrets:

- `AWS_REGION`
- `API_ECR_REPOSITORY`
- `WEB_ECR_REPOSITORY`
- `NEXT_PUBLIC_API_BASE_URL`
- `AWS_ROLE_TO_ASSUME`, or `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

The workflow shows how to:

- authenticate to AWS
- log in to ECR
- build the API image
- build the Web image with the final public API base URL
- push both tagged images
- print the pushed tags to the workflow summary

It is intentionally manual and does not run automatically on push or pull
request.

## Deployment Scripts

Scripts live in `scripts/deploy`.

- `build-images-local.ps1`
- `build-images-local.sh`
- `smoke-test-public-demo.ps1`
- `smoke-test-public-demo.sh`

The build scripts validate local Docker builds only. They do not push images.

The smoke scripts accept:

- `WEB_BASE_URL`
- `API_BASE_URL`

They check:

- API `/health`
- Web `/`
- Web `/demo/balkona`
- Web `/customer/table/balcona-main-t01`
- Web `/staff/login`

## AWS Prerequisites For Phase 3B

Before the first real public demo deploy:

- Choose the AWS account and region.
- Choose public web and API domains or subdomains.
- Configure budget alerts manually before creating paid resources.
- Decide whether private ECS subnets use a NAT gateway or VPC endpoints.
- Review the Terraform variables for sizing, retention, and deletion
  protection.
- Create or confirm ACM certificate and DNS strategy.
- Build and push API/Web images to ECR.
- Populate Secrets Manager values for `DATABASE_URL`, `REDIS_URL`, JWT/session
  secrets, CORS origins, and optional AI provider keys.
- Run Prisma migrations before API rollout.
- Confirm demo seed data exists before public smoke testing.
- Set `NEXT_PUBLIC_API_BASE_URL` to the final public API URL at Web build time.

## Public Smoke Test Flow

After Phase 3B deploys a real environment:

1. Run API `/health`.
2. Load the Web root.
3. Load `/demo/balkona`.
4. Load `/customer/table/balcona-main-t01`.
5. Load `/staff/login`.
6. Walk a customer order path using demo data.
7. Log in as staff and verify the relevant dashboard opens.

The scripts cover the first five checks. Human verification remains required for
order and staff workflows.

## Rollback Readiness

Before public demo traffic:

- Keep the previous working image tags available in ECR.
- Record the current ECS task definition revisions.
- Confirm ECS service rollback commands are ready.
- Keep database migrations reviewed and reversible where possible.
- Avoid destructive demo data changes during smoke testing.

If the deploy fails, roll ECS services back to the prior task definition or image
tag, then re-run the smoke scripts.

## Known Risks Before Real Deploy

- ECS private subnets need NAT gateway or VPC endpoints for ECR image pulls,
  CloudWatch Logs, and Secrets Manager access.
- NAT gateway has a continuous cost profile; VPC endpoints can reduce exposure
  but add setup detail.
- `NEXT_PUBLIC_API_BASE_URL` must be final at Web build time because it is
  embedded in the browser bundle.
- `DATABASE_URL` and `REDIS_URL` must be populated in Secrets Manager before API
  tasks can run successfully.
- Prisma migrations must run before API rollout.
- Demo seed data must exist before the public demo.
- `CORS_ORIGINS` must match the public web origin.
- Terraform provider download can fail in CI if the Terraform registry is
  unavailable, even without AWS credentials.
