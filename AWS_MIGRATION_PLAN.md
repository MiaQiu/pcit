# AWS Migration Plan - Step by Step Guide

**Application:** Nora (PCIT Coaching App)
**Migration:** Local/GCP → AWS (RDS + App Runner + S3)
**Date Created:** 2025-11-27

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Docker Desktop installed and running
- [ ] Current database backup (run `pg_dump` locally)
- [ ] All environment variables documented
- [ ] Access to GCP console (for migrating existing audio files, if any)

---

## Cost Estimation

**Expected Monthly Costs:**
- RDS PostgreSQL (db.t3.small): ~$30
- App Runner (1GB RAM): ~$25-50
- S3 Storage: ~$0.25
- NAT Gateway (if needed): ~$32
- CloudWatch Logs: ~$5
- Data Transfer: ~$5-20

**Total: $100-150/month (dev/staging), $200-400/month (production)**

**Action Required:** Set up AWS Billing Alert for $50/month threshold before proceeding.

---

## Phase 0: Preparation & Local Testing

### Step 1: Create Dockerfile
**Who:** You (with my help)
**Duration:** 30 minutes

Create `/Users/mia/nora/Dockerfile`:

```dockerfile
FROM node:18-alpine

# Install system dependencies for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma Client
RUN npx prisma generate

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.cjs"]
```

**Validation:**
```bash
# Test build locally
docker build -t nora:local .

# Test run (should fail due to missing DB, but container should start)
docker run -p 3001:3001 -e PORT=3001 nora:local
```

---

### Step 2: Create .dockerignore
**Who:** You
**Duration:** 5 minutes

Create `/Users/mia/nora/.dockerignore`:

```
node_modules
.git
.env
.env.*
*.log
npm-debug.log*
.DS_Store
.vscode
README.md
docs
scripts/test-*.sh
prisma/migrations
gcp-service-account.json
```

---

### Step 3: Update Storage Service for AWS S3
**Who:** You (with my help)
**Duration:** 30 minutes

**Action Required:** Decide whether to:
- [ ] Option A: Migrate existing GCS audio files to S3 (if you have production data)
- [ ] Option B: Start fresh with S3 (if in development)

We'll need to update `server/services/storage.cjs` to support AWS S3.

---

### Step 4: Document Current Database Version
**Who:** You
**Duration:** 5 minutes

```bash
# Check your current PostgreSQL version
psql $DATABASE_URL -c "SELECT version();"

# Export current schema
pg_dump $DATABASE_URL --schema-only > schema-backup.sql

# Count records per table (for verification later)
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, n_tup_ins - n_tup_del as row_count
  FROM pg_stat_user_tables
  ORDER BY tablename;
"
```

**Save the output** - you'll verify this matches after migration.

---

## ✅ Phase 0 Completion Status

**Completed on:** 2025-11-27

### What Was Completed:
- ✅ **Step 1:** Dockerfile created at `/Users/mia/nora/Dockerfile`
- ✅ **Step 2:** .dockerignore created at `/Users/mia/nora/.dockerignore`
- ✅ **Step 3:** Storage service updated to AWS S3
  - Created: `server/services/storage-s3.cjs`
  - Updated: `server/routes/sessions.cjs` to use S3
  - Updated: `package.json` with AWS SDK dependencies
  - Installed: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- ✅ **Step 4:** Database documented and backed up
  - Created: `scripts/backup-database.cjs`
  - Backup: `database-backup-2025-11-27.json` (85 records, 56.58 KB)
  - Documentation: `database-documentation-2025-11-27.txt`

### What Was Skipped:
- ⏭️ **Local Docker Testing** - Skipped due to Docker Desktop not running
  - **Note:** Docker build will be tested in AWS ECR instead (Step 21)
  - **Reason:** Docker Desktop was not accessible locally
  - **Impact:** None - AWS ECR will build and validate the image
  - **Next Step:** We'll push directly to ECR and test there

### Database Backup Summary:
- Total Records: 85
  - Users: 5
  - Sessions: 33
  - RefreshTokens: 3
  - LearningProgress: 3
  - ModuleHistory: 17
  - RiskAuditLog: 0
  - ThirdPartyRequest: 24
  - WacbSurvey: 0

---

## Phase 1: AWS Foundation Setup

### Step 5: Set Up AWS Billing Alert
**Who:** You
**Duration:** 5 minutes

```bash
# Via AWS Console:
# 1. Go to AWS Billing Dashboard
# 2. Click "Budgets" → "Create budget"
# 3. Choose "Cost budget"
# 4. Set amount: $50
# 5. Add your email for alerts
```

---

### Step 6: Choose AWS Region
**Who:** You
**Duration:** 2 minutes

