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

assert_permanent_api_base_url() {
  local value host_port host

  value="$(api_base_url "$1")"
  host_port="${value#*://}"
  host_port="${host_port%%/*}"

  if [[ "${host_port}" == \[* ]]; then
    host="${host_port#\[}"
    host="${host%%\]*}"
  else
    host="${host_port%%:*}"
  fi

  host="${host,,}"

  if [[ "${host}" == "localhost" || "${host}" == "127.0.0.1" || "${host}" == "::1" || "${host}" == *.localhost || "${host}" == *.trycloudflare.com ]]; then
    echo "Staging API URL must use the permanent Railway host, not ${host}" >&2
    exit 1
  fi
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
assert_permanent_api_base_url "${API_BASE_URL}"
api_base="$(api_base_url "${API_BASE_URL}")"
api_origin="$(api_origin_url "${API_BASE_URL}")"

check_url "API health" "${api_origin}/health"
check_url "API system info" "${api_base}/system/info"
check_url "Web root" "${web_base}/"
check_url "Platform login" "${web_base}/platform/login"
check_url "Platform companies" "${web_base}/platform/companies"
check_url "Platform status" "${web_base}/platform/status"
check_url "Platform company creation page" "${web_base}/platform/companies/new"
check_url "Staff login" "${web_base}/staff/login"
check_url "Staff setup" "${web_base}/staff/setup"
check_url "Staff menu admin" "${web_base}/staff/menu"
check_url "Staff inventory" "${web_base}/staff/inventory"
check_url "Staff branch and QR management" "${web_base}/staff/branches"
check_url "Staff billing" "${web_base}/staff/billing"
check_url "Demo customer table" "${web_base}/customer/table/balcona-main-t01"

echo "Staging smoke test passed."
