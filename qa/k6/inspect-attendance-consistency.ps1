param(
  [string]$MysqlHost = "127.0.0.1",
  [int]$MysqlPort = 3307,
  [string]$MysqlUser = "zentimeqa",
  [string]$MysqlPassword = $env:ZENTIME_QA_MYSQL_PASSWORD,
  [string]$TenantDatabase = "tenant_qa001"
)

$ErrorActionPreference = "Stop"

if (-not $MysqlPassword) {
  throw "Set ZENTIME_QA_MYSQL_PASSWORD or pass -MysqlPassword for the local QA MySQL container."
}

if ($MysqlHost -notin @("127.0.0.1", "localhost")) {
  throw "Refusing to inspect non-local QA MySQL. Host was: $MysqlHost"
}

$mysql = Get-Command mysql -ErrorAction Stop
$previousMysqlPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $MysqlPassword

try {
  $sql = @"
SELECT COUNT(*) AS load_employee_count
FROM $TenantDatabase.employee
WHERE username LIKE 'qa.load%';

SELECT date, COUNT(*) AS rows_for_load_employees
FROM $TenantDatabase.attendance_record ar
JOIN $TenantDatabase.employee e ON e.id = ar.employee_id
WHERE e.username LIKE 'qa.load%'
GROUP BY date
ORDER BY date DESC
LIMIT 5;

SELECT ar.employee_id, ar.date, COUNT(*) AS duplicate_rows
FROM $TenantDatabase.attendance_record ar
JOIN $TenantDatabase.employee e ON e.id = ar.employee_id
WHERE e.username LIKE 'qa.load%'
GROUP BY ar.employee_id, ar.date
HAVING COUNT(*) > 1
ORDER BY duplicate_rows DESC, ar.employee_id
LIMIT 20;
"@

  $sql | & $mysql.Source -h $MysqlHost -P $MysqlPort -u $MysqlUser --table
} finally {
  $env:MYSQL_PWD = $previousMysqlPwd
}
