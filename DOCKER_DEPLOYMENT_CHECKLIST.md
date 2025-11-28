# Docker Deployment Checklist

**Last Updated:** 2025-11-28
**Project:** Nora (PCIT Coaching App)
**Container Registry:** AWS ECR

---

## Pre-Build Validation

### 1. Dependency Check ✅
- [ ] Run `npm install` to ensure package-lock.json is current
- [ ] Verify all `require()` statements have corresponding dependencies:
  ```bash
  # Check for any missing dependencies
  node -e "require('./server.cjs')" && echo "✅ All dependencies OK"
  ```
- [ ] Test with production dependencies only:
  ```bash
  rm -rf node_modules
  npm ci --only=production
  node server.cjs  # Should not crash
  npm install  # Restore dev dependencies
  ```

### 2. Code Validation ✅
- [ ] All syntax errors fixed
- [ ] No function name conflicts (check imports vs declarations)
- [ ] Environment variables documented in `.env.example`
- [ ] Secrets not hardcoded in code

### 3. Local Testing ✅
- [ ] Application runs locally: `node server.cjs`
- [ ] Health endpoint responds: `curl http://localhost:3001/api/health`
- [ ] Database connection works (if applicable)
- [ ] All API routes respond correctly

---

## Docker Build Process

### 4. Pre-Build Steps ✅
- [ ] Review `.dockerignore` - ensure sensitive files excluded:
  ```
  ✅ node_modules
  ✅ .env
  ✅ .env.*
  ✅ *.log
  ✅ .git
  ✅ aws-resources.txt
  ✅ database-backup-*.json
  ```

- [ ] Verify `Dockerfile` is up to date:
  - [ ] Correct Node.js version
  - [ ] All COPY commands include necessary files
  - [ ] Port matches application (3001)
  - [ ] Health check configured

### 5. Version Management ✅
- [ ] Determine version number:
  ```bash
  # Get latest version
  git tag --list 'v*' --sort=-v:refname | head -1

  # Or check package.json
  VERSION=$(node -e "console.log(require('./package.json').version)")
  echo "Building version: v${VERSION}"
  ```

- [ ] Create version tag:
  ```bash
  export VERSION="1.0.3"  # Update this!
  echo "v${VERSION}" > .docker-version
  ```

### 6. Build Docker Image ✅
- [ ] Build with version tag:
  ```bash
  docker build -t nora:v${VERSION} -t nora:latest .
  ```

- [ ] Verify build completed successfully:
  ```bash
  docker images nora --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}"
  ```

- [ ] Check image size (should be < 300MB):
  ```bash
  docker images nora:latest --format "{{.Size}}"
  ```

---

## Local Docker Testing

### 7. Test Container Locally ✅
- [ ] Run container with minimal environment:
  ```bash
  docker run --rm -p 3001:3001 \
    -e NODE_ENV=production \
    -e PORT=3001 \
    -e DATABASE_URL="mock://test" \
    nora:latest
  ```

- [ ] Test health endpoint:
  ```bash
  curl http://localhost:3001/api/health
  # Expected: {"status":"ok",...}
  ```

- [ ] Stop test container: `docker stop <container_id>`

### 8. Verify Dependencies in Container ✅
- [ ] Check that all dependencies are installed:
  ```bash
  docker run --rm nora:latest sh -c "ls -la node_modules | grep -E 'node-fetch|form-data|express'"
  ```

- [ ] Verify application starts without errors:
  ```bash
  docker run --rm nora:latest sh -c "node -e \"require('./server.cjs')\""
  ```

---

## Push to ECR

### 9. ECR Login ✅
- [ ] Load AWS credentials:
  ```bash
  source aws-resources.txt
  echo "AWS Account: $AWS_ACCOUNT_ID"
  echo "AWS Region: $AWS_REGION"
  echo "ECR Repo: $ECR_REPO"
  ```

- [ ] Login to ECR:
  ```bash
  aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REPO
  # Expected: "Login Succeeded"
  ```

