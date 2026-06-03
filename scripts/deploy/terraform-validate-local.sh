#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/infra/aws/terraform"

cd "${REPO_ROOT}"

echo "Checking Terraform formatting..."
terraform fmt -check -recursive infra/aws/terraform

echo "Initializing Terraform without backend..."
cd "${TERRAFORM_DIR}"
terraform init -backend=false

echo "Validating Terraform..."
terraform validate

echo "Terraform local validation passed."
