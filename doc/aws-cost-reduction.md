# AWS Cost Reduction Plan

**Date:** 2026-04-09  
**Current monthly cost:** ~$213 (March 2026)  
**Target:** ~$100-120/month

---

## Cost Breakdown (March 2026)

| Service | Cost | Root Cause |
|---------|------|-----------|
| EC2 - Other | $78.80 | NAT Gateway hourly charges (2 gateways) |
| RDS | $55.13 | Two db.t3.micro instances running 24/7 (dev + prod) |
| App Runner | $21.04 | Compute charges |
| EC2 Instances | $17.56 | Two bastion EC2 t3.micro running 24/7 (dev + prod) |
| VPC | $15.00 | NAT Gateway data processing charges |
| Secrets Manager | $7.61 | 18 secrets × $0.40/month |
| Tax | $17.61 | — |

**EC2-Other + VPC = ~$94/month** — both are NAT Gateway costs.

---

## Root Cause: Wrong VPC Connector on Prod App Runner

The prod App Runner service (`nora-prod-api`) is using **`nora-prod-vpc-connector-v2`** which attaches to **private subnets**. All outbound traffic from App Runner (calls to Anthropic API, ElevenLabs, SMTP) routes through the NAT Gateway.

There is already a `nora-prod-vpc-connector` (v1) on **public subnets** in the same VPC — switching to it eliminates the need for the NAT Gateway entirely.

### VPC Connector Details

| Connector | Subnets | Type | Route |
|-----------|---------|------|-------|
| `nora-prod-vpc-connector` (v1) | `subnet-0305dd34da54e7a4c`, `subnet-0a36e3f4fba17c82c` | **Public** | → Internet Gateway (free) |
| `nora-prod-vpc-connector-v2` (current) | `subnet-08cb5e252c89060d6`, `subnet-0bc1e7361229d6dfc` | **Private** | → NAT Gateway ($$$) |

### Route Tables

- `rtb-0e5cf1bb2779afdc4` — public subnets, routes to Internet Gateway
- `rtb-0af8d09296b558c34` — main (default) route table, routes `0.0.0.0/0` → `nat-0463c92ca969052bd`

---

## Action Plan

### Action 1: Switch Prod App Runner to Public Subnet Connector (Saves ~$32-47/month)

**Security impact:** Safe. RDS access is unchanged (same VPC). Inbound App Runner traffic is unchanged. The only difference is outbound IP is no longer a fixed NAT EIP — but Anthropic, ElevenLabs, and SMTP all use API key auth, not IP allowlisting.

```bash
aws apprunner update-service \
  --service-arn "arn:aws:apprunner:ap-southeast-1:059364397483:service/nora-prod-api/8a4133cde78b478a90b16b7e420ddded" \
  --region ap-southeast-1 \
  --network-configuration '{
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "arn:aws:apprunner:ap-southeast-1:059364397483:vpcconnector/nora-prod-vpc-connector/1/9d140956cc844f018bf043ae49feeffb"
    }
  }'
```

After confirming App Runner is healthy, delete the prod NAT Gateway:

```bash
aws ec2 delete-nat-gateway --nat-gateway-id nat-0463c92ca969052bd --region ap-southeast-1
```

Also release the associated Elastic IP to stop further charges:

```bash
# Find and release the EIP associated with the NAT gateway
aws ec2 describe-nat-gateways --nat-gateway-ids nat-0463c92ca969052bd --region ap-southeast-1 \
  --query 'NatGateways[0].NatGatewayAddresses[0].AllocationId'
# Then: aws ec2 release-address --allocation-id <id> --region ap-southeast-1
```

---

### Action 2: Delete Dev NAT Gateway (Saves ~$32/month)

Dev environment (`us-east-1`) has a NAT Gateway with near-zero traffic:
- NAT Gateway ID: `nat-070c10c224d025dcb`
- Subnet: `subnet-0efbc747bd1d3ba95`

```bash
aws ec2 delete-nat-gateway --nat-gateway-id nat-070c10c224d025dcb --region us-east-1
# Release associated EIP after deletion
```

**Note:** If dev App Runner is on private subnets, it will lose internet access. Either switch it to public subnets too, or accept that dev deployments won't call external APIs. Dev is rarely used in production scenarios.

---

### Action 3: Stop Dev RDS When Not Developing (Saves ~$20/month)

```bash
aws rds stop-db-instance --db-instance-identifier nora-db-dev --region us-east-1
```

AWS auto-restarts stopped RDS after 7 days. To keep it stopped, re-run the command weekly or set up a scheduled Lambda/EventBridge rule.

---

### Action 4: Stop Dev Bastion When Not in Use (Saves ~$8/month)

```bash
# Stop
aws ec2 stop-instances --instance-ids i-0816636c6667be898 --region us-east-1

# Start before tunneling to dev DB
aws ec2 start-instances --instance-ids i-0816636c6667be898 --region us-east-1
```

---

### Action 5: Migrate Secrets Manager → SSM Parameter Store (Saves ~$7/month)

18 secrets × $0.40/month = $7.20/month. SSM Parameter Store standard parameters are free.

Requires updating `server/utils/secrets.cjs` to use `@aws-sdk/client-ssm` instead of `@aws-sdk/client-secrets-manager`. The 5-minute caching pattern can remain the same.

---

### Action 6: ECR Lifecycle Policy (Minor savings)

Prevent old Docker images from accumulating:

```bash
aws ecr put-lifecycle-policy --repository-name nora --region ap-southeast-1 \
  --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 5 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}'

aws ecr put-lifecycle-policy --repository-name nora --region us-east-1 \
  --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Keep last 5 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}'
```

---

## Summary

| Action | Est. Monthly Savings | Risk | Status |
|--------|---------------------|------|--------|
| Switch prod App Runner to public subnet connector | ~$32-47 | Low | Pending |
| Delete prod NAT Gateway | included above | Low | Pending (after Action 1) |
| Delete dev NAT Gateway | ~$32 | Low | Pending |
| Stop dev RDS | ~$20 | None | Pending |
| Stop dev bastion | ~$8 | None | Pending |
| Migrate to SSM Parameter Store | ~$7 | Low | Pending |
| ECR lifecycle policies | ~$1-5 | None | Pending |
| **Total** | **~$100-119/month** | | |

**Forecasted monthly cost after all actions: ~$90-115/month** (down from $213)
