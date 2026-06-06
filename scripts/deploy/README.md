# Deployment Scripts

These scripts are Production Phase 3A and 3B readiness helpers. They do not
create AWS resources, run Terraform apply, start long-running servers, or push
images.

## Local Docker Image Build

PowerShell:

```powershell
.\scripts\deploy\build-images-local.ps1
```

Bash:

```bash
./scripts/deploy/build-images-local.sh
```

Optional environment variables:

- `API_IMAGE_TAG`, default `balcona-api:local`
- `WEB_IMAGE_TAG`, default `balcona-web:local`
- `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:3000/api/v1`

## Public Demo Smoke Test

PowerShell:

```powershell
.\scripts\deploy\smoke-test-public-demo.ps1 `
  -WEB_BASE_URL https://app.example.com `
  -API_BASE_URL https://api.example.com
```

Bash:

```bash
WEB_BASE_URL=https://app.example.com \
API_BASE_URL=https://api.example.com \
./scripts/deploy/smoke-test-public-demo.sh
```

The smoke scripts check:

- API `/health`
- Web `/`
- Web `/demo/balkona`
- Web `/customer/table/balcona-main-t01`
- Web `/staff/login`

If `API_BASE_URL` is provided as a browser API URL ending in `/api/v1`, the
scripts derive `/health` from the API origin because the health endpoint is not
under the API prefix.

## Staging Smoke Test

PowerShell:

```powershell
.\scripts\deploy\staging-smoke.ps1 `
  -WEB_BASE_URL https://staging.example.com `
  -API_BASE_URL https://api-staging.example.com/api/v1
```

Bash:

```bash
WEB_BASE_URL=https://staging.example.com \
API_BASE_URL=https://api-staging.example.com/api/v1 \
./scripts/deploy/staging-smoke.sh
```

The staging smoke scripts check:

- API `/health`
- API `/api/v1/system/info`
- Web `/`
- Web `/platform/login`
- Web `/platform/companies/new`
- Web `/staff/login`
- Web `/staff/setup`
- Web `/staff/billing`
- Web `/customer/table/balcona-main-t01`
- that fetched HTML does not contain `[object Object]`

These scripts do not log in, create cafes, submit orders, or require a real
payment gateway. Use `docs/deployment/staging-smoke-test.md` for the manual
authenticated flow.

## Terraform Local Validation

PowerShell:

```powershell
.\scripts\deploy\terraform-validate-local.ps1
```

Bash:

```bash
./scripts/deploy/terraform-validate-local.sh
```

These scripts run only:

- `terraform fmt -check -recursive infra/aws/terraform`
- `terraform init -backend=false`
- `terraform validate`

They do not run `terraform plan` or `terraform apply`.
