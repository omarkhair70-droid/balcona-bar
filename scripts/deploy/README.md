# Deployment Scripts

These scripts are Production Phase 3A readiness helpers. They do not create AWS
resources, run Terraform apply, start long-running servers, or push images.

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