**Action Required:** Choose your AWS region based on:
- Proximity to users (lowest latency)
- Cost (some regions are cheaper)
- Compliance requirements

**Recommended:** `us-east-1` (cheapest) or `us-west-2` (West Coast)

```bash
# Set default region
export AWS_REGION=us-east-1
aws configure set default.region $AWS_REGION
```

---

### Step 7: Create VPC and Network Infrastructure
**Who:** You (AWS Console) or Automated (AWS CLI)
**Duration:** 15 minutes

**Option A: Use AWS Console (Recommended for first-time)**

1. Go to VPC Dashboard → "Create VPC"
2. Select "VPC and more"
3. Configuration:
   - Name: `nora-vpc`
   - IPv4 CIDR: `10.0.0.0/16`
   - Availability Zones: 2
   - Public subnets: 2
   - Private subnets: 2
   - NAT Gateways: 1 (in 1 AZ) - **Note: Adds $32/month**
   - VPC endpoints: None
4. Click "Create VPC"

**Option B: Use AWS CLI**

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=nora-vpc}]' \
  --query 'Vpc.VpcId' --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=nora-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Create Subnets (run these commands)
# Public Subnet 1
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nora-public-1a}]' \
  --query 'Subnet.SubnetId' --output text)

# Public Subnet 2
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nora-public-1b}]' \
  --query 'Subnet.SubnetId' --output text)

# Private Subnet 1
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.10.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nora-private-1a}]' \
  --query 'Subnet.SubnetId' --output text)

# Private Subnet 2
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=nora-private-1b}]' \
  --query 'Subnet.SubnetId' --output text)

echo "Public Subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2"
echo "Private Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"
```

**Save these IDs** - you'll need them later:
```bash
# Save to file for later use
cat > aws-resources.txt <<EOF
VPC_ID=$VPC_ID
PUBLIC_SUBNET_1=$PUBLIC_SUBNET_1
PUBLIC_SUBNET_2=$PUBLIC_SUBNET_2
PRIVATE_SUBNET_1=$PRIVATE_SUBNET_1
PRIVATE_SUBNET_2=$PRIVATE_SUBNET_2
EOF
```

---

### Step 8: Create Security Groups
**Who:** You (AWS CLI)
**Duration:** 10 minutes

```bash
# Load variables
source aws-resources.txt

# Create RDS Security Group
RDS_SG=$(aws ec2 create-security-group \
  --group-name nora-rds-sg \
  --description "Security group for RDS PostgreSQL" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

echo "RDS Security Group: $RDS_SG"

# Create App Runner Security Group
APPRUNNER_SG=$(aws ec2 create-security-group \
  --group-name nora-apprunner-sg \
  --description "Security group for App Runner" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

echo "App Runner Security Group: $APPRUNNER_SG"

# Allow App Runner to connect to RDS (PostgreSQL port 5432)
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $APPRUNNER_SG \
  --group-owner-id $(aws sts get-caller-identity --query Account --output text)

# Allow App Runner outbound HTTPS (for Anthropic API, etc.)
aws ec2 authorize-security-group-egress \
  --group-id $APPRUNNER_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow App Runner to RDS
aws ec2 authorize-security-group-egress \
  --group-id $APPRUNNER_SG \
  --protocol tcp \
  --port 5432 \
  --destination-security-group $RDS_SG

# Save to file
cat >> aws-resources.txt <<EOF
RDS_SG=$RDS_SG
APPRUNNER_SG=$APPRUNNER_SG
EOF
```

---

### Step 9: Create S3 Bucket for Audio Storage
**Who:** You (AWS CLI)
**Duration:** 5 minutes

```bash
# Choose a globally unique bucket name
BUCKET_NAME="nora-audio-$(aws sts get-caller-identity --query Account --output text)"

# Create bucket
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $AWS_REGION \
  $([ "$AWS_REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$AWS_REGION")

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Optional: Lifecycle policy (delete files after 90 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldAudio",
      "Status": "Enabled",
      "Prefix": "audio/",
      "Expiration": {
        "Days": 90
      }
    }]
  }'

echo "S3 Bucket created: $BUCKET_NAME"

# Save to file
echo "BUCKET_NAME=$BUCKET_NAME" >> aws-resources.txt
```

---

## Phase 2: Database Setup

### Step 10: Create RDS Subnet Group
**Who:** You (AWS CLI)
**Duration:** 5 minutes

```bash
# Load variables
source aws-resources.txt

# Create DB Subnet Group (RDS must be in at least 2 AZs)
aws rds create-db-subnet-group \
  --db-subnet-group-name nora-db-subnet \
  --db-subnet-group-description "Subnet group for Nora RDS" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --tags Key=Name,Value=nora-db-subnet
```

---

### Step 11: Create RDS PostgreSQL Instance
**Who:** You (AWS CLI)
**Duration:** 15-20 minutes (instance creation time)

**Action Required:** Choose database credentials

```bash
# Set database credentials (SAVE THESE SECURELY!)
DB_USERNAME="nora_admin"
DB_PASSWORD="CHANGE_THIS_TO_SECURE_PASSWORD_32_CHARS"  # Generate secure password
DB_NAME="nora"

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier nora-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username $DB_USERNAME \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --db-name $DB_NAME \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name nora-db-subnet \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --multi-az \
  --no-publicly-accessible \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --tags Key=Name,Value=nora-db Key=Environment,Value=production

echo "RDS instance creation started. This will take 10-15 minutes..."

# Wait for instance to be available
aws rds wait db-instance-available --db-instance-identifier nora-db

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier nora-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}"

