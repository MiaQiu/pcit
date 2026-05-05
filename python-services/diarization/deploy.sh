#!/bin/bash
# Deploy the diarization Lambda to the same ECR account as App Runner.
# First run: set LAMBDA_ROLE_ARN to an IAM role with AmazonS3ReadOnlyAccess.
# e.g. LAMBDA_ROLE_ARN=arn:aws:iam::059364397483:role/nora-diarization-role ./deploy.sh
set -e

ACCOUNT_ID=059364397483
REGION=ap-southeast-1
ECR_REPO=nora-diarization
FUNCTION_NAME=nora-diarization
IMAGE_URI=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest

echo "▶  Building image (linux/amd64)..."
docker build --platform linux/amd64 --provenance=false -t ${ECR_REPO}:latest .

echo "▶  Logging in to ECR..."
aws ecr get-login-password --region ${REGION} \
    | docker login --username AWS --password-stdin \
      ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

echo "▶  Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${REGION} \
    > /dev/null 2>&1 \
    || aws ecr create-repository --repository-name ${ECR_REPO} --region ${REGION} \
       > /dev/null

echo "▶  Pushing image..."
docker tag ${ECR_REPO}:latest ${IMAGE_URI}
docker push ${IMAGE_URI}

# Create or update the Lambda function
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} > /dev/null 2>&1; then
    echo "▶  Updating Lambda function code..."
    aws lambda update-function-code \
        --function-name ${FUNCTION_NAME} \
        --image-uri ${IMAGE_URI} \
        --region ${REGION} > /dev/null
    aws lambda wait function-updated \
        --function-name ${FUNCTION_NAME} \
        --region ${REGION}
    echo "✅  Lambda updated: ${FUNCTION_NAME}"
else
    if [ -z "${LAMBDA_ROLE_ARN}" ]; then
        echo "❌  LAMBDA_ROLE_ARN is not set."
        echo "    Create an IAM role with AmazonS3ReadOnlyAccess and pass its ARN:"
        echo "    LAMBDA_ROLE_ARN=arn:aws:iam::${ACCOUNT_ID}:role/nora-diarization-role ./deploy.sh"
        exit 1
    fi
    echo "▶  Creating Lambda function..."
    aws lambda create-function \
        --function-name ${FUNCTION_NAME} \
        --package-type Image \
        --code ImageUri=${IMAGE_URI} \
        --role ${LAMBDA_ROLE_ARN} \
        --memory-size 4096 \
        --timeout 120 \
        --region ${REGION} > /dev/null
    aws lambda wait function-active \
        --function-name ${FUNCTION_NAME} \
        --region ${REGION}
    echo "✅  Lambda created: ${FUNCTION_NAME}"
    echo ""
    echo "⚠️  Grant App Runner permission to invoke it:"
    echo "    aws lambda add-permission \\"
    echo "      --function-name ${FUNCTION_NAME} \\"
    echo "      --statement-id AllowAppRunner \\"
    echo "      --action lambda:InvokeFunction \\"
    echo "      --principal tasks.apprunner.amazonaws.com \\"
    echo "      --region ${REGION}"
fi

echo ""
echo "Add to App Runner env vars:"
echo "  DIARIZATION_LAMBDA_NAME=${FUNCTION_NAME}"
