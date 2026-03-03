# Infrastructure & Deployment

## Overview

Two environments: **dev** (us-east-1) and **prod** (ap-southeast-1 / Singapore). They share the same codebase and Docker image but have completely separate databases and App Runner services.

---

## Environments

### Dev — us-east-1 (N. Virginia)

| Resource | Value |
|---|---|
| App Runner URL | `https://p2tgddmyxt.us-east-1.awsapprunner.com` |
| RDS | `nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com` |
| Database | `nora_dev` |
| ECR | `059364397483.dkr.ecr.us-east-1.amazonaws.com/nora` |
| Bastion EC2 | `i-0816636c6667be898` |
| Deploy script | `./docker_deploy.sh` |
| DB tunnel script | `./scripts/start-db-tunnel.sh` (localhost:5432) |

### Prod — ap-southeast-1 (Singapore)

| Resource | Value |
|---|---|
| App Runner URL | `https://wpwpawhz29.ap-southeast-1.awsapprunner.com` |
| RDS | `nora-prod.cjy4ccwg2d5q.ap-southeast-1.rds.amazonaws.com` |
| Database | `nora` |
| ECR | `059364397483.dkr.ecr.ap-southeast-1.amazonaws.com/nora` |
| Bastion EC2 | `i-00d40d120d983d90c` |
| Deploy script | `./docker_deploy_prod.sh` |
| DB tunnel script | `./scripts/start-prod-db-tunnel.sh` (localhost:5433) |

---

## AWS Resources (Prod — ap-southeast-1)

| Resource | ID |
|---|---|
| VPC | `vpc-0f6f5aa660f206038` |
| Private subnets (RDS) | `subnet-0bc1e7361229d6dfc`, `subnet-08cb5e252c89060d6` |
| Public subnets | `subnet-0305dd34da54e7a4c`, `subnet-0a36e3f4fba17c82c` |
| RDS security group | `sg-07cf70f44026c83c3` |
| Bastion security group | `sg-078be60b6508b38b2` |
| App Runner instance role | `nora-prod-apprunner-role` |
| App Runner access role | `nora-prod-apprunner-access-role` |
| VPC connector | `nora-prod-vpc-connector` |
| App Runner service ARN | `arn:aws:apprunner:ap-southeast-1:059364397483:service/nora-prod-api/8a4133cde78b478a90b16b7e420ddded` |
| RDS password | stored in `.prod-infra-ids.txt` (local, not committed) |

---

## Secrets Manager

Both environments use AWS Secrets Manager with `RuntimeEnvironmentSecrets` — App Runner injects these directly as environment variables before the container starts.

### Dev secrets (us-east-1)
```
nora/database-url
nora/encryption-key
nora/jwt-access-secret
nora/jwt-refresh-secret
nora/anthropic-api-key
nora/elevenlabs-api-key
nora/smtp-user
nora/smtp-pass
nora/coach-email
```

### Prod secrets (ap-southeast-1)
Same 9 secret names, different values (prod DB URL, same API keys).

---

## App Runner Environment Variables

Both environments must have the **same set of variables**. When adding a new variable, apply it to both.

### Injected via Secrets Manager (RuntimeEnvironmentSecrets)

Both environments share the same 9 secret names (different values per env):

`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `COACH_EMAIL`

### Plain env vars (RuntimeEnvironmentVariables)

| Variable | Dev (us-east-1) | Prod (ap-southeast-1) | Notes |
|---|---|---|---|
| `NODE_ENV` | `production` | `production` | Controls rate limiting & CORS strictness |
| `PORT` | `3001` | `3001` | Express listen port |
| `AWS_REGION` | `us-east-1` | `ap-southeast-1` | S3 / SDK region |
| `AWS_S3_BUCKET` | `nora-audio-059364397483-sg` | `nora-audio-059364397483-prod` | Audio & profile images |
| `AWS_S3_SUPPORT_BUCKET` | `nora-support` | `nora-support` | Support attachments |
| `AWS_S3_SUPPORT_REGION` | `ap-southeast-1` | `ap-southeast-1` | Support bucket is always sg |
| `APP_RUNNER_URL` | `https://p2tgddmyxt.us-east-1.awsapprunner.com` | `https://wpwpawhz29.ap-southeast-1.awsapprunner.com` | Added to CORS allowed origins |
| `WEB_APP_URL` | `https://p2tgddmyxt.us-east-1.awsapprunner.com` | `https://wpwpawhz29.ap-southeast-1.awsapprunner.com` | Base URL for reset-password email link |
| `FRONTEND_URL` | `https://your-frontend-domain.com` | `https://hinora.co` | CORS allowed origin for web frontend |
| `PROD_API_URL` | `https://wpwpawhz29.ap-southeast-1.awsapprunner.com` | *(dev-only — admin sync routes call prod from dev)* | |
| `SMTP_HOST` | `smtp.gmail.com` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | `587` | |
| `SMTP_SECURE` | `false` | `false` | |
| `JWT_ACCESS_EXPIRY` | `180d` | `180d` | |
| `JWT_REFRESH_EXPIRY` | `180d` | `180d` | |
| `GOOGLE_CLIENT_ID` | `773719197472-nf4vm9bjl2tve63ro7cf25fjrqb3t968.apps.googleusercontent.com` | same | |
| `GOOGLE_IOS_CLIENT_ID` | `773719197472-0aib3ell35vj87uo3nkqrt06ae2knrpq.apps.googleusercontent.com` | same | |
| `EXPO_PUBLIC_PROJECT_ID` | `a85b5e9f-f4c9-4650-a58f-16c3c45020c4` | same | Push notifications |
| `GEMINI_API_KEY` | — | same | |
| `DEEPGRAM_API_KEY` | — | same | |
| `ASSEMBLYAI_API_KEY` | — | same | |
| `REVENUECAT_WEBHOOK_SECRET` | — | same | |
| `SYNC_SECRET` | — | same | Admin sync auth between dev and prod |
| `ADMIN_PASSWORD` | — | same | Admin panel login |
| `DISABLE_ANALYTICS` | `true` | *(prod omits — analytics enabled)* | Suppresses analytics in dev |

