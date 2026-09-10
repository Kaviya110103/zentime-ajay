# ZenTime QA CI Gate

This QA gate runs on pull requests and on pushes to the `qa-testing` branch.

## Automatic Checks

- `backend-tests`: runs the Spring Boot backend test suite with the `test` profile. The MySQL integration tests use Testcontainers and GitHub Actions Docker, so they use disposable databases only.
- `admin-build`: installs Admin dependencies with `npm ci` and runs the React production build.
- `mobile-check`: installs Mobile dependencies with `npm ci`, runs `npx tsc --noEmit`, and validates the Expo public config.
- `qa-gate`: passes only if backend, admin, and mobile jobs all pass.

## Merge Blocking

The `qa-gate` job is the single check that can be marked as required in GitHub branch protection. If any required job fails, `qa-gate` fails.

## Newman Regression

Newman is not a mandatory CI job yet. The current Postman suite requires a running QA backend plus known QA seed data. To safely enable it in GitHub Actions, add an automated disposable MySQL service or Testcontainers-backed backend start step, seed QA-only data, wait for the backend health check, and then run:

```bash
newman run qa/postman/zentime-regression.postman_collection.json \
  -e qa/postman/environments/qa-testing.postman_environment.json
```

The Newman job must use only localhost/disposable CI data and must never point to production.

## k6 Load Testing

k6 is intentionally not run on every push. The 100-user login and attendance load tests are heavier and should remain manual, scheduled, or release-candidate checks against local/QA infrastructure only.

## Branch Protection Setup

In GitHub repository settings, protect `qa-testing` or the target QA branch and require the `QA Gate` check before merge. Do not add deployment secrets or production credentials to this workflow.
