#!/usr/bin/env bash
set -euo pipefail

API_ORIGIN="${API_ORIGIN:-https://balcona-api.158.101.254.30.sslip.io}"
WEB_ORIGIN="${WEB_ORIGIN:-https://balcona.158.101.254.30.sslip.io}"

trim_trailing_slash() {
  local value="$1"
  while [[ "${value}" == */ ]]; do
    value="${value%/}"
  done
  printf '%s' "${value}"
}

API_ORIGIN="$(trim_trailing_slash "${API_ORIGIN}")"
WEB_ORIGIN="$(trim_trailing_slash "${WEB_ORIGIN}")"
API_BASE="${API_ORIGIN}/api/v1"

echo "Oracle production preflight"
echo "API_ORIGIN=${API_ORIGIN}"
echo "WEB_ORIGIN=${WEB_ORIGIN}"

health_body="$(mktemp)"
info_body="$(mktemp)"
cors_headers="$(mktemp)"
trap 'rm -f "$health_body" "$info_body" "$cors_headers"' EXIT

curl --fail --silent --show-error --location --max-time 20   --output "${health_body}"   "${API_ORIGIN}/health"

echo "ok - API health"

curl --fail --silent --show-error --location --max-time 20   --output "${info_body}"   "${API_BASE}/system/info"

node - "${info_body}" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!data || typeof data !== "object") {
  throw new Error("system/info did not return an object");
}

console.log(
  JSON.stringify(
    {
      service: data.name,
      version: data.version,
      appEnvironment: data.appEnvironment ?? data.environment,
      nodeEnvironment: data.nodeEnvironment,
      apiPrefix: data.apiPrefix,
      gitSha: data.gitSha,
      timestamp: data.timestamp
    },
    null,
    2
  )
);
NODE

echo "ok - API system info"

curl --silent --show-error --max-time 20   --request OPTIONS   --header "Origin: ${WEB_ORIGIN}"   --header "Access-Control-Request-Method: GET"   --header "Access-Control-Request-Headers: authorization,content-type"   --dump-header "${cors_headers}"   --output /dev/null   "${API_BASE}/system/info"

allow_origin="$(
  awk 'BEGIN{IGNORECASE=1}
       /^access-control-allow-origin:/ {
         sub(/$/, "", $2);
         print $2
       }' "${cors_headers}" | tail -n1
)"

system_json="$(cat "${info_body}")"
app_env="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(String(d.appEnvironment ?? d.environment ?? ""))' "${system_json}")"
node_env="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(String(d.nodeEnvironment ?? ""))' "${system_json}")"

failures=0

if [[ "${allow_origin}" != "${WEB_ORIGIN}" ]]; then
  echo "CORS_NOT_READY: expected Access-Control-Allow-Origin: ${WEB_ORIGIN}" >&2
  echo "CORS_NOT_READY: got: ${allow_origin:-<missing>}" >&2
  failures=$((failures + 1))
else
  echo "ok - API CORS allows final Web origin"
fi

if [[ "${app_env}" != "production" ]]; then
  echo "APP_ENV_NOT_PRODUCTION: expected production, got ${app_env:-<missing>}" >&2
  failures=$((failures + 1))
else
  echo "ok - APP_ENV=production"
fi

if [[ "${node_env}" != "production" ]]; then
  echo "NODE_ENV_NOT_PRODUCTION: expected production, got ${node_env:-<missing>}" >&2
  failures=$((failures + 1))
else
  echo "ok - NODE_ENV=production"
fi

if [[ "${failures}" -gt 0 ]]; then
  echo "ORACLE_API_PREFLIGHT=FAIL blockers=${failures}" >&2
  exit 43
fi

echo "ORACLE_API_PREFLIGHT=PASS"
