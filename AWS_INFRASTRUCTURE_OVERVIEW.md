# AWS Infrastructure Overview

**Date:** 2025-11-27
**Account:** 059364397483
**Region:** us-east-1 (N. Virginia)

---

## 🏗️ Architecture Diagram

```
                                    ┌─────────────────────────────────────────────┐
                                    │         AWS Cloud (us-east-1)               │
                                    │                                             │
                                    │  ┌───────────────────────────────────────┐  │
                                    │  │  VPC: nora-vpc                 │  │
                                    │  │  CIDR: 10.0.0.0/16                    │  │
                                    │  │                                       │  │
                                    │  │  ┌─────────────────────────────┐    │  │
                                    │  │  │  Internet Gateway           │    │  │
                                    │  │  │  (igw-0f175550cc43332e4)    │    │  │
                                    │  │  └─────────────┬───────────────┘    │  │
                                    │  │                │                     │  │
                                    │  │  ┌─────────────┴─────────────┐     │  │
                                    │  │  │  Public Route Table        │     │  │
                                    │  │  │  Route: 0.0.0.0/0 → IGW   │     │  │
                                    │  │  └─────────────┬───────────────┘    │  │
                                    │  │                │                     │  │
          ┌─────────────────────────┼──┼────────────────┴────────────────────┼──┼─────────────────────────┐
          │                         │  │                │                     │  │                         │
          │  Availability Zone 1a   │  │  ┌─────────────┴──────────────┐    │  │  Availability Zone 1b   │
          │                         │  │  │                             │    │  │                         │
          │  ┌──────────────────┐  │  │  │  ┌──────────────────────┐  │    │  │  ┌──────────────────┐  │
          │  │  Public Subnet   │  │  │  │  │  Public Subnet       │  │    │  │  │  Public Subnet   │  │
          │  │  10.0.1.0/24     │  │  │  │  │  10.0.2.0/24         │  │    │  │  │  (future use)    │  │
          │  │  subnet-0e71f... │  │  │  │  │  subnet-03ccc...     │  │    │  │  └──────────────────┘  │
          │  │                  │  │  │  │  │                      │  │    │  │                         │
          │  │  [App Runner]    │  │  │  │  │                      │  │    │  │                         │
          │  │  (future)        │  │  │  │  │                      │  │    │  │                         │
          │  └──────────────────┘  │  │  │  └──────────────────────┘  │    │  │                         │
          │                         │  │  │                             │    │  │                         │
          │  ┌──────────────────┐  │  │  │  ┌──────────────────────┐  │    │  │  ┌──────────────────┐  │
          │  │  Private Subnet  │  │  │  │  │  Private Subnet      │  │    │  │  │  Private Subnet  │  │
          │  │  10.0.10.0/24    │  │  │  │  │  10.0.11.0/24        │  │    │  │  │  (backup zone)   │  │
          │  │  subnet-0d866... │  │  │  │  │  subnet-0686...      │  │    │  │  └──────────────────┘  │
          │  │                  │  │  │  │  │                      │  │    │  │                         │
          │  │  ┌────────────┐  │  │  │  │  │                      │  │    │  │                         │
          │  │  │  RDS        │◄─┼──┼──┼──┼──┼─────────────┐       │  │    │  │                         │
          │  │  │  PostgreSQL│  │  │  │  │  │             │       │  │    │  │                         │
          │  │  │  (future)  │  │  │  │  │  │             │       │  │    │  │                         │
          │  │  └────────────┘  │  │  │  │  │             │       │  │    │  │                         │
          │  └──────────────────┘  │  │  │  └─────────────┼───────┘  │    │  │                         │
          │                         │  │                  │           │    │  │                         │
          └─────────────────────────┼──┼──────────────────┼───────────┼────┼──┼─────────────────────────┘
                                    │  │                  │           │    │  │
                                    │  │  ┌───────────────┴───────────┴──┐ │  │
                                    │  │  │  Security Group Rules       │ │  │
                                    │  │  │  • RDS: Allow 5432 from App │ │  │
                                    │  │  │  • App: Allow all outbound  │ │  │
                                    │  │  └─────────────────────────────┘ │  │
                                    │  └───────────────────────────────────┘  │
                                    │                                         │
                                    │  ┌───────────────────────────────────┐  │
                                    │  │  S3 Bucket (Regional Service)     │  │
                                    │  │  nora-audio-059364397483   │  │
                                    │  │  • Encrypted (AES256)             │  │
                                    │  │  • Versioned                      │  │
                                    │  │  • Lifecycle: 90 days             │  │
                                    │  └───────────────────────────────────┘  │
                                    └─────────────────────────────────────────┘
```

---

## 📦 Resource Inventory

### 1. **S3 Bucket** (Storage Layer)

**Name:** `nora-audio-059364397483`
**Purpose:** Store audio recordings from PCIT sessions
**Region:** us-east-1

