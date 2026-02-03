#!/bin/bash
set -e

echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t nora-backend:latest .

echo "Logging in to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 059364397483.dkr.ecr.us-east-1.amazonaws.com

echo "Tagging image..."
docker tag nora-backend:latest 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora:latest

echo "Pushing to ECR..."
docker push 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora:latest

echo "Triggering App Runner deployment..."
aws apprunner start-deployment --service-arn arn:aws:apprunner:us-east-1:059364397483:service/nora-api/0f1877f0a2d8454da6a4ebde1979fec6 --region us-east-1

echo "Verifying ECR image..."
aws ecr describe-images --repository-name nora --region us-east-1 --query 'sort_by(imageDetails,& imagePushedAt)[-1]'

echo "Deployment triggered. Monitor at: https://console.aws.amazon.com/apprunner/home?region=us-east-1#/services"
