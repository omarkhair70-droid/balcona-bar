#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

API_IMAGE_TAG="${API_IMAGE_TAG:-balcona-api:local}"
WEB_IMAGE_TAG="${WEB_IMAGE_TAG:-balcona-web:local}"
NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:3000/api/v1}"

cd "${REPO_ROOT}"

echo "Building API image: ${API_IMAGE_TAG}"
docker build -f apps/api/Dockerfile -t "${API_IMAGE_TAG}" .

echo "Building Web image: ${WEB_IMAGE_TAG}"
docker build \
  -f apps/web/Dockerfile \
  -t "${WEB_IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
  .

echo "Local Docker image build completed."
