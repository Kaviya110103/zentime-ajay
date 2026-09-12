import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { assertLocalQaBaseUrl, buildUrl, loadEmployees, normalizeBaseUrl, selectEmployee, todayParts } from './lib/qa-guards.js';

const BASE_URL = assertLocalQaBaseUrl(__ENV.ZENTIME_BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:5001');
const CONCURRENCY = Number(__ENV.ZENTIME_CONCURRENCY || __ENV.K6_CONCURRENCY || 10);
const employees = loadEmployees(CONCURRENCY);
const photo = open(__ENV.ZENTIME_ATTENDANCE_PHOTO || __ENV.K6_ATTENDANCE_PHOTO || '../postman/fixtures/attendance-photo.txt', 'b');

export const startDayDuration = new Trend('zentime_start_day_duration_ms', true);
export const timeInDuration = new Trend('zentime_time_in_duration_ms', true);
export const timeOutDuration = new Trend('zentime_time_out_duration_ms', true);
export const attendanceFailureRate = new Rate('zentime_attendance_failure_rate');
export const duplicateRowRate = new Rate('zentime_duplicate_attendance_row_rate');
export const http4xx = new Counter('zentime_http_4xx');
export const http5xx = new Counter('zentime_http_5xx');

export let options = {
  scenarios: {
    attendance_flow_once_per_employee: {
      executor: 'per-vu-iterations',
      vus: CONCURRENCY,
      iterations: 1,
      maxDuration: __ENV.ZENTIME_MAX_DURATION || __ENV.K6_MAX_DURATION || '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<4000', 'p(99)<7000'],
    http_req_failed: ['rate<0.05'],
    zentime_start_day_duration_ms: ['p(95)<3000', 'p(99)<5000'],
    zentime_time_in_duration_ms: ['p(95)<5000', 'p(99)<8000'],
    zentime_time_out_duration_ms: ['p(95)<5000', 'p(99)<8000'],
    zentime_attendance_failure_rate: ['rate<0.05'],
    zentime_duplicate_attendance_row_rate: ['rate==0'],
  },
};

export function setup() {
  return {
    baseUrl: normalizeBaseUrl(BASE_URL),
    employeeCount: employees.length,
    concurrency: CONCURRENCY,
  };
}

function countStatus(response) {
  if (response.status >= 400 && response.status < 500) http4xx.add(1);
  if (response.status >= 500) http5xx.add(1);
}

function parseJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function getLatestRecord(employee) {
  const response = http.get(
    buildUrl(BASE_URL, `/api/attendance/latest-today-or-yesterday/${employee.employeeId}`, { clientId: employee.clientId }),
    {
      headers: { 'X-QA-Load-Test': 'zentime-attendance' },
      tags: { endpoint: '/api/attendance/latest-today-or-yesterday', action: 'get-latest-record' },
    }
  );
  countStatus(response);
  return parseJson(response, {});
}

function upload(endpoint, recordId, fieldName, employee, duplicate) {
  const response = http.post(
    buildUrl(BASE_URL, endpoint, { clientId: employee.clientId }),
    {
      recordId: String(recordId),
      [fieldName]: http.file(photo, `${fieldName}.jpg`, 'image/jpeg'),
    },
    {
      headers: { 'X-QA-Load-Test': 'zentime-attendance' },
      tags: {
        endpoint,
        action: duplicate ? `${fieldName}-duplicate` : fieldName,
        clientId: String(employee.clientId),
        employeeId: String(employee.employeeId),
      },
    }
  );
  countStatus(response);
  return response;
}

export default function () {
  const employee = selectEmployee(employees);
  let failed = false;

  const loginResponse = http.post(
    buildUrl(BASE_URL, '/api/employees/login'),
    JSON.stringify({
      username: employee.username,
      password: employee.password,
      companyCode: employee.companyCode,
    }),
    {
      headers: { 'Content-Type': 'application/json', 'X-QA-Load-Test': 'zentime-attendance' },
      tags: { endpoint: '/api/employees/login', action: 'employee-login-before-attendance' },
    }
  );
  countStatus(loginResponse);
  failed = !check(loginResponse, { 'attendance login HTTP 200': (r) => r.status === 200 }) || failed;

  const startResponse = http.put(
    buildUrl(BASE_URL, '/api/attendance/start-day', {
      employeeId: employee.employeeId,
      clientId: employee.clientId,
      location: 'QA Load Test Office',
    }),
    null,
    {
      headers: { 'X-QA-Load-Test': 'zentime-attendance' },
      tags: { endpoint: '/api/attendance/start-day', action: 'start-day' },
    }
  );
  startDayDuration.add(startResponse.timings.duration);
  countStatus(startResponse);
  failed = !check(startResponse, {
    'start day controlled response': (r) => [200, 400, 403, 409].includes(r.status),
    'start day no server error': (r) => r.status < 500,
  }) || failed;

  const latest = getLatestRecord(employee);
  const recordId = Number(latest && latest.id);
  failed = !check(latest, {
    'latest attendance has record id': () => Number.isFinite(recordId) && recordId > 0,
  }) || failed;

  if (Number.isFinite(recordId) && recordId > 0) {
    const timeIn = upload('/api/attendance/mark-time-in', recordId, 'imageIn', employee, false);
    timeInDuration.add(timeIn.timings.duration);
    failed = !check(timeIn, {
      'time in controlled response': (r) => [200, 400, 403, 404, 409].includes(r.status),
      'time in no server error': (r) => r.status < 500,
    }) || failed;

    const duplicateTimeIn = upload('/api/attendance/mark-time-in', recordId, 'imageIn', employee, true);
    failed = !check(duplicateTimeIn, {
      'duplicate time in rejected or already controlled': (r) => [400, 403, 404, 409].includes(r.status),
      'duplicate time in no server error': (r) => r.status < 500,
    }) || failed;

    const timeOut = upload('/api/attendance/mark-time-out', recordId, 'imageOut', employee, false);
    timeOutDuration.add(timeOut.timings.duration);
    failed = !check(timeOut, {
      'time out controlled response': (r) => [200, 400, 403, 404, 409].includes(r.status),
      'time out no server error': (r) => r.status < 500,
    }) || failed;

    const duplicateTimeOut = upload('/api/attendance/mark-time-out', recordId, 'imageOut', employee, true);
    failed = !check(duplicateTimeOut, {
      'duplicate time out rejected or already controlled': (r) => [400, 403, 404, 409].includes(r.status),
      'duplicate time out no server error': (r) => r.status < 500,
    }) || failed;
  }

  const { month, year } = todayParts();
  const searchResponse = http.get(
    buildUrl(BASE_URL, '/api/attendance-records/search', {
      clientId: employee.clientId,
      employeeId: employee.employeeId,
      month,
      year,
      limit: 5000,
    }),
    {
      headers: { 'X-QA-Load-Test': 'zentime-attendance' },
      tags: { endpoint: '/api/attendance-records/search', action: 'attendance-consistency-search' },
    }
  );
  countStatus(searchResponse);

  const rows = parseJson(searchResponse, []);
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayKeys = [`${dd}/${mm}/${yyyy}`, `${yyyy}-${mm}-${dd}`];
  const sameDayRows = Array.isArray(rows)
    ? rows.filter((row) => todayKeys.includes(String(row.date || row.attendanceDate || '').trim()))
    : [];
  const hasDuplicateRows = sameDayRows.length > 1;
  duplicateRowRate.add(hasDuplicateRows);

  failed = !check(searchResponse, {
    'attendance search HTTP 200': (r) => r.status === 200,
    'attendance search response is array': () => Array.isArray(rows),
    'no duplicate attendance rows for employee today': () => !hasDuplicateRows,
  }) || failed;

  attendanceFailureRate.add(failed);
}