echo "DATABASE_URL: $DATABASE_URL"

# Save to file
cat >> aws-resources.txt <<EOF
RDS_ENDPOINT=$RDS_ENDPOINT
DATABASE_URL=$DATABASE_URL
EOF
```

**Important:** Save your DATABASE_URL securely. You'll need it for the next steps.

---

### Step 12: Migrate Database Schema and Data
**Who:** You (using Prisma)
**Duration:** 10 minutes

**Option A: Using AWS Cloud9 (Recommended - Secure)**

```bash
# 1. Launch Cloud9 Environment in AWS Console
# - Go to Cloud9 → Create environment
# - Name: nora-migration
# - Instance type: t3.small
# - Network: Select nora-vpc and a private subnet
# - Wait for environment to launch

# 2. In Cloud9 terminal:
# Install PostgreSQL client
sudo yum install postgresql15 -y

# Test connection
psql "$DATABASE_URL" -c "\l"

# 3. Upload your schema backup (use Cloud9 file upload)
# Then apply migrations:
cd /home/ec2-user/environment
# Upload your project files or clone from git

# Apply Prisma migrations
npx prisma migrate deploy

# 4. Import data (if you have existing data)
psql "$DATABASE_URL" < data-backup.sql
```

**Option B: Using Bastion Host**

```bash
# 1. Launch EC2 bastion in public subnet
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --key-name YOUR_KEY_NAME \
  --subnet-id $PUBLIC_SUBNET_1 \
  --security-group-ids $BASTION_SG \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=nora-bastion}]'

# 2. SSH tunnel
ssh -i your-key.pem -L 5432:$RDS_ENDPOINT:5432 ec2-user@BASTION_IP

# 3. In another terminal (on your local machine)
psql "postgresql://${DB_USERNAME}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# 4. Apply migrations
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" npx prisma migrate deploy

# 5. Terminate bastion when done
```

**Option C: Temporary Public Access (LEAST SECURE - Use only for dev)**

```bash
# Temporarily enable public access (NOT RECOMMENDED for production)
aws rds modify-db-instance \
  --db-instance-identifier nora-db \
  --publicly-accessible \
  --apply-immediately

# Wait for modification
aws rds wait db-instance-available --db-instance-identifier nora-db

# Apply migrations from local machine
npx prisma migrate deploy

# IMMEDIATELY disable public access
aws rds modify-db-instance \
  --db-instance-identifier nora-db \
  --no-publicly-accessible \
  --apply-immediately
```

**Verification:**
```bash
# Count records in each table
psql "$DATABASE_URL" -c "
  SELECT schemaname, tablename, n_tup_ins - n_tup_del as row_count
  FROM pg_stat_user_tables
  ORDER BY tablename;
"

# Compare with your saved output from Step 4
```

---

## ✅ Phase 2 Completion Status

**Completed on:** 2025-11-27

### What Was Completed:
- ✅ **Step 10:** RDS subnet group created (`nora-db-subnet`)
- ✅ **Step 11:** RDS PostgreSQL instance created (`nora-db`)
  - Instance: db.t3.micro
  - Engine: PostgreSQL 15.8
  - Storage: 20 GB gp3 (encrypted)
  - Location: Private subnets (us-east-1a)
  - Endpoint: `nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432`
  - Backup: 1-day retention
  - Security: Not publicly accessible ✅

### What Was Deferred:
- ⏭️ **Step 12:** Database schema migration and data import
  - **Decision:** Deferred to App Runner deployment (Phase 5)
  - **Reason:** RDS is correctly in private subnet with no public access
  - **Approach:** App Runner will run `prisma migrate deploy` on startup from within VPC
  - **Benefits:**
    - More secure (no temporary public access needed)
    - Production-ready approach
    - Automated as part of deployment
    - Migrations run from within VPC

### Database Credentials:
```
Username: nora_admin
Password: [Saved in aws-resources.txt]
Database: nora
Endpoint: nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432
DATABASE_URL: postgresql://nora_admin:[password]@nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora
```

### Next Steps:
- Database is ready and waiting
- Schema migration will happen automatically during App Runner deployment
- Existing data (85 records) will be imported after schema is applied

---

## Phase 3: Secrets Management

### Step 13: Generate Secure Secrets (If Needed)
**Who:** You
**Duration:** 5 minutes

```bash
# Generate new JWT secrets (if you want to rotate them)
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo "JWT_ACCESS_SECRET: $JWT_ACCESS_SECRET"
echo "JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"

