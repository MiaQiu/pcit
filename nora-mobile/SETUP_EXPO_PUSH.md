# Setting Up Expo Push Notifications

## Step 1: Create/Link Expo Project

### If you DON'T have an Expo account:
```bash
cd /Users/mia/nora/nora-mobile

# Create Expo account and login
npx expo login

# Create a new Expo project (this will generate a project ID)
npx eas init
```

### If you ALREADY have an Expo account:
```bash
cd /Users/mia/nora/nora-mobile

# Login to your account
npx expo login

# Link this project to your account
npx eas init
```

This will:
- Create an Expo project in your account
- Generate a unique project ID
- Update your app.json with the project ID
- Configure EAS (Expo Application Services)

## Step 2: Verify Project ID

After running `eas init`, check your app.json:

```bash
cat app.json | grep projectId
```

You should see something like:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "abc123def-4567-890a-bcde-f1234567890"
      }
    }
  }
}
```

## Step 3: Update the Code

The project ID is automatically read by Expo, but if you want to use it explicitly in environment variables:

1. Copy the project ID from app.json
2. Create/update `/Users/mia/nora/nora-mobile/.env`:
   ```
   EXPO_PUBLIC_PROJECT_ID=your-project-id-here
   ```

## Step 4: Test Push Notifications

### Development Build Test:
```bash
# Start the development server
npm start

# Run on iOS simulator
npx expo run:ios

# Or run on Android
npx expo run:android
```

### Production Build Test:
```bash
# Build for iOS
npx eas build --platform ios --profile development

# Build for Android
npx eas build --platform android --profile development
```

## Alternative: Local Development Without Expo Account

If you just want to test locally without push notifications, you can use a dummy project ID:

1. Edit `/Users/mia/nora/nora-mobile/app.json`:
   ```json
   {
     "expo": {
       "extra": {
         "eas": {
           "projectId": "00000000-0000-0000-0000-000000000000"
         }
       }
     }
   }
   ```

2. The app will run, but push notifications won't work (you'll get token errors)

## Troubleshooting

### "Unable to get push token"
- Make sure you ran `npx eas init` and have a valid project ID
- Check that you're logged in: `npx expo whoami`
- Verify project ID exists in app.json

### "Invalid credentials"
- Run `npx expo login` again
- Check your Expo account at https://expo.dev

### Push notifications not arriving
- Verify project ID is correct
- Check backend logs for push notification errors
- Ensure device has notification permissions
- Test with Expo's push notification tool: https://expo.dev/notifications

## Quick Start Commands

```bash
# Navigate to mobile app directory
cd /Users/mia/nora/nora-mobile

# Login to Expo
npx expo login

# Initialize EAS and get project ID
npx eas init

# Verify project ID was added
cat app.json | grep projectId

# Start development server
npm start
```
