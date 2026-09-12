# ZenTime Backend Logging Audit

Scope: audit only. No production code change has been made by this document.

## Current Observations

- `GlobalExceptionHandler` logs generic unhandled exceptions with HTTP method, URI, exception class, message, and stack trace.
- `TenantRoutingFilter` sets and clears tenant context but does not add request correlation IDs or per-request timing.
- `ClientController` has detailed timing logs for admin/client login, using a local trace ID.
- `EmployeeController.loginEmployee` logs username and company code for login attempts and success/failure, but not a shared correlation ID, duration, status code, clientId, or employeeId in a structured request-level format.
- `AttendanceController` has endpoint-specific error logs for time-in persistence failures, but request entry/exit timing and correlation fields are not consistent across start-day/time-in/time-out.
- Existing logs are mostly plain text, not structured JSON/key-value logs across every request.

## Recommended Structured Request Logging

Add a single backend request logging filter or interceptor, preferably a `OncePerRequestFilter`, that:

- creates or accepts `X-Correlation-Id`
- stores it in MDC as `correlationId`
- records method, endpoint path, query-safe route data, HTTP status, and durationMs
- extracts safe request context when available:
  - `clientId`
  - `employeeId`
  - attendance action such as `start-day`, `mark-time-in`, `mark-time-out`
- logs one completion event per request
- logs exceptions with stack trace and correlation ID
- clears MDC in `finally`

## Do Not Log

- passwords
- tokens
- raw Authorization headers
- push tokens
- DB credentials
- employee photos/images
- multipart file contents
- full request bodies for login/profile/password endpoints

## Suggested Log Fields

- `correlationId`
- `method`
- `path`
- `status`
- `durationMs`
- `clientId`
- `employeeId`
- `tenantDb`
- `attendanceAction`
- `exceptionClass`
- `exceptionMessage`

## Why This Helps

The recurring production pattern is employee-specific intermittent login/attendance failure. A shared request correlation log lets support compare:

- request reached backend or not
- tenant/client chosen
- employee ID involved
- exact endpoint/action
- response status
- duration
- exception stack trace

This should be implemented as a separate production-safe observability patch after review, not mixed into business logic changes.
