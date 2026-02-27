#!/bin/bash
# One-time setup: create dedicated prod audio S3 bucket and wire it to App Runner.
#
# What this does:
#   1. Creates nora-audio-059364397483-prod in ap-southeast-1
#   2. Blocks all public access
#   3. Enables versioning
#   4. Sets AES256 default encryption
#   5. Attaches scoped inline IAM policy to nora-prod-apprunner-role
#   6. Updates AWS_S3_BUCKET env var on the prod App Runner service and redeploys
#
# Safe to run — only creates new resources, does not touch the existing dev bucket.

set -euo pipefail

REGION="ap-southeast-1"
BUCKET="nora-audio-059364397483-prod"
ROLE_NAME="nora-prod-apprunner-role"
POLICY_NAME="NoraProdAudioBucketAccess"
SERVICE_ARN="arn:aws:apprunner:ap-southeast-1:059364397483:service/nora-prod-api/8a4133cde78b478a90b16b7e420ddded"

echo "=== Step 1: Create bucket $BUCKET ==="
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"
echo "Bucket created."

echo ""
echo "=== Step 2: Block all public access ==="
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "Public access blocked."

echo ""
echo "=== Step 3: Enable versioning ==="
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
echo "Versioning enabled."

echo ""
echo "=== Step 4: Set AES256 default encryption ==="
aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'
echo "Default encryption set to AES256."

echo ""
echo "=== Step 5: Attach scoped IAM policy to $ROLE_NAME ==="
POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AudioObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Sid": "AudioBucketList",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::${BUCKET}"
    }
  ]
}
EOF
)

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOCUMENT"
echo "Inline policy '$POLICY_NAME' attached to role '$ROLE_NAME'."

echo ""
echo "=== Step 6: Update prod App Runner env var AWS_S3_BUCKET and redeploy ==="

# Fetch the full ImageRepository config to preserve all required fields
echo "Fetching current App Runner service configuration..."
FULL_IMAGE_REPO=$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$REGION" \
  --query "Service.SourceConfiguration.ImageRepository" \
  --output json)

echo "Current env vars:"
echo "$FULL_IMAGE_REPO" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for k, v in sorted(d.get('ImageConfiguration', {}).get('RuntimeEnvironmentVariables', {}).items()):
    print(f'  {k}={v}')
"

# Merge: replace AWS_S3_BUCKET, keep all other fields (ImageIdentifier, ImageRepositoryType, etc.)
UPDATED_IMAGE_REPO=$(echo "$FULL_IMAGE_REPO" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d.setdefault('ImageConfiguration', {}).setdefault('RuntimeEnvironmentVariables', {})
d['ImageConfiguration']['RuntimeEnvironmentVariables']['AWS_S3_BUCKET'] = '${BUCKET}'
print(json.dumps(d))
")

echo ""
echo "Updating App Runner service with AWS_S3_BUCKET=$BUCKET ..."
aws apprunner update-service \
  --service-arn "$SERVICE_ARN" \
  --region "$REGION" \
  --source-configuration "{\"ImageRepository\": $UPDATED_IMAGE_REPO}"

echo ""
echo "=== Done ==="
echo ""
echo "App Runner update triggered. The service will redeploy automatically."
echo ""
echo "Verification commands:"
echo "  # 1. Confirm bucket exists"
echo "  aws s3 ls s3://$BUCKET --region $REGION"
echo ""
echo "  # 2. Wait for redeployment, then check logs"
echo "  aws logs tail /aws/apprunner/nora-prod-api/8a4133cde78b478a90b16b7e420ddded/application \\"
echo "    --region $REGION --follow"
echo "  # Should see: \"S3 initialized: $BUCKET\""
echo ""
echo "  # 3. Health check"
echo "  curl https://wpwpawhz29.ap-southeast-1.awsapprunner.com/api/health"
echo ""
echo "  # 4. Confirm dev is untouched"
echo "  aws s3 ls s3://nora-audio-059364397483-sg --region $REGION"
echo ""
echo "Note: Historical prod audio in nora-audio-059364397483-sg is NOT migrated."
echo "If needed, run: aws s3 sync s3://nora-audio-059364397483-sg s3://$BUCKET --region $REGION"
