param(
  [string]$WEB_BASE_URL = $env:WEB_BASE_URL,
  [string]$API_BASE_URL = $env:API_BASE_URL
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($WEB_BASE_URL) -or [string]::IsNullOrWhiteSpace($API_BASE_URL)) {
  Write-Error "Usage: .\scripts\deploy\smoke-test-public-demo.ps1 -WEB_BASE_URL https://app.example.com -API_BASE_URL https://api.example.com"
}

function Trim-TrailingSlash {
  param([Parameter(Mandatory = $true)][string]$Value)
  return $Value.TrimEnd("/")
}

function Get-HealthBaseUrl {
  param([Parameter(Mandatory = $true)][string]$ApiBaseUrl)

  $baseUrl = Trim-TrailingSlash -Value $ApiBaseUrl
  if ($baseUrl.EndsWith("/api/v1", [StringComparison]::OrdinalIgnoreCase)) {
    return $baseUrl.Substring(0, $baseUrl.Length - "/api/v1".Length)
  }

  return $baseUrl
}

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Url
  )

  Write-Host "Checking $Label: $Url"
  $response = Invoke-WebRequest -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
    throw "$Label returned HTTP $($response.StatusCode)"
  }

  Write-Host "ok - $Label"
}

$webBase = Trim-TrailingSlash -Value $WEB_BASE_URL
$healthBase = Get-HealthBaseUrl -ApiBaseUrl $API_BASE_URL

Test-Url -Label "API health" -Url "$healthBase/health"
Test-Url -Label "Web root" -Url "$webBase/"
Test-Url -Label "Balkona demo launcher" -Url "$webBase/demo/balkona"
Test-Url -Label "Demo customer table" -Url "$webBase/customer/table/balcona-main-t01"
Test-Url -Label "Staff login" -Url "$webBase/staff/login"

Write-Host "Public demo smoke test passed."
