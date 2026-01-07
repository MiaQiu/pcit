# Subscription Implementation Plan - Nora App

**Date:** January 7, 2026
**Approach:** Custom implementation using react-native-iap
**Product:** $99.98/3-month subscription with 7-day free trial
**Estimated Cost Savings:** $4,000 - $31,000/year vs RevenueCat

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Cost Analysis](#cost-analysis)
3. [Phase 1: App Store Connect Setup](#phase-1-app-store-connect-setup)
4. [Phase 2: Installation & Dependencies](#phase-2-installation--dependencies)
5. [Phase 3: Backend Implementation](#phase-3-backend-implementation)
6. [Phase 4: Mobile App Implementation](#phase-4-mobile-app-implementation)
7. [Phase 5: Testing Strategy](#phase-5-testing-strategy)
8. [Phase 6: Configuration & Environment](#phase-6-configuration--environment)
9. [Phase 7: Production Checklist](#phase-7-production-checklist)
10. [Implementation Timeline](#implementation-timeline)
11. [Files Summary](#files-summary)

---

## Project Overview

### Goal
Implement $99.98/3-month subscription with 7-day free trial using react-native-iap

### Product Details
- **Product ID:** `com.nora.premium.3month` (must match App Store Connect)
- **Price:** $99.98 per 3 months
- **Trial:** 7 days free
- **Type:** Auto-renewable subscription

### Target Scale
- **Users:** 50,000 in 2 years
- **Pricing:** $30/month effective rate
- **Expected Conversions:** 5-20%

---

## Cost Analysis

### RevenueCat Cost (Year 1)

| Conversion Rate | Paying Users | Monthly Revenue | RevenueCat Cost/Year |
|----------------|--------------|-----------------|---------------------|
| 5% (Conservative) | 2,500 | $75,000 | **$9,000** |
| 10% (Moderate) | 5,000 | $150,000 | **$18,000** |
| 20% (Optimistic) | 10,000 | $300,000 | **$36,000** |

### Self-Build with Claude Code (Year 1)
- Initial Development: $0-450 (2-3 hours your time)
- Monthly Maintenance: $0-300/month (2 hours/month your time)
- Infrastructure: $50-100/month (receipt validation)
- **Total Year 1 Cost: $600 - $5,250**

### Savings
- **At 5% conversion:** Save $3,750 - $8,400/year
- **At 10% conversion:** Save $12,750 - $17,400/year
- **At 20% conversion:** Save $30,750 - $35,400/year

### ROI: 150% - 670%

---

## Phase 1: App Store Connect Setup

### Status: ✅ Verify Before Coding

#### Checklist:
- [ ] Subscription created in App Store Connect
- [ ] Product ID documented (exact string needed)
- [ ] Free trial configured (7 days)
- [ ] Price set ($99.98/3 months)
- [ ] Subscription submitted for review with app
- [ ] Apple Shared Secret obtained

#### Where to Find:
- **Product ID:** App Store Connect → My Apps → Nora → In-App Purchases
- **Shared Secret:** App Store Connect → My Apps → In-App Purchases → App-Specific Shared Secret

---

## Phase 2: Installation & Dependencies

### Step 1: Install react-native-iap
**Time: 10 minutes**

```bash
# Install the library
npm install react-native-iap

# Install iOS dependencies
cd ios && pod install && cd ..
```

#### Files Modified:
- `package.json`
- `ios/Podfile.lock`

---

## Phase 3: Backend Implementation

### Step 2: Database Schema Updates
**Time: 15 minutes**

#### File: `packages/core/prisma/schema.prisma`

Add to User model:
```prisma
model User {
  // ... existing fields ...

  // Subscription fields
  subscriptionStatus    SubscriptionStatus @default(NONE)
  subscriptionStartDate DateTime?
  subscriptionEndDate   DateTime?
  subscriptionProductId String?
  appleCustomerId       String?           @unique
  lastReceiptData       String?           @db.Text

  // Transaction history
  transactions          Transaction[]
}

enum SubscriptionStatus {
  NONE
  TRIAL
  ACTIVE
  EXPIRED
  CANCELLED
  BILLING_ISSUE
}

model Transaction {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  transactionId         String   @unique
  originalTransactionId String
  productId             String
  purchaseDate          DateTime
  expiresDate           DateTime?

  receiptData           String   @db.Text
  environment           String   // sandbox or production

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userId])
  @@index([transactionId])
}
```

#### Run Migration:
```bash
cd packages/core
npx prisma migrate dev --name add_subscription_fields
npx prisma generate
cd ../..
```

---

### Step 3: Create Apple Receipt Validation Service
**Time: 30 minutes**

#### File: `backend/src/services/appleReceiptService.ts` (NEW)

#### Purpose:
Validate receipts with Apple's servers to verify purchases

#### Functions:
1. `validateReceipt(receiptData: string, isProduction: boolean)` - Validate with Apple
2. `parseReceiptResponse(response)` - Extract subscription info
3. `verifySubscriptionStatus(receipt)` - Check if subscription is active

#### Dependencies:
```bash
npm install axios
```

#### Apple API Endpoints:
- **Production:** `https://buy.itunes.apple.com/verifyReceipt`
- **Sandbox:** `https://sandbox.itunes.apple.com/verifyReceipt`

#### What it does:
- Sends receipt to Apple for validation
- Receives transaction details
- Extracts:
  - Product ID
  - Purchase date
  - Expiration date
  - Trial period info
  - Subscription status

---

### Step 4: Create Subscription Service
**Time: 45 minutes**

#### File: `backend/src/services/subscriptionService.ts` (NEW)

#### Functions:

##### `validateAndSaveReceipt(userId: string, receiptData: string)`
- Validate receipt with Apple
- Save transaction to database
- Update user subscription status
- Return subscription info

##### `updateUserSubscription(userId: string, transactionInfo)`
- Update user's subscription status
- Set start/end dates
- Save customer ID

##### `checkSubscriptionStatus(userId: string)`
- Check if user has active subscription
- Return current status and expiry

##### `handleSubscriptionExpired(userId: string)`
- Mark subscription as expired
- Send notification (optional)

##### `restoreSubscription(userId: string, receiptData: string)`
- Validate receipt
- Restore subscription if valid
- Update database

---

### Step 5: Create API Endpoints
**Time: 30 minutes**

#### File: `backend/src/controllers/subscriptionController.ts` (NEW)

#### Endpoints:

##### `POST /api/subscriptions/validate`
**Request:**
```json
{
  "receiptData": "base64_encoded_receipt",
  "productId": "com.nora.premium.3month"
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "ACTIVE",
    "startDate": "2026-01-07T...",
    "endDate": "2026-04-07T...",
    "productId": "com.nora.premium.3month"
  }
}
```

##### `POST /api/subscriptions/restore`
**Request:**
```json
{
  "receiptData": "base64_encoded_receipt"
}
```

**Response:**
```json
{
  "success": true,
  "restored": true,
  "subscription": { ... }
}
```

##### `GET /api/subscriptions/status`
**Response:**
```json
{
  "status": "ACTIVE",
  "expiresAt": "2026-04-07T...",
  "isTrialPeriod": false
}
```

---

### Step 6: Add Routes
**Time: 10 minutes**

#### File: `backend/src/routes/subscriptions.ts` (NEW)

```typescript
router.post('/validate', authenticateToken, validateReceipt);
router.post('/restore', authenticateToken, restoreReceipt);
router.get('/status', authenticateToken, getSubscriptionStatus);
```

#### File: `backend/src/index.ts` (MODIFY)
```typescript
import subscriptionRoutes from './routes/subscriptions';
app.use('/api/subscriptions', subscriptionRoutes);
```

---

### Step 7: Create Webhook Handler (Future/Optional)
**Time: 20 minutes**

#### File: `backend/src/controllers/webhooks/appleWebhook.ts` (NEW)

#### Purpose:
Handle Apple Server-to-Server notifications for:
- Subscription renewals
- Cancellations
- Billing issues
- Refunds

#### Endpoint:
`POST /api/webhooks/apple`

**Note:** This can be implemented later. For MVP, polling with receipt validation is sufficient.

---

## Phase 4: Mobile App Implementation

### Step 8: Create IAP Service
**Time: 60 minutes**

#### File: `nora-mobile/src/services/iapService.ts` (NEW)

#### Functions:

##### `initConnection(): Promise<void>`
- Initialize IAP connection
- Must be called on app start
- Handle errors

##### `getProducts(productIds: string[]): Promise<Product[]>`
- Fetch product details from App Store
- Returns: price, currency, description
- Cache results

##### `requestSubscription(productId: string): Promise<PurchaseResult>`
- Start purchase flow
- Handle user interaction
- Return receipt data
- Handle errors (user cancelled, payment failed, etc.)

##### `getAvailablePurchases(): Promise<Purchase[]>`
- Get list of user's purchases
- Used for restore functionality

##### `finishTransaction(purchase: Purchase): Promise<void>`
- Mark transaction as complete
- Must be called after validation

##### `endConnection(): Promise<void>`
- Cleanup on app close

#### Error Handling:
- User cancelled
- Payment invalid
- Network error
- Product not found
- Receipt validation failed

---

### Step 9: Create Subscription Context
**Time: 45 minutes**

#### File: `nora-mobile/src/contexts/SubscriptionContext.tsx` (NEW)

#### State:
```typescript
{
  isSubscribed: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndDate: Date | null;
  product: Product | null;
  isLoading: boolean;
  error: string | null;
}
```

#### Methods:

##### `loadProduct()`
- Fetch product from App Store
- Update product state
- Handle errors

##### `purchaseSubscription()`
- Call iapService.requestSubscription()
- Get receipt data
- Send to backend for validation
- Update subscription status
- Handle success/error

##### `restorePurchases()`
- Call iapService.getAvailablePurchases()
- Send receipts to backend
- Update subscription status
- Return success/failure

##### `checkSubscriptionStatus()`
- Call backend API
- Update local state
- Return current status

##### `refreshSubscriptionStatus()`
- Re-validate with backend
- Update state

#### Provider:
```typescript
<SubscriptionProvider>
  {children}
</SubscriptionProvider>
```

---

### Step 10: Update App Context
**Time: 15 minutes**

#### File: `nora-mobile/src/contexts/AppContext.tsx` (MODIFY)

#### Add:
- Initialize IAP on app start
- Wrap app with SubscriptionProvider
- Handle IAP cleanup on app close

#### Update App.tsx:
```typescript
<AppProvider>
  <SubscriptionProvider>
    <NavigationContainer>
      {/* ... */}
    </NavigationContainer>
  </SubscriptionProvider>
</AppProvider>
```

---

### Step 11: Create Subscription Hook
**Time: 15 minutes**

#### File: `nora-mobile/src/hooks/useSubscription.ts` (NEW)

#### Purpose:
Easy access to subscription context

#### Usage:
```typescript
const {
  isSubscribed,
  purchaseSubscription,
  restorePurchases
} = useSubscription();
```

---

### Step 12: Update Subscription Screen
**Time: 60 minutes**

#### File: `nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx` (MODIFY)

#### Changes:

##### 1. Import useSubscription hook
```typescript
const {
  product,
  isLoading,
  purchaseSubscription,
  restorePurchases,
  error
} = useSubscription();
```

##### 2. Load product on mount
```typescript
useEffect(() => {
  loadProduct();
}, []);
```

##### 3. Display actual price from App Store
```typescript
// Replace hardcoded $99.98 with:
{product?.localizedPrice || '$99.98'}
```

##### 4. Implement handleStartTrial()
```typescript
const handleStartTrial = async () => {
  setIsLoading(true);
  try {
    const result = await purchaseSubscription();

    if (result.success) {
      // Complete onboarding
      await authService.completeOnboarding({...});

      // Navigate to next screen
      navigation.navigate('NotificationPermission');
    }
  } catch (error) {
    if (error.code === 'E_USER_CANCELLED') {
      // User cancelled, do nothing
      return;
    }

    Alert.alert(
      'Purchase Failed',
      error.message || 'Unable to start trial. Please try again.',
      [{ text: 'OK' }]
    );
  } finally {
    setIsLoading(false);
  }
};
```

##### 5. Implement handleRestore()
```typescript
const handleRestore = async () => {
  setIsLoading(true);
  try {
    const result = await restorePurchases();

    if (result.restored) {
      Alert.alert(
        'Success',
        'Your subscription has been restored!',
        [{
          text: 'OK',
          onPress: () => navigation.navigate('NotificationPermission')
        }]
      );
    } else {
      Alert.alert(
        'No Purchases Found',
        'We couldn\'t find any previous purchases to restore.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    Alert.alert(
      'Restore Failed',
      'Unable to restore purchases. Please try again.',
      [{ text: 'OK' }]
    );
  } finally {
    setIsLoading(false);
  }
};
```

##### 6. Show loading states
```typescript
{isLoading && <ActivityIndicator />}
{error && <Text style={styles.error}>{error}</Text>}
```

---

### Step 13: Create Subscription Gate Component
**Time: 30 minutes**

#### File: `nora-mobile/src/components/SubscriptionGate.tsx` (NEW)

#### Purpose:
Wrap premium features to require subscription

#### Usage:
```typescript
<SubscriptionGate
  fallback={<PaywallScreen />}
>
  <PremiumFeature />
</SubscriptionGate>
```

#### Logic:
```typescript
const { isSubscribed, isLoading } = useSubscription();

if (isLoading) return <LoadingScreen />;
if (!isSubscribed) return fallback;
return children;
```

---

### Step 14: Add Subscription Check to Features
**Time: 30 minutes**

#### Files to Modify:
Identify which features require subscription

**Example:** Lessons, Premium Content

#### File: `nora-mobile/src/screens/LessonViewerScreen.tsx` (MODIFY)

```typescript
const { isSubscribed } = useSubscription();

// Show paywall if not subscribed
if (!isSubscribed) {
  return <PaywallScreen />;
}

// Show content
return <LessonContent />;
```

---

## Phase 5: Testing Strategy

### Step 15: Sandbox Testing Setup
**Time: 20 minutes**

#### Create Sandbox Testers:
1. App Store Connect → Users and Access → Sandbox Testers
2. Create 2-3 test accounts
3. Document credentials

#### Test Devices:
- Physical iPhone (required for purchase testing)
- Sign out of App Store
- Do NOT sign into sandbox account until testing

---

### Step 16: Test Scenarios
**Time: 2-3 hours**

#### Test Cases:

##### 1. New Purchase Flow
- [ ] Tap "Start free trial"
- [ ] Apple payment sheet appears
- [ ] Product shows correct price ($99.98)
- [ ] Complete purchase with sandbox account
- [ ] Receipt validated successfully
- [ ] User subscription status updated to TRIAL
- [ ] Navigate to next screen
- [ ] Premium features unlocked

##### 2. Restore Purchases
- [ ] Uninstall app
- [ ] Reinstall app
- [ ] Login with same account
- [ ] Tap "Restore Purchases"
- [ ] Subscription restored successfully
- [ ] Premium features unlocked

##### 3. User Cancellation
- [ ] Start purchase flow
- [ ] Tap "Cancel" on payment sheet
- [ ] No error shown
- [ ] User stays on subscription screen
- [ ] Can try again

##### 4. Payment Failed
- [ ] Use sandbox tester with "declined payment"
- [ ] Error message shown
- [ ] User can retry

##### 5. Trial Expiration (Sandbox accelerated time)
- [ ] Purchase subscription
- [ ] Wait for trial to expire (sandbox: ~5 minutes)
- [ ] Subscription status updates to ACTIVE
- [ ] Billing occurs

##### 6. Subscription Expiration
- [ ] Cancel subscription in Settings
- [ ] Wait for expiration (sandbox: fast-forwarded)
- [ ] Status updates to EXPIRED
- [ ] Premium features locked
- [ ] Paywall shown

##### 7. Multiple Purchases (edge case)
- [ ] Purchase subscription
- [ ] Try to purchase again
- [ ] Should recognize existing subscription

##### 8. Network Errors
- [ ] Turn off wifi
- [ ] Try to purchase
- [ ] Appropriate error message
- [ ] Turn on wifi
- [ ] Retry works

---

## Phase 6: Configuration & Environment

### Step 17: Environment Variables
**Time: 10 minutes**

#### File: `backend/.env`
```env
# Apple IAP Configuration
APPLE_SHARED_SECRET=your_shared_secret_from_app_store_connect
APPLE_BUNDLE_ID=com.yourdomain.nora
```

#### File: `nora-mobile/src/config/iap.ts` (NEW)
```typescript
export const IAP_CONFIG = {
  productIds: {
    threeMonth: 'com.nora.premium.3month', // Must match App Store Connect
  },
  appleSharedSecret: 'your_shared_secret',
};
```

---

### Step 18: Error Logging & Analytics
**Time: 20 minutes**

#### Add to IAP Service:
```typescript
// Log all purchase events
logEvent('iap_purchase_started', { productId });
logEvent('iap_purchase_success', { productId, price });
logEvent('iap_purchase_failed', { productId, error });
logEvent('iap_restore_success', { productsRestored });
```

#### Track:
- Purchase conversion rate
- Trial → paid conversion
- Restore success rate
- Error rates by type

---

## Phase 7: Production Checklist

### Step 19: Pre-Launch Verification
**Time: 30 minutes**

#### App Store Connect:
- [ ] Subscription approved and "Ready to Submit"
- [ ] Linked to app version
- [ ] Free trial configured correctly
- [ ] Pricing correct ($99.98/3 months)

#### Backend:
- [ ] Receipt validation endpoint deployed
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] Error logging configured

#### Mobile App:
- [ ] Product ID matches App Store Connect exactly
- [ ] IAP initialized on app start
- [ ] All purchase flows tested
- [ ] Error messages user-friendly
- [ ] Loading states implemented
- [ ] Restore purchases works

#### Testing:
- [ ] All test scenarios passed
- [ ] Tested on physical device
- [ ] Sandbox testing complete
- [ ] No crashes during purchase flow

---

## Implementation Timeline

### Day 1: Backend Foundation
**6-8 hours**
- Step 2: Database schema (15 min)
- Step 3: Apple receipt service (30 min)
- Step 4: Subscription service (45 min)
- Step 5: API endpoints (30 min)
- Step 6: Routes (10 min)
- **Testing & debugging: 3-4 hours**

### Day 2: Mobile Foundation
**6-8 hours**
- Step 8: IAP service (60 min)
- Step 9: Subscription context (45 min)
- Step 10: App context updates (15 min)
- Step 11: Subscription hook (15 min)
- **Testing & debugging: 3-4 hours**

### Day 3: UI Integration
**6-8 hours**
- Step 12: Update subscription screen (60 min)
- Step 13: Subscription gate component (30 min)
- Step 14: Feature gating (30 min)
- Step 17: Configuration (10 min)
- **Testing & debugging: 3-4 hours**

### Day 4: Testing
**4-6 hours**
- Step 15: Sandbox setup (20 min)
- Step 16: All test scenarios (2-3 hours)
- Bug fixes: 2-3 hours

### Day 5: Polish & Deploy
**2-4 hours**
- Step 18: Analytics (20 min)
- Step 19: Production checklist (30 min)
- Final testing: 1-2 hours
- Deploy backend
- Submit app for review

**Total Time: 22-34 hours over 5 days**

---

## Files Summary

### New Files (12)

#### Backend:
```
backend/src/services/appleReceiptService.ts
backend/src/services/subscriptionService.ts
backend/src/controllers/subscriptionController.ts
backend/src/routes/subscriptions.ts
backend/src/controllers/webhooks/appleWebhook.ts (optional)
```

#### Mobile:
```
nora-mobile/src/services/iapService.ts
nora-mobile/src/contexts/SubscriptionContext.tsx
nora-mobile/src/hooks/useSubscription.ts
nora-mobile/src/components/SubscriptionGate.tsx
nora-mobile/src/config/iap.ts
```

### Modified Files (5)
```
packages/core/prisma/schema.prisma
backend/src/index.ts
nora-mobile/src/contexts/AppContext.tsx
nora-mobile/App.tsx
nora-mobile/src/screens/onboarding/SubscriptionScreen.tsx
```

---

## Questions to Answer Before Implementation

1. **What is the exact Product ID** you created in App Store Connect?
   - Format: `com.yourdomain.nora.premium.3month`
   - Need exact string

2. **Do you have Apple Shared Secret?**
   - Get from: App Store Connect → My Apps → In-App Purchases → App-Specific Shared Secret
   - Needed for receipt validation

3. **Which features need subscription gating?**
   - Lessons?
   - Reports?
   - All premium content?

4. **Ready to start implementation?**
   - Review complete?
   - Any modifications needed?

---

## Notes & Considerations

### Advantages of This Approach:
- ✅ **Cost savings:** $4,000 - $31,000/year vs RevenueCat
- ✅ **Full control:** Own your subscription infrastructure
- ✅ **No revenue sharing:** Keep 100% (minus Apple's 30%)
- ✅ **Customizable:** Tailor to your exact needs
- ✅ **Learning:** Understand subscription system deeply

### Trade-offs:
- ⚠️ **More initial work:** ~1 week vs ~2 days with RevenueCat
- ⚠️ **Ongoing maintenance:** Need to handle edge cases yourself
- ⚠️ **No built-in analytics dashboard:** Need to build your own
- ⚠️ **Receipt validation infrastructure:** Need to maintain servers

### Recommended if:
- ✅ You expect 2,500+ paying users
- ✅ You want full control over subscription logic
- ✅ You're comfortable with 1 week implementation time
- ✅ Claude Code is available to help with maintenance

---

## Support & Resources

### Apple Documentation:
- [In-App Purchase Programming Guide](https://developer.apple.com/in-app-purchase/)
- [Receipt Validation](https://developer.apple.com/documentation/appstorereceipts/verifyreceipt)
- [StoreKit Documentation](https://developer.apple.com/documentation/storekit)

### react-native-iap:
- [GitHub](https://github.com/dooboolab/react-native-iap)
- [Documentation](https://react-native-iap.dooboolab.com/)

### Testing:
- [Sandbox Testing Guide](https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_in_sandbox)

---

**Last Updated:** January 7, 2026
**Status:** Ready for review
**Next Step:** Await user approval to begin implementation
