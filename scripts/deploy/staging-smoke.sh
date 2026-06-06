#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-${1:-}}"
API_BASE_URL="${API_BASE_URL:-${2:-}}"

if [[ -z "${WEB_BASE_URL}" || -z "${API_BASE_URL}" ]]; then
  echo "Usage: WEB_BASE_URL=https://staging.example.com API_BASE_URL=https://api-staging.example.com/api/v1 ./scripts/deploy/staging-smoke.sh"
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

api_base_url() {
  local value
  value="$(trim_trailing_slash "$1")"
  if [[ "${value}" == */api/v1 ]]; then
    printf '%s' "${value}"
    return
  fi

  printf '%s/api/v1' "${value}"
}

api_origin_url() {
  local value
  value="$(trim_trailing_slash "$1")"
  if [[ "${value}" == */api/v1 ]]; then
    printf '%s' "${value%/api/v1}"
    return
  fi

  printf '%s' "${value}"
}

check_url() {
  local label="$1"
  local url="$2"
  local body

  echo "Checking ${label}: ${url}"
  body="$(curl --fail --silent --show-error --location --max-time 20 "${url}")"
  if [[ "${body}" == *"[object Object]"* ]]; then
    echo "${label} rendered [object Object]" >&2
    exit 1
  fi
  echo "ok - ${label}"
}

web_base="$(trim_trailing_slash "${WEB_BASE_URL}")"
api_base="$(api_base_url "${API_BASE_URL}")"
api_origin="$(api_origin_url "${API_BASE_URL}")"

check_url "API health" "${api_origin}/health"
check_url "API system info" "${api_base}/system/info"
check_url "Web root" "${web_base}/"
check_url "Platform login" "${web_base}/platform/login"
check_url "Platform company creation page" "${web_base}/platform/companies/new"
check_url "Staff login" "${web_base}/staff/login"
check_url "Staff setup" "${web_base}/staff/setup"
check_url "Staff billing" "${web_base}/staff/billing"
check_url "Demo customer table" "${web_base}/customer/table/balcona-main-t01"

echo "Staging smoke test passed."
