param(
  [string]$WEB_BASE_URL = $env:WEB_BASE_URL,
  [string]$API_BASE_URL = $env:API_BASE_URL
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($WEB_BASE_URL) -or [string]::IsNullOrWhiteSpace($API_BASE_URL)) {
  Write-Error "Usage: .\scripts\deploy\staging-smoke.ps1 -WEB_BASE_URL https://staging.example.com -API_BASE_URL https://api-staging.example.com/api/v1"
}

function Trim-TrailingSlash {
  param([Parameter(Mandatory = $true)][string]$Value)
  return $Value.TrimEnd("/")
}

function Get-ApiBaseUrl {
  param([Parameter(Mandatory = $true)][string]$ApiBaseUrl)

  $baseUrl = Trim-TrailingSlash -Value $ApiBaseUrl
  if ($baseUrl.EndsWith("/api/v1", [StringComparison]::OrdinalIgnoreCase)) {
    return $baseUrl
  }

  return "$baseUrl/api/v1"
}

function Get-ApiOriginUrl {
  param([Parameter(Mandatory = $true)][string]$ApiBaseUrl)

  $baseUrl = Trim-TrailingSlash -Value $ApiBaseUrl
  if ($baseUrl.EndsWith("/api/v1", [StringComparison]::OrdinalIgnoreCase)) {
    return $baseUrl.Substring(0, $baseUrl.Length - "/api/v1".Length)
  }

  return $baseUrl
}

function Assert-PermanentApiBaseUrl {
  param([Parameter(Mandatory = $true)][string]$ApiBaseUrl)

  $url = [System.Uri](Get-ApiBaseUrl -ApiBaseUrl $ApiBaseUrl)
  $hostName = $url.Host.ToLowerInvariant()
  $isLocalhost = $hostName -eq "localhost" -or
    $hostName -eq "127.0.0.1" -or
    $hostName -eq "::1" -or
    $hostName.EndsWith(".localhost")

  if ($isLocalhost -or $hostName.EndsWith(".trycloudflare.com")) {
    throw "Staging API URL must use the permanent Railway host, not $hostName"
  }
}

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Url
  )

  Write-Host "Checking ${Label}: $Url"
  $response = Invoke-WebRequest -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
    throw "$Label returned HTTP $($response.StatusCode)"
  }

  if ($response.Content -match "\[object Object\]") {
    throw "$Label rendered [object Object]"
  }

  Write-Host "ok - $Label"
}

$webBase = Trim-TrailingSlash -Value $WEB_BASE_URL
Assert-PermanentApiBaseUrl -ApiBaseUrl $API_BASE_URL
$apiBase = Get-ApiBaseUrl -ApiBaseUrl $API_BASE_URL
$apiOrigin = Get-ApiOriginUrl -ApiBaseUrl $API_BASE_URL

Test-Url -Label "API health" -Url "$apiOrigin/health"
Test-Url -Label "API system info" -Url "$apiBase/system/info"
Test-Url -Label "Web root" -Url "$webBase/"
Test-Url -Label "Platform login" -Url "$webBase/platform/login"
Test-Url -Label "Platform companies" -Url "$webBase/platform/companies"
Test-Url -Label "Platform status" -Url "$webBase/platform/status"
Test-Url -Label "Platform company creation page" -Url "$webBase/platform/companies/new"
Test-Url -Label "Staff login" -Url "$webBase/staff/login"
Test-Url -Label "Staff setup" -Url "$webBase/staff/setup"
Test-Url -Label "Staff menu admin" -Url "$webBase/staff/menu"
Test-Url -Label "Staff inventory" -Url "$webBase/staff/inventory"
Test-Url -Label "Staff branch and QR management" -Url "$webBase/staff/branches"
Test-Url -Label "Staff billing" -Url "$webBase/staff/billing"
Test-Url -Label "Demo customer table" -Url "$webBase/customer/table/balcona-main-t01"

Write-Host "Staging smoke test passed."