**Configuration:**
- ✅ **Encryption:** AES-256 (server-side encryption)
- ✅ **Versioning:** Enabled (protects against accidental deletion)
- ✅ **Public Access:** Blocked (private bucket)
- ✅ **Lifecycle Policy:** Automatically delete files after 90 days
- ✅ **Access:** Via signed URLs (7-day expiration)

**Security:**
- Only accessible via IAM roles (App Runner will have permission)
- No public internet access
- All data encrypted at rest

**Storage Structure:**
```
s3://nora-audio-059364397483/
└── audio/
    └── {userId}/
        └── {sessionId}.webm
```

---

### 2. **VPC** (Network Layer)

**VPC ID:** `vpc-0efa6ad4007e9573b`
**CIDR Block:** `10.0.0.0/16` (65,536 IP addresses)
**Purpose:** Isolated network environment for your application

**Key Features:**
- ✅ DNS Support: Enabled
- ✅ DNS Hostnames: Enabled
- ✅ Availability Zones: 2 (us-east-1a, us-east-1b) for high availability

**Internet Gateway:** `igw-0f175550cc43332e4`
- Allows resources in public subnets to access the internet
- Required for App Runner to make API calls (Anthropic, ElevenLabs)

---

### 3. **Subnets** (Network Segmentation)

#### Public Subnets (Internet-accessible)

| Name | Subnet ID | CIDR | AZ | Purpose |
|------|-----------|------|-----|---------|
| nora-public-1a | `subnet-0efbc747bd1d3ba95` | 10.0.1.0/24 | us-east-1a | App Runner (251 IPs) |
| nora-public-1b | `subnet-0065993c9cebe2ede` | 10.0.2.0/24 | us-east-1b | App Runner backup (251 IPs) |

**Characteristics:**
- Connected to Internet Gateway via route table
- Can make outbound internet requests
- App Runner will be deployed here

#### Private Subnets (No direct internet access)

| Name | Subnet ID | CIDR | AZ | Purpose |
|------|-----------|------|-----|---------|
| nora-private-1a | `subnet-04da84d88d747b277` | 10.0.10.0/24 | us-east-1a | RDS Database (251 IPs) |
| nora-private-1b | `subnet-097ff1040953e9084` | 10.0.11.0/24 | us-east-1b | RDS standby (251 IPs) |

**Characteristics:**
- No direct internet access (secure)
- RDS will be deployed here
- Only accessible from within the VPC

---

### 4. **Security Groups** (Firewall Rules)

#### RDS Security Group

**Group ID:** `sg-0f302445ddfce40f3`
**Name:** `nora-rds-sg`
**Purpose:** Control access to PostgreSQL database

**Inbound Rules:**
- ✅ **Port 5432 (PostgreSQL)** from App Runner Security Group only
- ❌ No internet access
- ❌ No SSH access

