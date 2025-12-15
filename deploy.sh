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
