param(
  [string]$MysqlHost = "127.0.0.1",
  [int]$MysqlPort = 3307,
  [string]$MysqlUser = "zentimeqa",
  [string]$MysqlPassword = $env:ZENTIME_QA_MYSQL_PASSWORD,
  [string]$TenantDatabase = "tenant_qa001",
  [string]$SourceUsername = "qa.employee",
  [int]$EmployeeCount = 185,
  [string]$OutputFile = "qa/k6/data/employees.local.json"
)

$ErrorActionPreference = "Stop"

if (-not $MysqlPassword) {
  throw "Set ZENTIME_QA_MYSQL_PASSWORD or pass -MysqlPassword for the local QA MySQL container."
}

if ($MysqlHost -notin @("127.0.0.1", "localhost")) {
  throw "Refusing to seed load employees outside local QA MySQL. Host was: $MysqlHost"
}

$mysql = Get-Command mysql -ErrorAction Stop
$previousMysqlPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $MysqlPassword

try {
  $sql = @"
USE $TenantDatabase;
SET @source_password = (SELECT password FROM employee WHERE username = '$SourceUsername' LIMIT 1);
INSERT INTO employee (
  username, password, company_code, client_id, email_id, employee_code,
  first_name, last_name, mobile, gender, position, branch, week_off,
  shift_start_time, shift_end_time, shift_start, shift_end,
  leave_policy_type, casual_leave_balance, permission_allowance_per_month,
  permission_hours_allowed, salary
)
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < $EmployeeCount
)
SELECT
  CONCAT('qa.load', LPAD(n, 3, '0')),
  @source_password,
  'qa001',
  1,
  CONCAT('qa.load', LPAD(n, 3, '0'), '@example.test'),
  CONCAT('QALOAD', LPAD(n, 3, '0')),
  'QA Load',
  CONCAT('Employee ', LPAD(n, 3, '0')),
  CONCAT('900000', LPAD(n, 4, '0')),
  'Other',
  'QA',
  CASE WHEN MOD(n, 2) = 0 THEN 'QA Branch A' ELSE 'QA Branch B' END,
  'Sunday',
  '09:00',
  '18:00',
  '09:00',
  '18:00',
  'NONE',
  0,
  2,
  2,
  0
FROM seq
WHERE @source_password IS NOT NULL
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  client_id = VALUES(client_id),
  company_code = VALUES(company_code),
  branch = VALUES(branch),
  shift_start_time = VALUES(shift_start_time),
  shift_end_time = VALUES(shift_end_time);
"@

  $sql | & $mysql.Source -h $MysqlHost -P $MysqlPort -u $MysqlUser --batch --raw

  $query = @"
SELECT JSON_ARRAYAGG(JSON_OBJECT(
  'username', username,
  'companyCode', 'QA001',
  'clientId', client_id,
  'employeeId', id,
  'label', employee_code
))
FROM (
  SELECT id, username, client_id, employee_code
  FROM $TenantDatabase.employee
  WHERE username LIKE 'qa.load%'
  ORDER BY employee_code
  LIMIT $EmployeeCount
) load_employees;
"@

  $json = ($query | & $mysql.Source -h $MysqlHost -P $MysqlPort -u $MysqlUser --batch --raw --skip-column-names)
  if (-not $json -or $json -eq "NULL") {
    throw "No load-test employees were generated. Check that source QA employee '$SourceUsername' exists."
  }

  $resolvedOutput = Join-Path (Get-Location) $OutputFile
  $outputDir = Split-Path -Parent $resolvedOutput
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $json | ConvertFrom-Json | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

  $count = (Get-Content -LiteralPath $resolvedOutput -Raw | ConvertFrom-Json).Count
  Write-Host "Seeded $count local QA load employees into $TenantDatabase."
  Write-Host "Wrote k6 employee data to $resolvedOutput."
} finally {
  $env:MYSQL_PWD = $previousMysqlPwd
}