**Outbound Rules:**
- Default: Allow all outbound (RDS doesn't need to initiate connections)

**Security Model:**
- Only App Runner instances can connect to the database
- Zero-trust: Deny all by default, allow only what's needed

#### App Runner Security Group

**Group ID:** `sg-0dd55a292ee0e2fb9`
**Name:** `nora-apprunner-sg`
**Purpose:** Control App Runner network access

**Inbound Rules:**
- None needed (App Runner is behind AWS load balancer)

**Outbound Rules:**
- ✅ **All traffic (0.0.0.0/0)** - Allows:
  - HTTPS (443) to Anthropic API
  - HTTPS (443) to ElevenLabs API
  - PostgreSQL (5432) to RDS
  - HTTPS (443) to AWS services (S3, Secrets Manager)

---

## 🔒 Security Architecture

### Defense in Depth

**Layer 1: Network Isolation**
- VPC isolates resources from the public internet
- Private subnets have no internet gateway route
- Security groups act as virtual firewalls

**Layer 2: Encryption**
- S3: Data encrypted at rest (AES-256)
- RDS: Will be encrypted at rest (when created)
- App Runner: HTTPS/TLS for data in transit

**Layer 3: Access Control**
- IAM roles for service-to-service communication
- No hardcoded credentials
- Secrets stored in AWS Secrets Manager

**Layer 4: Application Security**
- User data encrypted in database (AES-256-GCM)
- Passwords hashed with bcrypt
- JWT for authentication

---

## 💰 Current Cost Breakdown

| Resource | Type | Cost/Month | Status |
|----------|------|------------|--------|
| S3 Bucket | Storage | ~$0.25 | ✅ Running |
| VPC | Networking | FREE | ✅ Running |
| Subnets | Networking | FREE | ✅ Running |
| Internet Gateway | Networking | FREE | ✅ Running |
| Security Groups | Firewall | FREE | ✅ Running |
| **Total (Phase 1)** | | **~$0.25/mo** | ✅ Running |

**Notes:**
- S3 cost assumes 10GB storage + minimal requests
- Data transfer charges apply for downloads ($0.09/GB)
- Phase 2 (RDS) will add ~$30/month
- Phase 5 (App Runner) will add ~$25-50/month

---

## 📊 What's Next

### Phase 2: Database (Not Yet Created)

**Components to be created:**
1. RDS Subnet Group (associate private subnets)
2. RDS PostgreSQL Instance (db.t3.small, Multi-AZ)
3. Database migration from local to AWS

**Estimated Time:** 20-30 minutes
**Estimated Cost:** ~$30/month

### Phase 3: Secrets Management (Not Yet Created)

**Components to be created:**
1. AWS Secrets Manager secrets (DATABASE_URL, JWT secrets, API keys)
2. IAM role with Secrets Manager permissions

**Estimated Time:** 15 minutes
**Estimated Cost:** ~$0.40/month per secret (~$4/month total)

### Phase 4: Application Updates (Not Yet Created)

**Components to be created:**
1. No AWS resources, just code updates

### Phase 5: Deployment (Not Yet Created)

**Components to be created:**
1. ECR Repository (container registry)
2. App Runner VPC Connector
3. App Runner Service

**Estimated Time:** 30 minutes
**Estimated Cost:** ~$25-50/month

---

## 🎯 Architecture Benefits

### High Availability
- Resources spread across 2 Availability Zones
- If one AZ fails, the other continues running
- RDS Multi-AZ provides automatic failover

### Security
- Database not exposed to internet
- All data encrypted at rest and in transit
- Principle of least privilege (minimal permissions)

### Scalability
- App Runner auto-scales based on traffic
- S3 scales automatically (unlimited storage)
- RDS can be upgraded to larger instance types

### Cost Optimization
- Pay only for what you use
- Auto-scaling prevents over-provisioning
- S3 lifecycle policy reduces storage costs

---

## 📝 Resource IDs Reference

All resource IDs are saved in: `/Users/mia/happypillar/aws-resources.txt`

```bash
AWS_ACCOUNT_ID=059364397483
AWS_REGION=us-east-1
BUCKET_NAME=nora-audio-059364397483
VPC_ID=vpc-0efa6ad4007e9573b
IGW_ID=igw-0f175550cc43332e4
PUBLIC_SUBNET_1=subnet-0efbc747bd1d3ba95
PUBLIC_SUBNET_2=subnet-0065993c9cebe2ede
PRIVATE_SUBNET_1=subnet-04da84d88d747b277
PRIVATE_SUBNET_2=subnet-097ff1040953e9084
PUBLIC_RT=rtb-097dd98905dd11c34
RDS_SG=sg-0f302445ddfce40f3
APPRUNNER_SG=sg-0dd55a292ee0e2fb9
```

---

## 🔍 How to Verify Resources

### Via AWS CLI

```bash
# Source the resource IDs
source aws-resources.txt

# Check VPC
aws ec2 describe-vpcs --vpc-ids $VPC_ID

# Check Subnets
aws ec2 describe-subnets --subnet-ids $PUBLIC_SUBNET_1 $PRIVATE_SUBNET_1

# Check Security Groups
aws ec2 describe-security-groups --group-ids $RDS_SG $APPRUNNER_SG

# Check S3 Bucket
aws s3 ls s3://$BUCKET_NAME
```

### Via AWS Console

1. **VPC Dashboard:** https://console.aws.amazon.com/vpc/home?region=us-east-1
   - View VPCs, Subnets, Security Groups, Route Tables

2. **S3 Console:** https://s3.console.aws.amazon.com/s3/home?region=us-east-1
   - View bucket: `nora-audio-059364397483`

---

## ⚠️ Important Notes

### What's NOT Created Yet
- ❌ RDS PostgreSQL database
- ❌ Secrets Manager secrets
- ❌ App Runner service
- ❌ ECR repository
- ❌ IAM roles for services

### Cost Monitoring
- Set up billing alert: $50/month threshold ✅
- Current spend: ~$0.25/month
- Expected final spend: ~$100-150/month

### Cleanup Instructions
If you need to delete everything and start over:

```bash
# Source resource IDs
source aws-resources.txt

# Delete S3 bucket (must be empty first)
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3api delete-bucket --bucket $BUCKET_NAME

# Delete security groups
aws ec2 delete-security-group --group-id $RDS_SG
aws ec2 delete-security-group --group-id $APPRUNNER_SG

# Delete subnets
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_1
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_2
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_1
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_2

# Detach and delete Internet Gateway
aws ec2 detach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID

# Delete VPC
aws ec2 delete-vpc --vpc-id $VPC_ID
```

---

**Document Created:** 2025-11-27
**Last Updated:** 2025-11-27
**Next Review:** After Phase 2 completion
