# ZenTime QA to Production Release Workflow

This workflow is for promoting a QA-approved ZenTime change to production safely.
It does not contain secrets and does not deploy anything by itself.

## 1. Release Readiness

Before preparing production artifacts, confirm:

- The change is merged into `qa-testing` through a pull request.
- `QA Gate` is green on GitHub Actions.
- The production release scope is approved.
- No production database changes are required unless separately reviewed and approved.
- No production secrets are present in Git.

Required QA checks:

- Backend Tests: success
- Admin Build: success
- Mobile TypeScript and Expo Config: success
- Newman API Regression: success
- QA Gate: success

## 2. Branch Flow

Use pull requests only for protected branches.

Recommended flow:

```text
feature/fix branch
-> pull request to qa-testing
-> QA Gate success
-> manual QA approval
-> production release branch or production PR
-> production artifact build
-> manual production deploy
```

Do not push directly to protected production branches.

## 3. Backend Production Checks

Backend production runtime must use Elastic Beanstalk environment variables.
The JAR should not contain database passwords or production secrets.

Required Elastic Beanstalk environment variables:

```env
SPRING_PROFILES_ACTIVE=prod
PORT=5000
DB_URL=jdbc:mysql://<production-host>:3306/<production-db>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata
DB_USERNAME=<production-db-user>
DB_PASSWORD=<set in Elastic Beanstalk only>
CORS_ALLOWED_ORIGIN_PATTERNS=https://iie.zentime.co.in,https://iieadmin.zentime.co.in,https://iiesuperadmin.zentime.co.in
SSL_DOMAIN=iie.zentime.co.in
SSL_EMAIL=<production-ssl-email>
AUTO_SSL_ENABLED=true
EMBEDDED_SSL_ENABLED=false
```

Never commit the real DB host, username, password, SSL private key, AWS key, or token.

Before backend deploy:

```powershell
cd D:\zentime-local-ajay\zentime-ajay\backend
..\..\..\.tools\apache-maven-3.9.10\bin\mvn.cmd -DskipTests package
```

Expected JAR:

```text
D:\zentime-local-ajay\zentime-ajay\backend\target\demo-0.0.1-SNAPSHOT.jar
```

If deploying through the existing Elastic Beanstalk nginx SSL bundle, package:

- `application.jar`
- `Procfile`
- `.platform/`

Do not deploy only the JAR if the environment depends on the `.platform` nginx SSL files.

## 4. Backend Deploy Order

Deploy backend first.

After Elastic Beanstalk reports success, verify:

```text
https://iie.zentime.co.in/api/attendance-records/search?clientId=1&limit=1
```

Expected result:

- HTTP response is not 500.
- Backend logs do not show startup failure.
- Nginx proxies to backend port `5000`.
- SSL certificate is for `iie.zentime.co.in`.

Do not approve or mutate production attendance requests during smoke testing unless separately approved.

## 5. Admin Production Checks

Admin is deployed as a static React build to S3.

Before building Admin, confirm:

- `admin/src/config/api.js` defaults to `https://iie.zentime.co.in`.
- No TEST backend URL is active in the production build.

Build command:

```powershell
cd D:\zentime-local-ajay\zentime-ajay\admin
npm ci
npm run build
```

Upload only the contents of:

```text
D:\zentime-local-ajay\zentime-ajay\admin\build
```

to the production Admin S3 bucket.

If CloudFront is used, invalidate:

```text
/*
```

Do not upload source files, `.env` files, node_modules, logs, or local build tools.

## 6. Admin Smoke Test

After S3/CloudFront deployment:

- Open `https://iieadmin.zentime.co.in`.
- Hard refresh the browser.
- Login as an approved production admin.
- Open Attendance Records.
- Test:
  - no-filter search
  - employee filter
  - month filter
  - date filter
  - branch filter if applicable
  - Excel export if included in the release
  - Print if included in the release

Expected:

- API calls go to `https://iie.zentime.co.in`.
- No `/api/attendance-records/search` HTTP 500.
- No silent UI failure.

## 7. Mobile Release

Mobile release is separate from backend and Admin.

Only build a production APK/AAB when a mobile release is explicitly approved.

Production mobile API base:

```text
https://iie.zentime.co.in
```

Do not use QA localhost or test domains in a production mobile build.

## 8. Rollback Plan

Backend rollback:

- Re-deploy the previous known-good Elastic Beanstalk application version.
- Do not edit production DB manually unless separately approved.

Admin rollback:

- Restore the previous S3 build or previous CloudFront/S3 artifact.
- Invalidate CloudFront cache if used.

Mobile rollback:

- Use Play Store staged rollout controls or publish a fixed version after approval.

## 9. Release Report Template

Use this after every production release:

```text
Release branch:
QA Gate status:
Backend artifact:
Admin artifact:
Mobile artifact:
Backend deployed: YES/NO
Admin deployed: YES/NO
Mobile deployed: YES/NO
Production DB/schema changed: YES/NO
Smoke tests:
- Backend health:
- Admin login:
- Attendance Records:
- Monthly report:
- Logs checked:
Rollback needed: YES/NO
```

