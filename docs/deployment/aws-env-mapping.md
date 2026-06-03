# AWS Environment Mapping

This document maps current Balcona Bar runtime variables to AWS deployment
sources. It is documentation only; do not commit real values.

| Variable | Runtime | AWS location | Example |
| --- | --- | --- | --- |
| `NODE_ENV` | API, Web | ECS task environment | `production` |
| `PORT` | API, Web | ECS task environment | API `3000`, Web `3001` |
| `API_PREFIX` | API | ECS task environment | `api/v1` |
| `NEXT_PUBLIC_API_BASE_URL` | Web | ECS task environment and Web image build arg | `https://api.example.com/api/v1` |
| `CORS_ORIGINS` | API | ECS task environment | `https://app.example.com` |
| `DATABASE_URL` | API | Secrets Manager | `postgresql://...` |
| `REDIS_URL` | API | Secrets Manager | `rediss://...` when Redis TLS is enabled |
| `STAFF_AUTH_SESSION_HOURS` | API | ECS task environment | `12` |
| `STAFF_AUTH_DEV_BOOTSTRAP_ENABLED` | API | ECS task environment | `false` |
| `CUSTOMER_ACCESS_TOKEN_HOURS` | API | ECS task environment | `24` |
| `SWAGGER_ENABLED` | API | ECS task environment | `false` |
| `JOBS_ENABLED` | API | ECS task environment | `true` |
| `OPENAI_API_KEY` | future API integration | Secrets Manager | unset until a future AI phase |
| `ANTHROPIC_API_KEY` | future API integration | Secrets Manager | unset until a future AI phase |

## Notes

- `NEXT_PUBLIC_API_BASE_URL` is public and browser-visible. It still must be
  correct because customer/staff browsers call it directly.
- `CORS_ORIGINS` must include every deployed web origin that should be allowed
  to call the API.
- Current staff and customer tokens are opaque database-backed tokens stored as
  hashes. No JWT signing secret is required in the current backend.
- RDS credentials should be managed by AWS, and the final `DATABASE_URL` should
  be injected from Secrets Manager.
- If ElastiCache transit encryption is enabled, use `rediss://` for `REDIS_URL`.
