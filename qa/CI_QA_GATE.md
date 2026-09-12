# ZenTime QA CI Gate

This QA gate runs on pull requests and on pushes to the `qa-testing` branch.

## Automatic Checks

- `backend-tests`: runs the Spring Boot backend test suite with the `test` profile. The MySQL integration tests use Testcontainers and GitHub Actions Docker, so they use disposable databases only.
- `admin-build`: installs Admin dependencies with `npm ci` and runs the React production build.
- `mobile-check`: installs Mobile dependencies with `npm ci`, runs `npx tsc --noEmit`, and validates the Expo public config.
- `newman-regression`: starts a disposable MySQL service, starts the backend with the `ci` profile on localhost, seeds QA-only data, and runs the Postman/Newman regression suite.
- `qa-gate`: passes only if backend, admin, mobile, and Newman regression jobs all pass.

## Merge Blocking

The `qa-gate` job is the single check that can be marked as required in GitHub branch protection. If any required job fails, `qa-gate` fails.

## Newman Regression

Newman is a mandatory CI job. It runs only against the GitHub Actions localhost backend and disposable MySQL data:

```bash
newman run qa/postman/zentime-regression.postman_collection.json \
  -e qa/postman/environments/qa-testing.postman_environment.json \
  --env-var baseUrl=http://127.0.0.1:5001
```

The committed Postman environment keeps placeholder values for passwords. CI generates disposable local-only credentials at runtime, injects them into the temporary seed SQL outside the repository, and passes the same values to Newman. The Newman job must never point to production, staging, AWS RDS, or customer data.

## k6 Load Testing

k6 is intentionally not run on every push. The 100-user login and attendance load tests are heavier and should remain manual, scheduled, or release-candidate checks against local/QA infrastructure only.

## Branch Protection Setup

In GitHub repository settings, protect `qa-testing` or the target QA branch and require the `QA Gate` check before merge. Do not add deployment secrets or production credentials to this workflow.
