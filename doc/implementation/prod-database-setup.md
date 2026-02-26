# Implementation Plan: Production Database Setup (Singapore)

## Goal

Stand up a production stack in `ap-southeast-1` (Singapore) that mirrors the current dev setup, with an empty database and the same schema. Dev (`us-east-1`) remains completely untouched throughout.

## Current State

| Resource | Region | Notes |
|---|---|---|
| Dev RDS (`nora-db-dev`) | us-east-1 | also serving as prod right now |
| App Runner (`nora-api`) | us-east-1 | `https://p2tgddmyxt.us-east-1.awsapprunner.com` |
| ECR (`nora`) | us-east-1 | `059364397483.dkr.ecr.us-east-1.amazonaws.com/nora` |
| S3 audio bucket | ap-southeast-1 | `nora-audio-059364397483-sg` ✅ |
| S3 support bucket | ap-southeast-1 | `nora-support` ✅ |
| Bastion EC2 | us-east-1 | `i-0816636c6667be898` (SSM) |
| Secrets Manager | us-east-1 | 8 secrets under `nora/*` |

## Target State

| Resource | Region | Notes |
|---|---|---|
| Dev RDS (`nora-db-dev`) | us-east-1 | unchanged |
| **Prod RDS** | ap-southeast-1 | new, empty, same schema |
| **App Runner (prod)** | ap-southeast-1 | new service |
| **ECR (prod)** | ap-southeast-1 | new repo |
| S3 audio bucket | ap-southeast-1 | unchanged ✅ |
| S3 support bucket | ap-southeast-1 | unchanged ✅ |
| **Bastion EC2 (prod)** | ap-southeast-1 | new, SSM-enabled |
| **Secrets Manager (prod)** | ap-southeast-1 | 8 secrets under `nora/*` |

---

## Phase 1: AWS Infrastructure (ap-southeast-1)

Do these steps in order in the AWS Console.

### 1a. VPC + Networking
- VPC CIDR: `10.0.0.0/16`
- 2 private subnets for RDS: `ap-southeast-1a` (`10.0.10.0/24`), `ap-southeast-1b` (`10.0.11.0/24`)
- 2 public subnets for bastion + VPC connector: `ap-southeast-1a` (`10.0.1.0/24`), `ap-southeast-1b` (`10.0.2.0/24`)
- Internet Gateway + route tables

### 1b. Security Groups
- **RDS SG**: allow inbound port 5432 from VPC CIDR only
- **Bastion SG**: outbound only (SSM requires no inbound port)

### 1c. RDS PostgreSQL
- Engine: PostgreSQL 15.8 (matching dev)
- Instance class: db.t3.micro
- DB name: `nora`
- Master username: `nora_admin`
- Place in private subnets using the RDS subnet group
- Not publicly accessible
- Assign RDS SG

### 1d. Bastion EC2
- Instance type: t3.micro
- Place in a public subnet
- IAM role: SSM managed instance policy
- No inbound security group rules needed (access via SSM only)

### 1e. ECR Repository
```bash
aws ecr create-repository --repository-name nora --region ap-southeast-1
```

### 1f. App Runner IAM Role
Create an instance role for App Runner with:
- `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:ap-southeast-1:059364397483:secret:nora/*`
- S3 access to `nora-audio-059364397483-sg` and `nora-support`

### 1g. Secrets Manager — 8 secrets in ap-southeast-1

These are the exact secrets loaded by `server/utils/secrets.cjs` when `USE_AWS_SECRETS=true`.
Copy values from the current `.env`.

```bash
aws secretsmanager create-secret --name nora/encryption-key      --secret-string "<ENCRYPTION_KEY>"       --region ap-southeast-1
aws secretsmanager create-secret --name nora/jwt-access-secret   --secret-string "<JWT_ACCESS_SECRET>"    --region ap-southeast-1
aws secretsmanager create-secret --name nora/jwt-refresh-secret  --secret-string "<JWT_REFRESH_SECRET>"   --region ap-southeast-1
aws secretsmanager create-secret --name nora/anthropic-api-key   --secret-string "<ANTHROPIC_API_KEY>"    --region ap-southeast-1
aws secretsmanager create-secret --name nora/elevenlabs-api-key  --secret-string "<ELEVENLABS_API_KEY>"   --region ap-southeast-1
aws secretsmanager create-secret --name nora/smtp-user           --secret-string "<SMTP_USER>"            --region ap-southeast-1
aws secretsmanager create-secret --name nora/smtp-pass           --secret-string "<SMTP_PASS>"            --region ap-southeast-1
aws secretsmanager create-secret --name nora/coach-email         --secret-string "<COACH_EMAIL>"          --region ap-southeast-1
```

### 1h. App Runner VPC Connector
- Attach to the VPC and private subnets so App Runner can reach the private RDS

### 1i. App Runner Service
Create after Phase 3 (needs a Docker image in ECR first). Configure with env vars from Phase 4.

---

## Phase 2: Initialize Prod DB Schema

### 2a. Create prod tunnel script

Create `scripts/start-prod-db-tunnel.sh` (mirrors the existing dev tunnel, uses local port 5433 to avoid conflict):

```bash
#!/bin/bash
set -e

echo "🔧 Starting SSH tunnel to production database..."
echo ""
echo "This will forward:"
echo "  localhost:5433 → <sg-rds-endpoint>:5432"
echo ""
echo "Press Ctrl+C to stop the tunnel when done."
echo ""

aws ssm start-session \
  --target <new-sg-bastion-instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<sg-rds-endpoint>"],"portNumber":["5432"],"localPortNumber":["5433"]}' \
  --region ap-southeast-1
```

### 2b. Run all migrations against prod DB

With the tunnel running in one terminal:

```bash
DATABASE_URL="postgresql://nora_admin:<password>@localhost:5433/nora" \
  npx prisma migrate deploy
```

Verify all 21 migrations applied cleanly.

---

## Phase 3: Code Changes

### 3a. `entrypoint.sh` — modify in place

Add `prisma migrate deploy` so future schema changes auto-apply on every deployment.
`migrate deploy` is idempotent — safe to run on every boot, on both dev and prod DB.

```sh
#!/bin/sh
set -e

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node server.cjs
```

### 3b. `docker_deploy_prod.sh` — new file, do not modify `docker_deploy.sh`

`docker_deploy.sh` continues to work for the current us-east-1 setup unchanged.
Create a new `docker_deploy_prod.sh` for Singapore:

```bash
#!/bin/bash
set -e

echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t nora-backend:latest .

echo "Logging in to ECR..."
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin 059364397483.dkr.ecr.ap-southeast-1.amazonaws.com

echo "Tagging image..."
docker tag nora-backend:latest 059364397483.dkr.ecr.ap-southeast-1.amazonaws.com/nora:latest

echo "Pushing to ECR..."
docker push 059364397483.dkr.ecr.ap-southeast-1.amazonaws.com/nora:latest

echo "Triggering App Runner deployment..."
aws apprunner start-deployment --service-arn <new-sg-service-arn> --region ap-southeast-1

echo "Verifying ECR image..."
aws ecr describe-images --repository-name nora --region ap-southeast-1 \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1]'

echo "Deployment triggered. Monitor at: https://console.aws.amazon.com/apprunner/home?region=ap-southeast-1#/services"
```

### 3c. `nora-mobile/.env.production` — update at cutover only

Do not change this until the Singapore App Runner is live and validated.
At cutover, update to the new Singapore App Runner URL and submit a new mobile build:

```
EXPO_PUBLIC_API_URL=https://<new-sg-url>.ap-southeast-1.awsapprunner.com
```

> Requires a new mobile app build and submission to TestFlight/App Store.

---

## Phase 4: App Runner Environment Variables

Set these on the new Singapore App Runner service. All values match dev `.env` exactly
except `DATABASE_URL` (new prod RDS) and `FRONTEND_URL` (prod web URL instead of localhost).

The following are **plain env vars** (not loaded via Secrets Manager):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://nora_admin:<pw>@<sg-rds-endpoint>:5432/nora` |
| `USE_AWS_SECRETS` | `false` |
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_S3_BUCKET` | `nora-audio-059364397483-sg` |
| `AWS_S3_SUPPORT_BUCKET` | `nora-support` |
| `AWS_S3_SUPPORT_REGION` | `ap-southeast-1` |
| `JWT_ACCESS_EXPIRY` | `180d` |
| `JWT_REFRESH_EXPIRY` | `180d` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `DEEPGRAM_API_KEY` | value from `.env` |
| `ASSEMBLYAI_API_KEY` | value from `.env` |
| `GEMINI_API_KEY` | value from `.env` |
| `REVENUECAT_WEBHOOK_SECRET` | value from `.env` |
| `ADMIN_PASSWORD` | value from `.env` |
| `GOOGLE_CLIENT_ID` | `773719197472-nf4vm9bjl2tve63ro7cf25fjrqb3t968.apps.googleusercontent.com` |
| `GOOGLE_IOS_CLIENT_ID` | `773719197472-0aib3ell35vj87uo3nkqrt06ae2knrpq.apps.googleusercontent.com` |
| `FRONTEND_URL` | `https://hinora.co` |
| `EXPO_PUBLIC_PROJECT_ID` | `a85b5e9f-f4c9-4650-a58f-16c3c45020c4` |

All secrets are set as **plain env vars** (`USE_AWS_SECRETS=false`). This matches the working dev setup.
`ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ANTHROPIC_API_KEY`,
`ELEVENLABS_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `COACH_EMAIL` must also be added to the env vars list above.

---

## Phase 5: Deploy and Validate

```bash
./docker_deploy.sh
```

Validate:
1. `GET https://<sg-apprunner-url>/api/health` → 200
2. App Runner logs show `"✅ All secrets loaded from AWS Secrets Manager"`
3. Test login, session creation, S3 audio upload

---

## Step-by-Step Checklist

| # | Task | Depends On |
|---|---|---|
| 1 | Create VPC + networking in ap-southeast-1 | — |
| 2 | Create RDS PostgreSQL in ap-southeast-1 | step 1 |
| 3 | Create bastion EC2 (SSM) in ap-southeast-1 | step 1 |
| 4 | Create ECR repo in ap-southeast-1 | — |
| 5 | Create App Runner IAM role | — |
| 6 | Create 8 Secrets Manager secrets in ap-southeast-1 | — |
| 7 | Create `scripts/start-prod-db-tunnel.sh`, run `prisma migrate deploy` | steps 2, 3 |
| 8 | Update `entrypoint.sh` — add `prisma migrate deploy` | — |
| 9 | Create `docker_deploy_prod.sh` (new file, `docker_deploy.sh` untouched) | steps 4, 10 |
| 10 | Create App Runner service + VPC connector, set all env vars | steps 1, 4, 5, 6 |
| 11 | Run `./docker_deploy_prod.sh` to push first image and trigger deployment | steps 8, 9, 10 |
| 12 | Validate, then update `nora-mobile/.env.production` + rebuild mobile app (cutover) | step 11 |

## Dev → Prod Flow (Going Forward)

Once this setup is complete, the workflow for schema changes is:

1. Develop and test on dev DB (us-east-1) as normal
2. Create migration: `npx prisma migrate dev --name <description>`
3. Deploy to prod: `./docker_deploy.sh`
   - App Runner starts, `prisma migrate deploy` auto-applies new migration to prod DB
   - Server starts