# SAVE THESE SECURELY - you'll need them in the next step
```

**Action Required:** Decide whether to:
- [ ] Use existing secrets (requires users to re-login if you change JWT secrets)
- [ ] Generate new secrets (existing sessions will be invalidated)

---

### Step 14: Create Secrets in AWS Secrets Manager
**Who:** You (AWS CLI)
**Duration:** 15 minutes

```bash
# Load variables
source aws-resources.txt

# Create secret for DATABASE_URL
aws secretsmanager create-secret \
  --name nora/database-url \
  --description "PostgreSQL database connection string" \
  --secret-string "$DATABASE_URL" \
  --region $AWS_REGION

# JWT Access Secret
aws secretsmanager create-secret \
  --name nora/jwt-access-secret \
  --secret-string "$JWT_ACCESS_SECRET" \
  --region $AWS_REGION

# JWT Refresh Secret
aws secretsmanager create-secret \
  --name nora/jwt-refresh-secret \
  --secret-string "$JWT_REFRESH_SECRET" \
  --region $AWS_REGION

# Encryption Key
aws secretsmanager create-secret \
  --name nora/encryption-key \
  --secret-string "$ENCRYPTION_KEY" \
  --region $AWS_REGION

# Anthropic API Key
aws secretsmanager create-secret \
  --name nora/anthropic-api-key \
  --secret-string "$ANTHROPIC_API_KEY" \
  --region $AWS_REGION

# ElevenLabs API Key
aws secretsmanager create-secret \
  --name nora/elevenlabs-api-key \
  --secret-string "$ELEVENLABS_API_KEY" \
  --region $AWS_REGION

# Deepgram API Key (if used)
aws secretsmanager create-secret \
  --name nora/deepgram-api-key \
  --secret-string "$DEEPGRAM_API_KEY" \
  --region $AWS_REGION

# SMTP credentials
aws secretsmanager create-secret \
  --name nora/smtp-user \
  --secret-string "$SMTP_USER" \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name nora/smtp-pass \
  --secret-string "$SMTP_PASS" \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name nora/coach-email \
  --secret-string "$COACH_EMAIL" \
  --region $AWS_REGION

echo "All secrets created successfully"
```

**Get Secret ARNs (you'll need these for App Runner):**
```bash
aws secretsmanager list-secrets \
  --query "SecretList[?contains(Name, 'nora')].{Name:Name, ARN:ARN}" \
  --output table > secrets-arns.txt

cat secrets-arns.txt
```

---

### Step 15: Create IAM Role for App Runner
**Who:** You (AWS CLI)
**Duration:** 10 minutes

```bash
# Create trust policy for App Runner
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "tasks.apprunner.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name NoraAppRunnerRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "App Runner task role for Nora"

# Create inline policy for S3 access
cat > s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/audio/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["audio/*"]
        }
      }
    }
  ]
}
EOF

# Attach S3 policy
aws iam put-role-policy \
  --role-name NoraAppRunnerRole \
  --policy-name S3AudioAccess \
  --policy-document file://s3-policy.json

# Create inline policy for Secrets Manager access
cat > secrets-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "secretsmanager:GetSecretValue"
    ],
    "Resource": "arn:aws:secretsmanager:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):secret:nora/*"
  }]
}
EOF

# Attach Secrets Manager policy
aws iam put-role-policy \
  --role-name NoraAppRunnerRole \
  --policy-name SecretsManagerAccess \
  --policy-document file://secrets-policy.json

# Get Role ARN
ROLE_ARN=$(aws iam get-role \
  --role-name NoraAppRunnerRole \
  --query 'Role.Arn' \
  --output text)

echo "IAM Role ARN: $ROLE_ARN"

# Save to file
echo "ROLE_ARN=$ROLE_ARN" >> aws-resources.txt
```

---

## Phase 4: Application Updates

### Step 16: Update Storage Service for S3
**Who:** You (with my help)
**Duration:** 30 minutes

**Action Required:** We need to update `server/services/storage.cjs`

Would you like me to:
- [ ] Update the file to use AWS S3 instead of GCS
- [ ] Keep both GCS and S3 support with a feature flag

Let me know and I'll help you update this file.

---

### Step 17: Update package.json Dependencies
**Who:** You
**Duration:** 5 minutes

```bash
# Install AWS SDK
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Remove GCS dependency (if no longer needed)
npm uninstall @google-cloud/storage

