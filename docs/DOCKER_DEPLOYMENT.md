# Docker Build and Push to ECR

This guide covers how to rebuild the Docker image and push it to AWS Elastic Container Registry (ECR).

## Prerequisites

- Docker installed and running
- AWS CLI configured with appropriate credentials
- Access to AWS account: `059364397483`
- Region: `us-east-1`

## Step 1: Rebuild Docker Image

Navigate to the project root and build the Docker image:

```bash
cd /Users/mia/nora
docker build -t nora-backend:latest .
```

This will:
- Use the multi-stage Dockerfile
- Install all dependencies from package.json
- Build the backend application
- Create an optimized production image

## Step 2: Authenticate with ECR

Log in to AWS ECR using the AWS CLI:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 059364397483.dkr.ecr.us-east-1.amazonaws.com
```

You should see: `Login Succeeded`

## Step 3: Tag the Image

Tag your local image with the ECR repository URI:

```bash
docker tag nora-backend:latest 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest
```

## Step 4: Push to ECR

Push the tagged image to ECR:

```bash
docker push 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest
```

This will upload all layers to ECR. The push may take several minutes depending on your internet speed.

## Verification

After pushing, you can verify the image in ECR:

```bash
aws ecr describe-images --repository-name nora-backend --region us-east-1
```

Or view it in the AWS Console:
- Navigate to: https://console.aws.amazon.com/ecr/repositories
- Select region: `us-east-1`
- Find repository: `nora-backend`

## Current Image Details

- **Repository**: nora-backend
- **Registry**: 059364397483.dkr.ecr.us-east-1.amazonaws.com
- **Image URI**: 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest
- **Latest Digest**: sha256:f80e0b0edc0678a5d6e2c54c2c6de1ab79a09691adad7185727c65869cee838f

## Deployment to Production

After pushing to ECR, update your AWS App Runner or ECS service to use the new image:

### For App Runner:

```bash
# Update the service to use the new image
aws apprunner update-service \
  --service-arn <your-service-arn> \
  --source-configuration ImageRepository={ImageIdentifier=059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest,ImageRepositoryType=ECR}
```

### Environment Variables Required:

Ensure these environment variables are set in your production environment:

```
AWS_REGION=us-east-1
AWS_S3_BUCKET=nora-audio-059364397483
AWS_S3_SUPPORT_BUCKET=nora-support
AWS_S3_SUPPORT_REGION=ap-southeast-1
DATABASE_URL=<your-production-database-url>
JWT_ACCESS_SECRET=<your-jwt-access-secret>
JWT_REFRESH_SECRET=<your-jwt-refresh-secret>
ENCRYPTION_KEY=<your-encryption-key>
```

## Troubleshooting

### Docker build fails
- Check that all dependencies are in package.json
- Ensure Dockerfile syntax is correct
- Clear Docker cache: `docker builder prune`

### ECR authentication fails
- Verify AWS CLI is configured: `aws sts get-caller-identity`
- Check IAM permissions for ECR access
- Ensure region is correct (us-east-1)

### Push is very slow
- Large images take time to upload
- Consider optimizing Dockerfile to reduce image size
- Check your internet connection

## Quick Reference

```bash
# Full rebuild and push sequence
cd /Users/mia/nora
docker build -t nora-backend:latest .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 059364397483.dkr.ecr.us-east-1.amazonaws.com
docker tag nora-backend:latest 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest
docker push 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora-backend:latest
```
