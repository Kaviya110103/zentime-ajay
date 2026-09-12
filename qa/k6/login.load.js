import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { assertLocalQaBaseUrl, buildUrl, loadEmployees, normalizeBaseUrl, selectEmployee } from './lib/qa-guards.js';

const BASE_URL = assertLocalQaBaseUrl(__ENV.ZENTIME_BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:5001');
const CONCURRENCY = Number(__ENV.ZENTIME_CONCURRENCY || __ENV.K6_CONCURRENCY || 10);
const DURATION = __ENV.ZENTIME_DURATION || __ENV.K6_DURATION || '45s';
const employees = loadEmployees(CONCURRENCY);

export const loginDuration = new Trend('zentime_login_duration_ms', true);
export const loginFailureRate = new Rate('zentime_login_failure_rate');
export const http4xx = new Counter('zentime_http_4xx');
export const http5xx = new Counter('zentime_http_5xx');

export let options = {
  scenarios: {
    employee_login: {
      executor: 'constant-vus',
      vus: CONCURRENCY,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    zentime_login_duration_ms: ['p(95)<3000', 'p(99)<5000'],
    zentime_login_failure_rate: ['rate<0.01'],
  },
};

export function setup() {
  return {
    baseUrl: normalizeBaseUrl(BASE_URL),
    employeeCount: employees.length,
    concurrency: CONCURRENCY,
  };
}

export default function () {
  const employee = selectEmployee(employees);
  const url = buildUrl(BASE_URL, '/api/employees/login');
  const payload = JSON.stringify({
    username: employee.username,
    password: employee.password,
    companyCode: employee.companyCode,
  });

  const response = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-QA-Load-Test': 'zentime-login',
    },
    tags: {
      endpoint: '/api/employees/login',
      action: 'employee-login',
      clientId: String(employee.clientId),
    },
  });

  loginDuration.add(response.timings.duration);
  if (response.status >= 400 && response.status < 500) http4xx.add(1);
  if (response.status >= 500) http5xx.add(1);

  let body = null;
  try {
    body = response.json();
  } catch (_) {
    body = null;
  }

  const ok = check(response, {
    'login HTTP 200': (r) => r.status === 200,
    'login returns employee id': () => body && Number(body.id) === employee.employeeId,
    'login returns expected client id': () => body && Number(body.clientId) === employee.clientId,
    'login does not expose password property': () => body && !Object.prototype.hasOwnProperty.call(body, 'password'),
    'login does not expose hash text': (r) => !/"password"\s*:|\$2[aby]\$/i.test(r.body || ''),
  });

  loginFailureRate.add(!ok);
  sleep(1);
}