### 10. Tag for ECR ✅
- [ ] Tag image for ECR:
  ```bash
  docker tag nora:v${VERSION} ${ECR_REPO}:v${VERSION}
  docker tag nora:v${VERSION} ${ECR_REPO}:latest
  ```

- [ ] Verify tags:
  ```bash
  docker images | grep ${ECR_REPO}
  ```

### 11. Push to ECR ✅
- [ ] Push versioned tag:
  ```bash
  docker push ${ECR_REPO}:v${VERSION}
  ```

- [ ] Push latest tag:
  ```bash
  docker push ${ECR_REPO}:latest
  ```

- [ ] Save image digest:
  ```bash
  DIGEST=$(docker inspect ${ECR_REPO}:latest --format='{{index .RepoDigests 0}}')
  echo "Image Digest: $DIGEST"
  echo "v${VERSION}: $DIGEST" >> .docker-digests.log
  ```

### 12. Verify ECR Push ✅
- [ ] Confirm image in ECR:
  ```bash
  aws ecr describe-images \
    --repository-name nora \
    --region $AWS_REGION \
    --query 'imageDetails[*].[imageTags,imagePushedAt,imageSizeInBytes]' \
    --output table
  ```

- [ ] Check that digest is NEW (different from previous):
  ```bash
  tail -5 .docker-digests.log
  ```

---

## Deployment

### 13. Trigger Deployment ✅
**For App Runner (Auto-Deploy Enabled):**
- [ ] Wait 2-3 minutes for auto-deployment to trigger
- [ ] Or manually trigger:
  ```bash
  aws apprunner start-deployment \
    --service-arn $SERVICE_ARN \
    --region $AWS_REGION
  ```

**For Manual Deployment:**
- [ ] Delete old service (if starting fresh):
  ```bash
  aws apprunner delete-service \
    --service-arn $SERVICE_ARN \
    --region $AWS_REGION
  ```

- [ ] Create new service:
  ```bash
  aws apprunner create-service \
    --cli-input-json file://apprunner-service.json \
    --region $AWS_REGION
  ```

### 14. Monitor Deployment ✅
- [ ] Check deployment status:
  ```bash
  for i in {1..20}; do
    STATUS=$(aws apprunner describe-service \
      --service-arn $SERVICE_ARN \
      --region $AWS_REGION \
      --query 'Service.Status' \
      --output text)
    echo "[$i/20] Status: $STATUS"
    [ "$STATUS" = "RUNNING" ] && break
    sleep 20
  done
  ```

- [ ] If failed, check logs:
  ```bash
  # Get service ID from SERVICE_ARN
  SERVICE_ID=$(echo $SERVICE_ARN | rev | cut -d'/' -f1 | rev)

  # Check application logs
  aws logs tail /aws/apprunner/nora-api/${SERVICE_ID}/application \
    --region $AWS_REGION \
    --since 10m \
    --format short
  ```

---

## Post-Deployment Validation

### 15. Health Checks ✅
- [ ] Test health endpoint:
  ```bash
  curl https://${SERVICE_URL}/api/health
  # Expected: {"status":"ok","services":{...}}
  ```

- [ ] Test database connection (via any endpoint that touches DB):
  ```bash
  # This should fail with 401 (auth required) not 500 (DB error)
  curl https://${SERVICE_URL}/api/sessions
  ```

