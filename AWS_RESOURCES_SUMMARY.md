# AWS Resources Summary - NORA

**Last Updated:** 2025-11-28
**Account ID:** 059364397483
**Region:** us-east-1 (N. Virginia)

---

## 📊 Quick Overview

| Category | Production | Development | Total Cost/Month |
|----------|-----------|-------------|------------------|
| **Databases** | nora-db (t3.micro) | nora-db-dev (t3.micro) | ~$30 |
| **Storage** | S3 bucket (shared) | S3 bucket (shared) | ~$5 |
| **Compute** | App Runner (1 vCPU, 2GB) | - | ~$25 |
| **Bastion** | EC2 t3.micro | EC2 t3.micro | ~$7.50 |
| **Networking** | VPC, Subnets, IGW | - | Free |
| **Total** | - | - | **~$67.50/month** |

---

## 🗄️ Databases

### Production Database (nora-db)
```
Instance:     nora-db
Type:         db.t3.micro
Engine:       PostgreSQL 15.8
Storage:      20 GB gp3 (encrypted)
Database:     nora
Endpoint:     nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com
User:         nora_admin
Status:       ✅ Running (8 tables, 10 migrations applied)
Backup:       7 days retention
Cost:         ~$15/month
```

### Development Database (nora-db-dev)
```
Instance:     nora-db-dev
Type:         db.t3.micro
Engine:       PostgreSQL 15.8
Storage:      20 GB gp3 (encrypted)
Database:     nora_dev
Endpoint:     nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com
User:         nora_admin
Status:       ✅ Running (8 tables, 10 migrations applied)
Backup:       7 days retention
Cost:         ~$15/month
```

**Database Tables (both environments):**
1. User - User accounts with encrypted fields
2. Session - Practice sessions with PCIT coding
3. LearningProgress - Learning progress tracking
4. ModuleHistory - Module viewing history
5. RefreshToken - Authentication refresh tokens
6. RiskAuditLog - Risk detection audit logs
7. ThirdPartyRequest - Third-party data requests
8. WacbSurvey - WACB survey responses

---

## 📦 Storage (S3)

```
Bucket:       nora-audio-059364397483
Region:       us-east-1
Encryption:   AES-256 (at rest)
Versioning:   Enabled
Access:       Private (presigned URLs only)
Usage:        Audio files, migrations, backups
Cost:         ~$5/month (estimated)
```

---

## 🚀 Compute (App Runner)

```
Service:      nora-api
Status:       ✅ Running
URL:          https://p2tgddmyxt.us-east-1.awsapprunner.com
Image:        059364397483.dkr.ecr.us-east-1.amazonaws.com/nora:latest
Auto-deploy:  Enabled (triggers on ECR push)
vCPU:         1
Memory:       2 GB
Instances:    Min: 1, Max: 10
Scaling:      Auto-scale on 70% CPU
Health:       /api/health
Cost:         ~$25/month (1 instance)
```

---

## 🖥️ Bastion Host

```
Instance:     nora-bastion (i-0816636c6667be898)
Type:         t3.micro
AMI:          Amazon Linux 2023
Subnet:       Public (subnet-0efbc747bd1d3ba95)
Access:       AWS Systems Manager Session Manager
Installed:    PostgreSQL 15 client, Node.js 18, Prisma 5.22
Purpose:      Database access, migrations, debugging
Cost:         ~$7.50/month (if running 24/7)
              ~$0 (if stopped when not in use)
```

**Stop bastion to save costs:**
```bash
aws ec2 stop-instances --instance-ids i-0816636c6667be898 --region us-east-1
```

---

## 🌐 Networking (VPC)

### VPC Configuration
```
VPC ID:       vpc-0efa6ad4007e9573b
CIDR:         10.0.0.0/16
DNS:          Enabled
```

### Subnets
```
Public Subnet 1:  subnet-0efbc747bd1d3ba95 (10.0.1.0/24, AZ: us-east-1a)
Public Subnet 2:  subnet-0065993c9cebe2ede (10.0.2.0/24, AZ: us-east-1b)
Private Subnet 1: subnet-04da84d88d747b277 (10.0.10.0/24, AZ: us-east-1a)
Private Subnet 2: subnet-097ff1040953e9084 (10.0.11.0/24, AZ: us-east-1b)
```

### Gateways & Routing
```
Internet Gateway: igw-0f175550cc43332e4
Public Route Table: rtb-097dd98905dd11c34
  - 0.0.0.0/0 → Internet Gateway
```

### Security Groups
```
RDS SG:       sg-0f302445ddfce40f3
  - Port 5432 from App Runner SG
  - Port 5432 from Bastion SG

App Runner SG: sg-0dd55a292ee0e2fb9
  - HTTPS outbound (443)
  - PostgreSQL to RDS (5432)

Bastion SG:   sg-0364406d185c3e293
  - HTTPS outbound for SSM (443)
  - PostgreSQL to RDS (5432)
```

---

## 🔐 IAM Roles

### NoraAppRunnerTaskRole
```
ARN:      arn:aws:iam::059364397483:role/NoraAppRunnerTaskRole
Purpose:  App Runner task execution
Policies:
  - S3 access (nora-audio-059364397483)
  - Secrets Manager access
  - CloudWatch Logs
```

