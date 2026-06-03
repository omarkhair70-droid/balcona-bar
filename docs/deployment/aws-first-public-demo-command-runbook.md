# AWS First Public Demo Command Runbook

This runbook is a placeholder-driven command pack for the first public AWS demo
deploy. It must be reviewed with real approved values before use.

Do not commit filled secrets, real account IDs, real domains, or generated
Terraform state files.

## Placeholders

Replace these locally or in a secure operator shell:

```bash
export AWS_REGION="<aws-region>"
export AWS_ACCOUNT_ID="<aws-account-id>"
export WEB_BASE_URL="https://app.example.com"
export API_BASE_URL="https://api.example.com"
export NEXT_PUBLIC_API_BASE_URL="https://api.example.com/api/v1"
export API_ECR_REPOSITORY="balcona-bar-staging-api"
export WEB_ECR_REPOSITORY="balcona-bar-staging-web"
export IMAGE_TAG="<git-sha-or-release-tag>"
```

## AWS Identity Check

```bash
aws sts get-caller-identity
aws configure get region
```

Confirm the returned account and region match the approved deploy decision
document.

## Terraform Init, Format, Validate, And Plan

```bash
cd infra/aws/terraform
cp terraform.staging.tfvars.example terraform.staging.tfvars
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var-file=terraform.staging.tfvars -out=tfplan
```

Review the plan before any apply. Do not commit `terraform.staging.tfvars` or
`tfplan`.

## ECR Login

```bash
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
```

## Docker Build API

```bash
docker build \
  -f apps/api/Dockerfile \
  -t "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPOSITORY}:${IMAGE_TAG}" \
  .
```

## Docker Build Web

```bash
docker build \
  -f apps/web/Dockerfile \
  -t "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPOSITORY}:${IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
  .
```

`NEXT_PUBLIC_API_BASE_URL` must be final at Web build time.

## Docker Push

DO NOT RUN UNTIL APPROVED.

```bash
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_ECR_REPOSITORY}:${IMAGE_TAG}"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_ECR_REPOSITORY}:${IMAGE_TAG}"
```

## Update Tfvars Image URIs

Edit `infra/aws/terraform/terraform.staging.tfvars` locally:

```hcl
api_image_uri = "<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/balcona-bar-staging-api:<image-tag>"
web_image_uri = "<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/balcona-bar-staging-web:<image-tag>"
```

Keep this file local or in an approved secure environment.

## Terraform Plan Review

```bash
cd infra/aws/terraform
terraform plan -var-file=terraform.staging.tfvars -out=tfplan
terraform show tfplan
```

Review:

- paid resources
- NAT Gateway or VPC endpoint decision
- security group ingress and egress
- RDS deletion protection and final snapshot behavior
- ECS task image URIs
- public origins and CORS values
- log retention

## Terraform Apply

DO NOT RUN UNTIL APPROVED.

```bash
cd infra/aws/terraform
terraform apply tfplan
```

## Populate Secrets Manager Values

DO NOT RUN UNTIL APPROVED.

Use AWS Console or approved CLI commands to populate:

- `DATABASE_URL`
- `REDIS_URL`
- staff/session secrets required by the final environment
- `CORS_ORIGINS`
- optional AI/provider keys

Example shape only:

```bash
aws secretsmanager put-secret-value \
  --secret-id "<secret-name>" \
  --secret-string "<approved-secret-value>"
```

Do not paste real secret values into PRs, docs, screenshots, or logs.

## Run Prisma Migrate Deploy

DO NOT RUN UNTIL APPROVED.

From an approved environment with secure database access:

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm api:prisma:migrate:deploy
```

See `docs/deployment/aws-prisma-migration-runner.md` before choosing where this
runs.

## Force ECS Rollout

DO NOT RUN UNTIL APPROVED.

```bash
aws ecs update-service \
  --cluster "<ecs-cluster-name>" \
  --service "<api-service-name>" \
  --force-new-deployment

aws ecs update-service \
  --cluster "<ecs-cluster-name>" \
  --service "<web-service-name>" \
  --force-new-deployment
```

Watch ECS events, target group health, and CloudWatch logs after rollout.

## Run Smoke Test Scripts

```bash
WEB_BASE_URL="${WEB_BASE_URL}" \
API_BASE_URL="${API_BASE_URL}" \
./scripts/deploy/smoke-test-public-demo.sh
```

PowerShell:

```powershell
.\scripts\deploy\smoke-test-public-demo.ps1 `
  -WEB_BASE_URL "https://app.example.com" `
  -API_BASE_URL "https://api.example.com"
```

Then manually verify the customer table flow, cart submit flow, staff login, and
staff dashboard visibility.

## Rollback Commands Outline

DO NOT RUN UNTIL APPROVED.

Record the previous task definitions before rollout, then use the approved
previous values if rollback is needed:

```bash
aws ecs update-service \
  --cluster "<ecs-cluster-name>" \
  --service "<api-service-name>" \
  --task-definition "<previous-api-task-definition>"

aws ecs update-service \
  --cluster "<ecs-cluster-name>" \
  --service "<web-service-name>" \
  --task-definition "<previous-web-task-definition>"
```

After rollback:

```bash
WEB_BASE_URL="${WEB_BASE_URL}" \
API_BASE_URL="${API_BASE_URL}" \
./scripts/deploy/smoke-test-public-demo.sh
```
