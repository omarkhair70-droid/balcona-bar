param(
  [string]$ApiImageTag = $(if ($env:API_IMAGE_TAG) { $env:API_IMAGE_TAG } else { "balcona-api:local" }),
  [string]$WebImageTag = $(if ($env:WEB_IMAGE_TAG) { $env:WEB_IMAGE_TAG } else { "balcona-web:local" }),
  [string]$NextPublicApiBaseUrl = $(if ($env:NEXT_PUBLIC_API_BASE_URL) { $env:NEXT_PUBLIC_API_BASE_URL } else { "http://localhost:3000/api/v1" })
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repoRoot

try {
  Write-Host "Building API image: $ApiImageTag"
  docker build -f apps/api/Dockerfile -t $ApiImageTag .

  Write-Host "Building Web image: $WebImageTag"
  docker build `
    -f apps/web/Dockerfile `
    -t $WebImageTag `
    --build-arg "NEXT_PUBLIC_API_BASE_URL=$NextPublicApiBaseUrl" `
    .

  Write-Host "Local Docker image build completed."
}
finally {
  Pop-Location
}
