$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$terraformDir = Join-Path $repoRoot "infra\aws\terraform"

Push-Location $repoRoot

try {
  Write-Host "Checking Terraform formatting..."
  terraform fmt -check -recursive infra/aws/terraform

  Write-Host "Initializing Terraform without backend..."
  Push-Location $terraformDir
  try {
    terraform init -backend=false

    Write-Host "Validating Terraform..."
    terraform validate
  }
  finally {
    Pop-Location
  }

  Write-Host "Terraform local validation passed."
}
finally {
  Pop-Location
}
