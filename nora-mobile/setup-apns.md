# Upload APNs Credentials to EAS

## You have the APNs key file:
- File: `/Users/mia/Downloads/AuthKey_WSQ56Z7FXD.p8`
- Key ID: `WSQ56Z7FXD`

## Steps to upload:

### 1. Find your Apple Team ID
Go to https://developer.apple.com/account and look for your Team ID in the membership details.

### 2. Run the upload command

```bash
cd /Users/mia/nora/nora-mobile
eas credentials
```

### 3. Follow the interactive prompts:

1. Select platform: **iOS**
2. Select profile: **production** (or development if testing)
3. Select: **Push Notifications: Manage your Apple Push Notification Key**
4. Select: **Add a new Push Key**
5. When prompted:
   - **Apple Push Key ID**: `WSQ56Z7FXD`
   - **Path to P8 file**: `/Users/mia/Downloads/AuthKey_WSQ56Z7FXD.p8`
   - **Apple Team ID**: (enter the Team ID from step 1)

### 4. Verify upload
After uploading, you should see a confirmation that the Push Notification Key was added successfully.

### 5. Test push notifications
After uploading, restart your backend server and test uploading a recording to verify push notifications work.

## Alternative: Quick command if you know your Team ID

If you have your Team ID (e.g., `ABC123DEF4`), you can also use:

```bash
# This will open the interactive credential manager
cd /Users/mia/nora/nora-mobile
eas credentials
```

Then follow the prompts as described above.
