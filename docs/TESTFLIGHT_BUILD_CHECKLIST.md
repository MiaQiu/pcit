# TestFlight Build Checklist

Complete these steps before archiving in Xcode for TestFlight submission.


#######don't know what is this#########
 npm run build:core

 
## 1. Check Native Dependencies

### Verify New Dependencies
Check if any new native modules have been added since last build:
```bash
cd /Users/mia/nora
npm ls expo-notifications expo-document-picker
```

### Run Pod Install
**Always run this before building**, especially if native dependencies were added:
```bash
cd ios
pod install
cd ..
```

## 2. Backend Changes - Docker Rebuild

### When to Rebuild Docker Image
Rebuild if ANY of these backend files changed:
- `prisma/schema.prisma`
- `server/**/*.cjs`
- `packages/nora-core/src/**/*.ts`
- `package.json` (backend dependencies)
- `Dockerfile`
- `.dockerignore`

### Docker Rebuild and Push to ECR
```bash
# Navigate to project root
cd /Users/mia/nora

# Build Docker image
docker build -t nora-backend .

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 059364397483.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag nora-backend:latest 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora:latest

# Push to ECR
docker push 059364397483.dkr.ecr.us-east-1.amazonaws.com/nora:latest
```

### Verify ECR Deployment
```bash
aws ecr describe-images --repository-name nora --region us-east-1 --query 'sort_by(imageDetails,& imagePushedAt)[-1]'
```

## 3. Database Migrations

### Check for Pending Migrations
```bash
npx prisma migrate status
```

### Apply Migrations (if needed)
```bash
# Development
npx prisma db push

# Production (when ready)
npx prisma migrate deploy
```

## 4. Environment Variables

### Mobile App (.env)
Verify all required variables in `nora-mobile/.env`:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_STORAGE_BUCKET_URL`
- Any other `EXPO_PUBLIC_*` variables

### Backend (.env)
Verify backend environment variables are set in AWS:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_EXPIRY` (should be 180d)
- `AWS_*` or `GCP_*` storage credentials

## 5. Version Management

### Update Version Number
Update in `nora-mobile/app.json`:
```json
{
  "expo": {
    "version": "1.0.x",
    "ios": {
      "buildNumber": "x"
    }
  }
}
```

**Important**: Increment `buildNumber` for every TestFlight build.

## 6. Code Quality Checks

### Run TypeScript Check
```bash
cd nora-mobile
npx tsc --noEmit
```

### Test Build Locally (never never run this, unless absolutely necessary)
```bash
npx expo prebuild 
#for ios
npx expo prebuild --clean --platform ios 
```
  - The files are already at /Users/mia/nora/nora-mobile/ios/Nora/AudioSessionManager.swift and AudioSessionManager.m
  Before (Why files kept getting deleted):

  1. You manually added the files directly to the ios/ folder
  2. When you ran npx expo prebuild --clean, it deleted the entire ios folder
  3. Then it rebuilt the ios folder from scratch using only what's in app.json and installed packages
  4. Since Expo didn't know about your custom files, they were gone forever
  5. Repeat cycle 😞

  Now (Why files survive):

  1. Safe storage: Files live permanently in /Users/mia/nora/modules/audio-session-manager/ios/
  2. Config plugin: The plugin at /Users/mia/nora/plugins/withAudioSessionManager.js is registered in your app.json
  3. Auto-restore: During expo prebuild, the plugin automatically copies the files from modules/ → ios/
  4. Even if prebuild --clean wipes the ios folder, the plugin runs and restores them ✅

  So the files in modules/ are the permanent source, and the config plugin is the auto-copier that runs every time you rebuild.

## 7. Xcode Pre-Archive Checks

### Before Opening Xcode
- [ ] All pods installed (`cd ios && pod install`)
- [ ] Docker image rebuilt and pushed (if backend changed)
- [ ] Version and build number updated
- [ ] TypeScript errors resolved
- [ ] Environment variables verified

### In Xcode
- [ ] Select "Any iOS Device (arm64)" as build target
- [ ] Product > Clean Build Folder
- [ ] Product > Archive
- [ ] Verify signing certificate is valid
- [ ] Check for build warnings

## 8. Post-Archive

### Upload to App Store Connect
- Use Xcode Organizer to distribute to App Store Connect
- Select TestFlight distribution
- Wait for processing (usually 5-15 minutes)

### Verify TestFlight Build
- Check App Store Connect for processing status
- Add internal testers if needed
- Monitor for crash reports

## Quick Reference

### Recent Changes Requiring Docker Rebuild
- WACB survey schema changes (removed change fields)
- JWT refresh token extended to 180 days
- Session expiration callback mechanism
- Support request route updates

### Recent Native Dependencies
- `expo-notifications` (for push notifications)
- `expo-document-picker` (for file uploads)

Both are already in Podfile.lock, but always run `pod install` to be safe.