### AppRunnerECRAccessRole
```
ARN:      arn:aws:iam::059364397483:role/service-role/AppRunnerECRAccessRole
Purpose:  App Runner ECR image access
Policies:
  - ECR pull permissions
```

### NoraBastionRole
```
Purpose:  Bastion host EC2 instance
Policies:
  - AmazonSSMManagedInstanceCore (Session Manager access)
```

---

## 📥 Container Registry (ECR)

```
Repository:   nora
URI:          059364397483.dkr.ecr.us-east-1.amazonaws.com/nora
Images:       v1.0.0, v1.0.3, latest
Auto-deploy:  Enabled (App Runner watches for new images)
```

**Current deployed image:**
- Tag: `latest`
- Version: `v1.0.3`
- Built: 2025-11-27

---

## 🔑 Secrets & Credentials

All stored in `aws-resources.txt` (NOT committed to git):

```
JWT_ACCESS_SECRET:    56dcee7f...a23043
JWT_REFRESH_SECRET:   2d8fbfa8...9beb4b
ENCRYPTION_KEY:       40a4a693...00dcc5
DB_PASSWORD:          FPEBKqGY...4Bbw (production)
DB_PASSWORD_DEV:      D7upDeIj...F4Bbw (development)
```

---

## 🔗 Connection URLs

### Production
```bash
# App Runner
https://p2tgddmyxt.us-east-1.awsapprunner.com

# Database
postgresql://nora_admin:FPEBKqGY6LU4IXsxM4quqJMxfPccZCsn@nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora

# S3 Bucket
s3://nora-audio-059364397483
```

### Development
```bash
# Local Backend
http://localhost:3001

# Database
postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora_dev
```

---

## 📝 Migration Status

### Production Database (nora-db)
✅ All 10 migrations applied
- 20251120073046_init
- 20251121100710_add_learning_progress
- 20251121164347_add_child_metrics
- 20251122041323_add_user_streak_fields
- 20251124075746_add_child_age_and_condition
- 20251124102035_add_third_party_request_anonymization
- 20251125071312_convert_child_conditions_to_encrypted_string
- 20251125150548_make_child_fields_mandatory
- 20251126111947_add_email_hash_field
- 20251126123659_add_wacb_survey

### Development Database (nora-db-dev)
✅ All 10 migrations applied (same as production)

---

## 📚 Documentation

- **AWS_RESOURCES_SUMMARY.md** - This file (resource overview)
- **DATABASE_ACCESS_GUIDE.md** - How to access and query databases
- **DOCKER_DEPLOYMENT_CHECKLIST.md** - Deployment procedures
- **aws-resources.txt** - All resource IDs and credentials
- **AWS_MIGRATION_PLAN.md** - Original migration plan
- **AWS_INFRASTRUCTURE_OVERVIEW.md** - Architecture diagrams

---

## 💰 Monthly Cost Breakdown

| Service | Resource | Cost |
|---------|----------|------|
| RDS | nora-db (production) | $15.00 |
| RDS | nora-db-dev (development) | $15.00 |
| App Runner | 1 instance, 1 vCPU, 2GB | $25.00 |
| S3 | Storage + requests | $5.00 |
| EC2 | Bastion (if running 24/7) | $7.50 |
| Data Transfer | Minimal | $0.50 |
| **Total** | | **~$68.00** |

**Cost Optimization Tips:**
- Stop bastion when not in use: Save $7.50/month
- Use S3 lifecycle policies for old audio files
- Consider RDS reserved instances for production (40% savings)

---

## 🔒 Security Best Practices

✅ **Currently Implemented:**
- Databases in private subnets (no public access)
- All data encrypted at rest
- TLS/SSL for data in transit
- IAM roles with least privilege
- Security groups restrict access
- Secrets in environment variables (not code)
- VPC isolation between resources

⚠️ **Recommendations:**
- Enable AWS CloudTrail for audit logs
- Set up AWS Config for compliance
- Enable GuardDuty for threat detection
- Implement AWS WAF for App Runner
- Rotate database passwords quarterly

---

## 🚨 Emergency Contacts

**AWS Support:** https://console.aws.amazon.com/support/home
**Account ID:** 059364397483
**Root Email:** (stored securely)

**Quick Actions:**
- View App Runner logs: `aws logs tail /aws/apprunner/nora-api/0f1877f0a2d8454da6a4ebde1979fec6/application --region us-east-1 --follow`
- Check database: `aws ssm start-session --target i-0816636c6667be898`
- Rollback deployment: See DOCKER_DEPLOYMENT_CHECKLIST.md

---

## ✅ Health Checks

```bash
# Check App Runner status
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:us-east-1:059364397483:service/nora-api/0f1877f0a2d8454da6a4ebde1979fec6 \
  --region us-east-1 \
  --query 'Service.Status'

# Test production API
curl https://p2tgddmyxt.us-east-1.awsapprunner.com/api/health

# Test database connection
aws ssm start-session --target i-0816636c6667be898
```

---

**Last health check:** 2025-11-28
**Status:** ✅ All systems operational