### 16. Functional Testing ✅
- [ ] Test authentication:
  ```bash
  # Signup
  curl -X POST https://${SERVICE_URL}/api/auth/signup \
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

- [ ] Test other critical endpoints:
  - [ ] Login
  - [ ] Session creation
  - [ ] Learning progress

### 17. Monitor for Errors ✅
- [ ] Check CloudWatch metrics (first 5 minutes):
  ```bash
  aws cloudwatch get-metric-statistics \
    --namespace AWS/AppRunner \
    --metric-name 5xxStatusResponses \
    --dimensions Name=ServiceName,Value=nora-api \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region $AWS_REGION
  ```

- [ ] No 5xx errors in first 5 minutes

---

## Documentation

### 18. Update Documentation ✅
- [ ] Update version in `package.json`:
  ```bash
  npm version patch  # or minor/major
  ```

- [ ] Commit and tag:
  ```bash
  git add .
  git commit -m "Deploy v${VERSION} to production"
  git tag -a "v${VERSION}" -m "Production release v${VERSION}"
  git push origin main --tags
  ```

- [ ] Update deployment log:
  ```bash
  echo "$(date): Deployed v${VERSION} to production" >> DEPLOYMENT_LOG.md
  echo "  Service URL: https://${SERVICE_URL}" >> DEPLOYMENT_LOG.md
  echo "  Digest: $DIGEST" >> DEPLOYMENT_LOG.md
  echo "" >> DEPLOYMENT_LOG.md
  ```

---

## Rollback Procedure (If Needed)

### 19. Emergency Rollback ✅
If deployment fails and you need to rollback:

- [ ] List previous image versions:
  ```bash
  aws ecr describe-images \
    --repository-name nora \
    --query 'sort_by(imageDetails,& imagePushedAt)[*].[imageTags[0],imagePushedAt]' \
    --output table
  ```

- [ ] Update service to previous version:
  ```bash
  PREVIOUS_VERSION="1.0.2"  # Update this!

  aws apprunner update-service \
    --service-arn $SERVICE_ARN \
    --source-configuration \
      "ImageRepository={ImageIdentifier=${ECR_REPO}:v${PREVIOUS_VERSION}}" \
    --region $AWS_REGION
  ```

- [ ] Monitor rollback:
  ```bash
  aws apprunner describe-service \
    --service-arn $SERVICE_ARN \
    --query 'Service.Status'
  ```

---

## Common Issues & Solutions

### Issue: "Layer already exists" but app doesn't work
**Solution:**
- Build with `--no-cache`: `docker build --no-cache -t nora:latest .`
- Tag with unique version, not just `latest`

### Issue: Missing dependencies in container
**Solution:**
- Run `npm install --save <package>` locally
- Rebuild Docker image
- Test with `docker run --rm nora:latest sh -c "ls node_modules/<package>"`

### Issue: App Runner deployment fails
**Solution:**
- Check logs: `aws logs tail /aws/apprunner/nora-api/.../application --since 10m`
- Common causes:
  - Port mismatch (should be 3001)
  - Missing environment variables
  - Database connection issues
  - Missing dependencies

### Issue: Same digest after rebuild
**Solution:**
- Ensure `package.json` or `package-lock.json` changed
- Use `--no-cache` flag
- Tag with new version number
- Push with explicit tag: `docker push ${ECR_REPO}:v1.0.4`

---

## Quick Reference Commands

```bash
# Load environment
source aws-resources.txt

# Set version
export VERSION="1.0.4"

# Full deployment pipeline
docker build -t nora:v${VERSION} -t nora:latest . && \
docker tag nora:latest ${ECR_REPO}:latest && \
docker tag nora:latest ${ECR_REPO}:v${VERSION} && \
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO && \
docker push ${ECR_REPO}:v${VERSION} && \
docker push ${ECR_REPO}:latest && \
echo "✅ Deployment complete! Monitor App Runner for auto-deploy."
```

---

## Checklist Summary

**Pre-Build:** 3 steps (Dependencies, Code, Local Testing)
**Build:** 4 steps (Pre-build, Version, Build, Test Container)
**Push:** 4 steps (Login, Tag, Push, Verify)
**Deploy:** 3 steps (Trigger, Monitor, Validate)
**Document:** 2 steps (Update docs, Tag release)

**Total:** ~16 steps | **Time:** ~30-45 minutes for full deployment

---

## Notes

- Always test locally before building Docker image
- Use semantic versioning: MAJOR.MINOR.PATCH
- Keep `.docker-digests.log` to track deployments
- Monitor first 5-10 minutes after deployment
- Document any issues encountered for future reference
