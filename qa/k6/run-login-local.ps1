param(
  [string]$BaseUrl = "http://localhost:5001",
  [string]$EmployeesFile = "qa/k6/data/employees.sample.json",
  [string]$EmployeePassword,
  [string]$Duration = "45s",
  [string]$K6Path = "qa/tools/k6-v0.51.0-windows-amd64/k6.exe",
  [string]$SummaryDir = "qa/k6/results"
)

$ErrorActionPreference = "Stop"

if ($BaseUrl -match "iie\.zentime\.co\.in|test2\.zentime\.co\.in|amazonaws\.com") {
  throw "Refusing to run load tests against non-local URL: $BaseUrl"
}

if (-not $EmployeePassword) {
  throw "Pass local QA password with -EmployeePassword or set ZENTIME_EMPLOYEE_PASSWORD before running."
}

$k6Command = if (Test-Path -LiteralPath $K6Path) { (Resolve-Path -LiteralPath $K6Path).Path } else { "k6" }
$resolvedEmployeesFile = (Resolve-Path -LiteralPath $EmployeesFile).Path

$env:ZENTIME_BASE_URL = $BaseUrl
$env:ZENTIME_EMPLOYEES_FILE = $resolvedEmployeesFile
$env:ZENTIME_EMPLOYEE_PASSWORD = $EmployeePassword
$env:ZENTIME_DURATION = $Duration
$env:ZENTIME_REQUIRE_UNIQUE_EMPLOYEES = "true"
$env:K6_SUMMARY_TREND_STATS = "avg,min,med,max,p(90),p(95),p(99)"

New-Item -ItemType Directory -Force -Path $SummaryDir | Out-Null

foreach ($concurrency in @(10, 25, 50, 100)) {
  $env:ZENTIME_CONCURRENCY = [string]$concurrency
  $summaryFile = Join-Path $SummaryDir "login-$concurrency.json"
  Write-Host "Running login load test at concurrency $concurrency against $BaseUrl"
  & $k6Command run --summary-export $summaryFile qa/k6/login.load.js
}
