# ZenTime Local QA k6 Load Tests

These tests are for local QA only. They intentionally refuse known production/test domains such as `iie.zentime.co.in`, `test2.zentime.co.in`, and AWS/RDS hostnames.

## Prerequisites

- Local QA backend running on `http://localhost:5001`
- Local QA MySQL only, not production or staging
- k6 installed locally
- A QA employee data file with enough unique employees for the target concurrency

The current sample file has only a few employees. To run 10, 25, 50, and 100 truly concurrent employees, create a local-only file with at least 100 QA employees. Do not use real employees or production credentials.

## Data File

Use `qa/k6/data/employees.sample.json` as the shape:

```json
[
  {
    "username": "qa.employee",
    "companyCode": "QA001",
    "clientId": 1,
    "employeeId": 1
  }
]
```

Pass the shared local QA password via environment variable or PowerShell parameter. Do not store real passwords in repository files.

## Run Login Load Tests

From the repository root:

```powershell
.\qa\k6\run-login-local.ps1 -BaseUrl "http://localhost:5001" -EmployeesFile "qa/k6/data/employees.local.json" -EmployeePassword "<local-qa-password>"
```

This runs 10, 25, 50, and 100 VU login tests.

## Run Attendance Load Tests

Attendance tests mutate local QA data. Use a fresh QA database seed or a fresh employee slice before each run.

```powershell
.\qa\k6\run-attendance-local.ps1 -BaseUrl "http://localhost:5001" -EmployeesFile "qa/k6/data/employees.local.json" -EmployeePassword "<local-qa-password>"
```

The attendance flow performs:

- employee login
- start day
- latest attendance record lookup
- time in upload
- duplicate time in check
- time out upload
- duplicate time out check
- attendance search consistency check

## Metrics

The scripts track:

- p95/p99 HTTP response time
- error rate
- 4xx count
- 5xx count
- login failure rate
- attendance failure rate
- duplicate attendance row rate

## CPU / Memory Observation

In another PowerShell window:

```powershell
.\qa\k6\observe-local.ps1
```

This samples local Java process CPU and memory where available.
