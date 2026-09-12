const BLOCKED_HOST_PATTERNS = [
  /iie\.zentime\.co\.in/i,
  /iieadmin\.zentime\.co\.in/i,
  /iiesuperadmin\.zentime\.co\.in/i,
  /test2\.zentime\.co\.in/i,
  /amazonaws\.com/i,
  /rds\.amazonaws\.com/i,
];

const ALLOWED_LOCAL_PATTERNS = [
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^http:\/\/10\.0\.2\.2(?::\d+)?$/i,
  /^http:\/\/192\.168\.\d+\.\d+(?::\d+)?$/i,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(?::\d+)?$/i,
  /^http:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$/i,
];

export function normalizeBaseUrl(raw) {
  return String(raw || 'http://localhost:5001').trim().replace(/\/+$/, '');
}

export function assertLocalQaBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error(`Refusing to run k6 load tests against non-local URL: ${normalized}`);
  }
  if (!ALLOWED_LOCAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error(`QA load tests require a local/LAN HTTP URL. Received: ${normalized}`);
  }
  return normalized;
}

export function buildUrl(baseUrl, path, query = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return params ? `${url}?${params}` : url;
}

export function loadEmployees(requiredCount) {
  const dataFile = __ENV.ZENTIME_EMPLOYEES_FILE || __ENV.K6_EMPLOYEES_FILE || 'qa/k6/data/employees.sample.json';
  const sharedPassword = __ENV.ZENTIME_EMPLOYEE_PASSWORD || __ENV.K6_EMPLOYEE_PASSWORD;
  const offset = Math.max(0, Number(__ENV.ZENTIME_EMPLOYEE_OFFSET || __ENV.K6_EMPLOYEE_OFFSET || 0));
  const raw = open(dataFile);
  const employees = JSON.parse(raw).slice(offset);

  if (!Array.isArray(employees) || employees.length === 0) {
    throw new Error(`No QA employees found in ${dataFile}`);
  }

  const normalized = employees.map((employee, index) => ({
    username: employee.username,
    password: employee.password || sharedPassword,
    companyCode: employee.companyCode || __ENV.ZENTIME_COMPANY_CODE || __ENV.K6_COMPANY_CODE || 'QA001',
    clientId: Number(employee.clientId || __ENV.ZENTIME_CLIENT_ID || __ENV.K6_CLIENT_ID || 1),
    employeeId: Number(employee.employeeId || employee.id),
    label: employee.label || `employee-${index + 1}`,
  }));

  const missing = normalized.find((employee) => (
    !employee.username ||
    !employee.password ||
    !employee.companyCode ||
    !Number.isFinite(employee.clientId) ||
    !Number.isFinite(employee.employeeId)
  ));
  if (missing) {
    throw new Error('Each QA employee needs username, password, companyCode, clientId, and employeeId. Use ZENTIME_EMPLOYEE_PASSWORD for shared local QA password.');
  }

  if ((__ENV.ZENTIME_REQUIRE_UNIQUE_EMPLOYEES || __ENV.K6_REQUIRE_UNIQUE_EMPLOYEES || 'true').toLowerCase() !== 'false' && normalized.length < requiredCount) {
    throw new Error(`Need at least ${requiredCount} QA employees for this run. Found ${normalized.length}.`);
  }

  return normalized;
}

export function selectEmployee(employees) {
  return employees[(__VU - 1) % employees.length];
}

export function todayParts() {
  const now = new Date();
  return {
    month: Number(__ENV.ZENTIME_TEST_MONTH || __ENV.K6_TEST_MONTH || now.getMonth() + 1),
    year: Number(__ENV.ZENTIME_TEST_YEAR || __ENV.K6_TEST_YEAR || now.getFullYear()),
  };
}
