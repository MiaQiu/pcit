# AWS Infrastructure Overview

**Last Updated:** 2025-11-28
**Account:** 059364397483
**Region:** us-east-1 (N. Virginia)
**Status:** ✅ Fully Deployed & Operational

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
| **Production RDS** | db.t3.micro PostgreSQL 15.8 | ~$15.00 | ✅ Running |
| **Development RDS** | db.t3.micro PostgreSQL 15.8 | ~$15.00 | ✅ Running |
| **App Runner** | 1 vCPU, 2GB RAM | ~$25.00 | ✅ Running |
| **S3 Bucket** | Storage + requests | ~$5.00 | ✅ Running |
| **EC2 Bastion** | t3.micro (if running 24/7) | ~$7.50 | ✅ Running |
| **ECR** | Container registry | ~$0.50 | ✅ Running |
| VPC | Networking | FREE | ✅ Running |
| Subnets | Networking | FREE | ✅ Running |
| Internet Gateway | Networking | FREE | ✅ Running |
| Security Groups | Firewall | FREE | ✅ Running |
| Data Transfer | Outbound | ~$0.50 | ✅ Running |
| **Total** | | **~$68.50/mo** | ✅ Operational |

**Cost Optimization Tips:**
- Stop bastion when not in use: Save $7.50/month
- Use RDS reserved instances: Save 40% (~$12/month)
- S3 lifecycle policies: Reduce storage costs
- Monitor CloudWatch metrics: Optimize App Runner instances

---

## 📊 Deployment Status

### ✅ Phase 1: Storage & Networking (COMPLETE)
- ✅ S3 Bucket created and configured
- ✅ VPC with public/private subnets
- ✅ Internet Gateway and routing
- ✅ Security groups configured

### ✅ Phase 2: Database (COMPLETE)
- ✅ Production RDS (nora-db) - PostgreSQL 15.8
- ✅ Development RDS (nora-db-dev) - PostgreSQL 15.8
- ✅ 10 migrations applied to both databases
- ✅ Development database populated with test data (5 users, 33 sessions)
- ✅ Bastion host for database access

### ✅ Phase 3: Secrets Management (COMPLETE)
- ✅ AWS Secrets Manager configured
- ✅ Environment variables in App Runner
- ✅ IAM roles with proper permissions

### ✅ Phase 4: Application Updates (COMPLETE)
- ✅ Code migrated from Google Cloud to AWS
- ✅ S3 storage integration
- ✅ Local development uses AWS infrastructure

### ✅ Phase 5: Container Deployment (COMPLETE)
- ✅ ECR Repository created
- ✅ Docker images built and pushed (v1.0.3)
- ✅ App Runner service deployed
- ✅ VPC Connector configured
- ✅ Auto-deploy enabled
- ✅ Production URL: https://p2tgddmyxt.us-east-1.awsapprunner.com

### 📈 Next Steps (Optional Enhancements)
1. Set up CloudWatch dashboards for monitoring
2. Configure AWS WAF for additional security
3. Implement automated backups with snapshots
4. Set up staging environment
5. Configure custom domain name
6. Enable CloudFront CDN for static assets

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

### ✅ All Resources Created
- ✅ RDS PostgreSQL databases (production + development)
- ✅ Secrets Manager configured
- ✅ App Runner service deployed
- ✅ ECR repository with Docker images
- ✅ IAM roles for all services
- ✅ Bastion host for database access

### Cost Monitoring
- Set up billing alert: $100/month threshold recommended
- Current spend: ~$68.50/month
- Can be reduced to ~$61/month by stopping bastion when not in use

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
**Last Updated:** 2025-11-28
**Status:** All phases complete - production ready
**Next Review:** Monthly or before major changes

---

## 📚 Related Documentation

- **AWS_RESOURCES_SUMMARY.md** - Complete resource inventory and costs
- **DATABASE_ACCESS_GUIDE.md** - How to access databases via bastion
- **DOCKER_DEPLOYMENT_CHECKLIST.md** - Deployment procedures
- **aws-resources.txt** - All resource IDs and credentials (DO NOT COMMIT)