---

## Container Startup (`entrypoint.sh`)

On every deployment, the container runs:
```sh
npx prisma generate       # generates Prisma client
npx prisma migrate deploy # applies any pending migrations to DB (idempotent)
node server.cjs           # starts the server
```

`prisma migrate deploy` is idempotent — it only applies migrations that haven't been applied yet. Schema changes are automatically applied to prod DB on the next deploy.

---

## Deployment

### Backend

```bash
# Deploy to dev (us-east-1)
./docker_deploy.sh

# Deploy to prod (ap-southeast-1)
./docker_deploy_prod.sh
```

Both scripts:
1. Build Docker image (`linux/amd64`)
2. Push to the respective ECR
3. Trigger App Runner deployment
4. App Runner pulls the new image and restarts containers

Auto-deployment is enabled — pushing a new image to ECR also triggers a deploy automatically.

### Mobile (iOS)

Full build sequence (including nora-core):

```bash
# 1. Build nora-core
cd packages/nora-core && npm run build

# 2. Prebuild mobile
cd ../../nora-mobile && npx expo prebuild --platform ios            # dev
cd ../../nora-mobile && NODE_ENV=production npx expo prebuild --platform ios  # prod

# 3. Install pods
cd ../ios && pod install

# 4. Deploy backend
./docker_deploy.sh           # dev
cd ../../pcit && ./docker_deploy_prod.sh      # prod

# 5. Open Xcode
open Nora.xcworkspace
```

#### Testing on device (before Archive)

To test on a physical device without submitting to the App Store:

1. In Xcode: **Product → Scheme → Edit Scheme...**
2. Select **Run** on the left → set **Build Configuration** to **Release**
3. **Product → Run**

> Using **Release** build configuration is required. Debug builds try to load the JS bundle from Metro bundler (port 8081) and will fail with a timeout error if Metro is not running. Release builds bundle the JS at build time, the same as Archive.

After testing, switch Build Configuration back to **Debug** for normal development.

#### Distributing to App Store

In Xcode: **Product → Archive → Distribute App**

---

## Dev → Prod Workflow

### Code changes only
```bash
./docker_deploy.sh        # 1. test on dev
./docker_deploy_prod.sh   # 2. ship to prod
```

### Schema changes (new migration)
```bash
npx prisma migrate dev --name <description>   # 1. create migration
./docker_deploy.sh                            # 2. test on dev
./docker_deploy_prod.sh                       # 3. ship to prod
                                              #    (migration auto-applies on startup)
```

> **Warning: never use `prisma db push` on dev.**
> `prisma db push` applies schema changes directly to the dev DB but does **not** create a migration file. This means prod will never receive the change — `prisma migrate deploy` (which runs on every container startup) only applies changes that have a migration file. Always use `prisma migrate dev --name <description>` so the migration file is committed and prod stays in sync automatically on the next deploy.

---

## Database Access (local)

To connect to either database locally (e.g. for inspection or manual migrations), use the SSM tunnel scripts:

```bash
# Dev DB → localhost:5432
./scripts/start-db-tunnel.sh

# Prod DB → localhost:5433
./scripts/start-prod-db-tunnel.sh
```

Then connect with any Postgres client:
```
# Dev
postgresql://nora_admin:<password>@localhost:5432/nora_dev

# Prod
postgresql://nora_admin:<password>@localhost:5433/nora
```

Passwords are stored in `.prod-infra-ids.txt` (local, not committed to git).

---

## S3 Buckets

| Bucket | Region | Environment | Purpose |
|---|---|---|---|
| `nora-audio-059364397483-prod` | ap-southeast-1 | **prod only** | Audio recordings, profile images |
| `nora-audio-059364397483-sg` | ap-southeast-1 | **dev** | Audio recordings, profile images |
| `nora-support` | ap-southeast-1 | both | Support request attachments |

---

## Health Check

```bash
# Dev
curl https://p2tgddmyxt.us-east-1.awsapprunner.com/api/health

# Prod
curl https://wpwpawhz29.ap-southeast-1.awsapprunner.com/api/health

# Expected response
{"status":"ok","services":{"anthropic":true,"email":true}}
```