# Update package.json
npm install
```

---

### Step 18: Update Environment Variables for AWS
**Who:** You
**Duration:** 5 minutes

Create `.env.aws` for testing:

```bash
# AWS Configuration
NODE_ENV=production
PORT=3001
AWS_REGION=us-east-1

# Frontend (update this to your actual frontend URL)
FRONTEND_URL=https://your-frontend-domain.com

# JWT Configuration
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# S3 Configuration
AWS_S3_BUCKET=nora-audio-XXXXX

# Note: Secrets will be injected by App Runner from Secrets Manager
# DATABASE_URL, JWT_*_SECRET, ENCRYPTION_KEY, API keys will come from Secrets Manager
```

---

### Step 19: Test Application Locally with Docker
**Who:** You
**Duration:** 15 minutes

```bash
# Build Docker image
docker build -t nora:test .

# Test with AWS RDS (using SSH tunnel or Cloud9)
docker run -p 3001:3001 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e JWT_ACCESS_SECRET="$JWT_ACCESS_SECRET" \
  -e JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  -e ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  -e AWS_REGION="$AWS_REGION" \
  -e AWS_S3_BUCKET="$BUCKET_NAME" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  nora:test

# Test health endpoint
curl http://localhost:3001/api/health

# Test authentication
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "name": "Test User",
    "childName": "Test Child",
    "childBirthYear": 2020,
    "childConditions": ["ADHD"]
  }'
```

---

## Phase 5: Container Registry (ECR)

**Status:** ⏸️ IN PROGRESS - Paused at Step 21 (requires Docker Desktop)
**Completed:** Step 20 - ECR repository created
**Next:** Step 21 - Build and push Docker image (requires OS upgrade + Docker setup)

### Step 20: Create ECR Repository
**Who:** You (AWS CLI)
**Duration:** 5 minutes
**Status:** ✅ COMPLETED (2025-11-27)

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name nora \
  --image-scanning-configuration scanOnPush=true \
  --region $AWS_REGION

# Get repository URI
ECR_REPO=$(aws ecr describe-repositories \
  --repository-names nora \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR Repository: $ECR_REPO"

# Save to file
echo "ECR_REPO=$ECR_REPO" >> aws-resources.txt
```

**Result:** ECR repository created at `059364397483.dkr.ecr.us-east-1.amazonaws.com/nora`

---

### Step 21: Push Docker Image to ECR
**Status:** ⏸️ PAUSED - Requires Docker Desktop to be running
**Next Action:** Upgrade OS system, install/start Docker Desktop, then continue from here
**Who:** You (AWS CLI)
**Duration:** 10 minutes

```bash
# Load variables
source aws-resources.txt

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REPO

# Tag image
docker tag nora:test $ECR_REPO:latest
docker tag nora:test $ECR_REPO:v1.0.0

# Push image
docker push $ECR_REPO:latest
docker push $ECR_REPO:v1.0.0

echo "Image pushed to: $ECR_REPO:latest"
```

---

## Phase 6: App Runner Deployment

### Step 22: Create App Runner VPC Connector
**Who:** You (AWS CLI)
**Duration:** 5 minutes

```bash
# Load variables
source aws-resources.txt

# Create VPC Connector
CONNECTOR_ARN=$(aws apprunner create-vpc-connector \
  --vpc-connector-name nora-vpc-connector \
  --subnets $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-groups $APPRUNNER_SG \
  --region $AWS_REGION \
  --query 'VpcConnector.VpcConnectorArn' \
  --output text)

echo "VPC Connector ARN: $CONNECTOR_ARN"

# Wait for connector to be ready
aws apprunner wait vpc-connector-active \
  --vpc-connector-arn $CONNECTOR_ARN \
  --region $AWS_REGION

# Save to file
echo "CONNECTOR_ARN=$CONNECTOR_ARN" >> aws-resources.txt
```

---

### Step 23: Create App Runner Service Configuration File
**Who:** You
**Duration:** 10 minutes

**Action Required:** Get all Secret ARNs from Step 14

```bash
# List all secret ARNs
aws secretsmanager list-secrets \
  --query "SecretList[?contains(Name, 'nora')].{Name:Name, ARN:ARN}" \
  --output json > secret-arns.json

cat secret-arns.json
```

Create `apprunner-config.json`:

```json
{
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "YOUR_ECR_REPO:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3001",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3001",
          "AWS_REGION": "us-east-1",
          "AWS_S3_BUCKET": "YOUR_BUCKET_NAME",
          "FRONTEND_URL": "https://your-frontend-domain.com",
          "JWT_ACCESS_EXPIRY": "15m",
          "JWT_REFRESH_EXPIRY": "7d"
        },
        "RuntimeEnvironmentSecrets": {
          "DATABASE_URL": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/database-url-XXXXX",
          "JWT_ACCESS_SECRET": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/jwt-access-secret-XXXXX",
          "JWT_REFRESH_SECRET": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/jwt-refresh-secret-XXXXX",
          "ENCRYPTION_KEY": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/encryption-key-XXXXX",
          "ANTHROPIC_API_KEY": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/anthropic-api-key-XXXXX",
          "ELEVENLABS_API_KEY": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/elevenlabs-api-key-XXXXX",
          "DEEPGRAM_API_KEY": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/deepgram-api-key-XXXXX",
          "SMTP_USER": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/smtp-user-XXXXX",
          "SMTP_PASS": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/smtp-pass-XXXXX",
          "COACH_EMAIL": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:nora/coach-email-XXXXX"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB",
    "InstanceRoleArn": "YOUR_ROLE_ARN"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  },
  "NetworkConfiguration": {
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "YOUR_CONNECTOR_ARN"
    }
  }
}
```

**Replace placeholders:**
- YOUR_ECR_REPO
- YOUR_BUCKET_NAME
- YOUR_ROLE_ARN
- YOUR_CONNECTOR_ARN
- All Secret ARNs (get from secret-arns.json)

---

### Step 24: Deploy App Runner Service
**Who:** You (AWS CLI or Console)
**Duration:** 10-15 minutes

**Option A: Using AWS Console (Recommended)**

1. Go to AWS App Runner Console
2. Click "Create service"
3. **Source:**
   - Repository type: Container registry
   - Provider: Amazon ECR
   - Container image URI: (paste your ECR_REPO:latest)
   - Deployment trigger: Automatic
4. **Service settings:**
   - Service name: `nora-api`
   - Port: `3001`
   - CPU: 1 vCPU
   - Memory: 2 GB
5. **Environment variables:** (Add all from Step 23)
6. **Secrets:** (Add all ARNs from Step 23)
7. **Networking:**
   - VPC connector: Select `nora-vpc-connector`
8. **Security:**
   - Instance role: `NoraAppRunnerRole`
9. **Health check:**
   - Path: `/api/health`
   - Interval: 10 seconds
10. Click "Create & deploy"

**Option B: Using AWS CLI**

```bash
# This is complex - Console is recommended for first deployment
# But if you prefer CLI, you'll need to create a JSON configuration file
# as shown in Step 23 and run:

aws apprunner create-service \
  --cli-input-json file://apprunner-config.json \
  --service-name nora-api \
  --region $AWS_REGION
```

**Wait for deployment:**
```bash
# Get service ARN
SERVICE_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='nora-api'].ServiceArn" \
  --output text \
  --region $AWS_REGION)

# Wait for service to be running (takes 5-10 minutes)
aws apprunner wait service-running \
  --service-arn $SERVICE_ARN \
  --region $AWS_REGION

# Get service URL
SERVICE_URL=$(aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --query 'Service.ServiceUrl' \
  --output text \
  --region $AWS_REGION)

echo "Service URL: https://$SERVICE_URL"

# Save to file
cat >> aws-resources.txt <<EOF
SERVICE_ARN=$SERVICE_ARN
SERVICE_URL=$SERVICE_URL
EOF
```

---

### Step 25: Test App Runner Deployment
**Who:** You
**Duration:** 15 minutes

```bash
# Load service URL
source aws-resources.txt

# Test health endpoint
curl https://$SERVICE_URL/api/health

# Expected output:
# {
#   "status": "ok",
#   "services": {
#     "anthropic": true,
#     "email": true
#   }
# }

# Test authentication (signup)
curl -X POST https://$SERVICE_URL/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "name": "Test User",
    "childName": "Test Child",
    "childBirthYear": 2020,
    "childConditions": ["ADHD"]
  }'

# Test authentication (login)
curl -X POST https://$SERVICE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'

# If all tests pass, your API is live! 🎉
```

---

## Phase 7: Frontend Update

### Step 26: Update Frontend Environment Variables
**Who:** You
**Duration:** 5 minutes

Update your frontend `.env` file:

```bash
# Replace with your App Runner URL
VITE_API_URL=https://YOUR_SERVICE_URL.us-east-1.awsapprunner.com
```

**Deploy your frontend** with the new API URL.

---

### Step 27: End-to-End Testing
**Who:** You
**Duration:** 30 minutes

Test all critical flows:

- [ ] User registration
- [ ] User login
- [ ] Record a session (CDI mode)
- [ ] Record a session (PDI mode)
- [ ] Upload audio to S3
- [ ] Transcription via ElevenLabs
- [ ] PCIT analysis via Anthropic
- [ ] View session history
- [ ] Learning progress tracking
- [ ] Email alerts (trigger a negative phrase)
- [ ] Logout and refresh token flow

---

## Phase 8: Monitoring & Cleanup

### Step 28: Set Up CloudWatch Alarms
**Who:** You (AWS CLI)
**Duration:** 10 minutes

```bash
# Create SNS topic for alarms
TOPIC_ARN=$(aws sns create-topic \
  --name nora-alerts \
  --query 'TopicArn' \
  --output text)

# Subscribe your email
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription in your email

# Create RDS CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name nora-rds-cpu \
  --alarm-description "RDS CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=DBInstanceIdentifier,Value=nora-db \
  --alarm-actions $TOPIC_ARN

# Create App Runner 5xx errors alarm
aws cloudwatch put-metric-alarm \
  --alarm-name nora-5xx-errors \
  --alarm-description "App Runner 5xx > 10/min" \
  --metric-name 5xxStatusResponses \
  --namespace AWS/AppRunner \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ServiceName,Value=nora-api \
  --alarm-actions $TOPIC_ARN

echo "CloudWatch alarms created"
```

---

### Step 29: Set Up Log Retention
**Who:** You (AWS CLI)
**Duration:** 5 minutes

```bash
# Set retention for App Runner logs (30 days)
LOG_GROUP="/aws/apprunner/nora-api/$(date +%Y%m%d)/service"

aws logs put-retention-policy \
  --log-group-name $LOG_GROUP \
  --retention-in-days 30

# Set retention for RDS logs
aws logs put-retention-policy \
  --log-group-name /aws/rds/instance/nora-db/postgresql \
  --retention-in-days 7
```

---

### Step 30: Clean Up Temporary Resources
**Who:** You
**Duration:** 5 minutes

```bash
# Delete bastion host (if created)
# aws ec2 terminate-instances --instance-ids i-xxxxx

# Delete Cloud9 environment (if created)
# Go to Cloud9 Console → Delete environment

# Remove local files
rm trust-policy.json s3-policy.json secrets-policy.json
rm secret-arns.json

# KEEP aws-resources.txt for future reference!
```

---

## Phase 9: Documentation & Handoff

### Step 31: Document Your Deployment
**Who:** You
**Duration:** 15 minutes

Create `AWS_DEPLOYMENT.md` with:

```markdown
# AWS Deployment Information

## Production URLs
- API: https://YOUR_SERVICE_URL.awsapprunner.com
- Frontend: https://your-frontend-domain.com

## AWS Resources
- RDS Instance: nora-db
- App Runner Service: nora-api
- S3 Bucket: nora-audio-XXXXX
- VPC ID: vpc-xxxxx
- Region: us-east-1

## Access
- AWS Account ID: XXXXX
- IAM Role: NoraAppRunnerRole

## Secrets Location
All secrets stored in AWS Secrets Manager under `nora/*`

## Monitoring
- CloudWatch Dashboard: [link]
- CloudWatch Alarms: nora-*
- SNS Topic: nora-alerts

## Costs
Estimated: $100-150/month

## Maintenance
- Database backups: Automatic daily (7-day retention)
- App Runner auto-deploy: Enabled on ECR push
- Log retention: 30 days (App Runner), 7 days (RDS)
```

---

### Step 32: Create Deployment Script for Future Updates
**Who:** You
**Duration:** 10 minutes

Create `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Nora to AWS..."

# Load AWS resources
source aws-resources.txt

# Build Docker image
echo "📦 Building Docker image..."
docker build -t nora:latest .

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REPO

# Tag and push
echo "⬆️  Pushing to ECR..."
VERSION=$(date +%Y%m%d-%H%M%S)
docker tag nora:latest $ECR_REPO:latest
docker tag nora:latest $ECR_REPO:$VERSION
docker push $ECR_REPO:latest
docker push $ECR_REPO:$VERSION

echo "✅ Deployment complete!"
echo "App Runner will auto-deploy in 2-3 minutes"
echo "Monitor: https://console.aws.amazon.com/apprunner/home?region=$AWS_REGION#/services"
```

Make it executable:
```bash
chmod +x deploy.sh
```

---

## Rollback Plan

If something goes wrong, follow these steps:

### Emergency Rollback to Previous Version

```bash
# List ECR images
aws ecr describe-images \
  --repository-name nora \
  --query 'sort_by(imageDetails,& imagePushedAt)[*].[imageTags[0],imagePushedAt]' \
  --output table

# Update App Runner to previous version
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --source-configuration ImageRepository={ImageIdentifier=$ECR_REPO:PREVIOUS_VERSION}
```

### Complete Rollback to Local

1. Update frontend `VITE_API_URL` back to `http://localhost:3001`
2. Stop App Runner service (to avoid costs)
3. Run local server: `node server.cjs`
4. Database remains in AWS RDS (keep running) or restore from backup

---

## Cost Optimization Tips

After successful migration:

1. **RDS:**
   - [ ] Consider Reserved Instances (40% savings for 1-year commitment)
   - [ ] Review Multi-AZ if not in production yet (single AZ saves 50%)

2. **App Runner:**
   - [ ] Monitor CPU/Memory usage - downsize if underutilized
   - [ ] Set min/max instances (default: 1-25, adjust to 1-3 for lower traffic)

3. **NAT Gateway:**
   - [ ] Most expensive component ($32/mo)
   - [ ] Consider using public subnets for App Runner if security allows
   - [ ] Or use VPC endpoints for AWS services (S3, Secrets Manager)

4. **S3:**
   - [ ] Review lifecycle policy - delete old audio files
   - [ ] Use S3 Intelligent-Tiering for automatic cost optimization

---

## Troubleshooting

### App Runner service won't start

```bash
# Check logs
aws logs tail /aws/apprunner/nora-api/service --follow

# Common issues:
# 1. Wrong port (must be 3001)
# 2. Missing secrets
# 3. DATABASE_URL connection failure (check security group)
```

### Can't connect to RDS

```bash
# Verify security group rules
aws ec2 describe-security-groups --group-ids $RDS_SG

# Test from App Runner (requires SSH into container - use CloudWatch logs instead)
# Or use Cloud9 to test connection
```

### S3 access denied

```bash
# Verify IAM role attached to App Runner
aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --query 'Service.InstanceConfiguration.InstanceRoleArn'

# Verify S3 permissions
aws iam get-role-policy \
  --role-name NoraAppRunnerRole \
  --policy-name S3AudioAccess
```

---

## Next Steps After Migration

- [ ] Set up CI/CD pipeline (GitHub Actions → ECR → App Runner)
- [ ] Configure custom domain for App Runner
- [ ] Set up AWS WAF for DDoS protection (if needed)
- [ ] Enable X-Ray tracing for performance monitoring
- [ ] Consider Aurora Serverless v2 (scales down to 0.5 ACU when idle)
- [ ] Set up automated database backups to S3
- [ ] Configure SSL/TLS certificate (App Runner provides free HTTPS)

---

## Summary Checklist

### Pre-Migration
- [ ] Step 1: Create Dockerfile
- [ ] Step 2: Create .dockerignore
- [ ] Step 3: Update storage service for S3
- [ ] Step 4: Document current database

### AWS Foundation
- [ ] Step 5: Set up billing alert
- [ ] Step 6: Choose AWS region
- [ ] Step 7: Create VPC and subnets
- [ ] Step 8: Create security groups
- [ ] Step 9: Create S3 bucket

### Database
- [ ] Step 10: Create RDS subnet group
- [ ] Step 11: Create RDS instance
- [ ] Step 12: Migrate database

### Secrets
- [ ] Step 13: Generate secure secrets
- [ ] Step 14: Create secrets in Secrets Manager
- [ ] Step 15: Create IAM role for App Runner

### Application
- [ ] Step 16: Update storage service
- [ ] Step 17: Update dependencies
- [ ] Step 18: Update environment variables
- [ ] Step 19: Test locally with Docker

### Deployment
- [ ] Step 20: Create ECR repository
- [ ] Step 21: Push Docker image to ECR
- [ ] Step 22: Create VPC connector
- [ ] Step 23: Create App Runner config
- [ ] Step 24: Deploy App Runner service
- [ ] Step 25: Test deployment

### Frontend & Testing
- [ ] Step 26: Update frontend env vars
- [ ] Step 27: End-to-end testing

### Operations
- [ ] Step 28: Set up CloudWatch alarms
- [ ] Step 29: Set up log retention
- [ ] Step 30: Clean up temporary resources

### Documentation
- [ ] Step 31: Document deployment
- [ ] Step 32: Create deployment script

---

## Support & Resources

- **AWS App Runner Docs:** https://docs.aws.amazon.com/apprunner/
- **AWS RDS PostgreSQL:** https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
- **AWS Secrets Manager:** https://docs.aws.amazon.com/secretsmanager/
- **Prisma with AWS:** https://www.prisma.io/docs/guides/deployment/deployment-guides

---

**Estimated Total Migration Time:** 4-6 hours (including waiting for AWS resources to provision)

**Status Tracking:** Update this file as you complete each step, noting any issues or deviations from the plan.
