# Oracle + Coolify Production Closure

Balcona production topology for this closure:

- Host: Oracle Cloud VM managed by Coolify.
- Existing API: `https://balcona-api.158.101.254.30.sslip.io`.
- Browser API base: `https://balcona-api.158.101.254.30.sslip.io/api/v1`.
- Web target: `https://balcona.158.101.254.30.sslip.io`.
- API container port: `3000`.
- Web container port: `3001`.
- Web Dockerfile: `apps/web/Dockerfile`.

## Coolify Web Resource

Create a separate application in the existing **balcona bar / production**
project. Do not combine it with the API container.

Use:

```text
Repository: omarkhair70-droid/balcona-bar
Branch: main
Build type: Dockerfile
Dockerfile: /apps/web/Dockerfile
Build context: repository root
Port: 3001
Domain: https://balcona.158.101.254.30.sslip.io
Health path: /
```

Build-time public variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://balcona-api.158.101.254.30.sslip.io/api/v1
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_GIT_SHA=<main commit being deployed>
NEXT_PUBLIC_BUILD_TIME=<build timestamp>
```

These are browser-visible and must not contain secrets.

## Existing API Resource Change

The API must allow the final Web origin:

```text
CORS_ORIGINS=https://balcona.158.101.254.30.sslip.io
```

If `CORS_ORIGINS` already contains other intentional origins, append the Web
origin instead of deleting them.

No database, Redis, payment-provider, or PlatformAdmin secret is required on
the Web resource.

## Deployment Gates

Before final closure, verify:

1. Web image builds from `apps/web/Dockerfile`.
2. Web container is healthy on port `3001`.
3. HTTPS is issued for the Web domain.
4. `/health` and `/api/v1/system/info` remain healthy on the API domain.
5. Browser calls from the Web origin to the API origin pass CORS.
6. `/platform/status` reports a permanent API target and production app env.
7. Guest, Service, Kitchen, Office, Setup, and Platform routes load without
   console or network-origin errors.
8. No Web deployment changes PAY-8 or claims external provider activation.

## Public Smoke

Run:

```bash
WEB_BASE_URL=https://balcona.158.101.254.30.sslip.io \
API_BASE_URL=https://balcona-api.158.101.254.30.sslip.io/api/v1 \
./scripts/deploy/staging-smoke.sh
```

The script name is historical; the supplied URLs determine the target. Final
production QA additionally requires authenticated and browser-level checks.
