#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-${1:-}}"
API_BASE_URL="${API_BASE_URL:-${2:-}}"

if [[ -z "${WEB_BASE_URL}" || -z "${API_BASE_URL}" ]]; then
  echo "Usage: WEB_BASE_URL=https://app.example.com API_BASE_URL=https://api.example.com ./scripts/deploy/smoke-test-public-demo.sh"
  echo "You may also pass WEB_BASE_URL and API_BASE_URL as the first two arguments."
  exit 1
fi

trim_trailing_slash() {
  local value="$1"
  while [[ "${value}" == */ ]]; do
    value="${value%/}"
  done
  printf '%s' "${value}"
}

web_base="$(trim_trailing_slash "${WEB_BASE_URL}")"
api_base="$(trim_trailing_slash "${API_BASE_URL}")"
health_base="${api_base}"

if [[ "${health_base}" == */api/v1 ]]; then
  health_base="${health_base%/api/v1}"
fi

check_url() {
  local label="$1"
  local url="$2"

  echo "Checking ${label}: ${url}"
  curl --fail --silent --show-error --location --max-time 20 "${url}" > /dev/null
  echo "ok - ${label}"
}

check_url "API health" "${health_base}/health"
check_url "Web root" "${web_base}/"
check_url "Balkona demo launcher" "${web_base}/demo/balkona"
check_url "Demo customer table" "${web_base}/customer/table/balcona-main-t01"
check_url "Staff login" "${web_base}/staff/login"

echo "Public demo smoke test passed."
