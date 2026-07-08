# Partner Onboarding Manual

Step-by-step guide for setting up a B2B partner in the admin portal so their users receive a customised Nora subscription offer.

---

## Before you start

Collect the following from the partner before opening the portal:

| Item | Example | Notes |
|---|---|---|
| Organisation name | SGH Family Medicine | Shown in the discount badge on the pricing screen |
| Short identifier | `sgh-family` | Used in the URL — lowercase, hyphens only, no spaces |
| Trial length | 30 days | How many free days before the first charge |
| Discount **per plan** | Yearly: 20% off forever. Monthly: none | Each plan can have its own discount (percent or fixed amount), or no discount at all |
| Which plans | Monthly and yearly | Or monthly-only / yearly-only |
| Welcome message | "Welcome, SGH partners! ..." | Optional. Not currently shown anywhere in the UI (see note in Step 6) — kept for future use |
| Maximum signups | 500 | Optional. Leave blank for unlimited |
| Link expiry | 31 Dec 2027 | Optional. Leave blank if the deal has no end date |

---

## Step 1 — Log into the admin portal

Go to the admin portal and log in with your admin credentials.

> If you only have therapist access, you will not see the Partners section. Ask an admin to set up the partner for you.

---

## Step 2 — Open the Partners page

In the left navigation, click **Partners** (below Free Accounts).

You will see a table of all existing partners, or an empty state if none have been created yet.

---

## Step 3 — Create the partner

Click **+ New Partner** in the top-right corner. A form appears.

Fill in each field:

**Name** *(required)*
The organisation's full display name. Shown to users in the discount badge on the pricing screen (e.g. "Special discount for SGH Family Medicine: 20% off").
Example: `SGH Family Medicine`

**Slug** *(required, set once)*
A short URL-safe identifier. The system auto-suggests one from the name — you can edit it. Once saved, the slug cannot be changed, because it is part of the URL on any QR codes already distributed.
Rules: lowercase letters, numbers, and hyphens only. No spaces.
Example: `sgh-family`

**Welcome message** *(optional)*
Not currently displayed anywhere in the app — the field still exists in case a future screen surfaces it, but there's no need to fill it in today.

**Trial days**
Number of free days before Stripe charges the user. Default is 7. Change to the agreed trial length (e.g. 30).

**Max redemptions** *(optional)*
Maximum number of users who can sign up using this link. Leave blank for unlimited.

**Expires** *(optional)*
Date after which the link stops working. Leave blank if the partnership has no end date.

**Available plans**
Tick which plans to show at checkout. Both monthly and yearly are ticked by default. Untick one if the partner deal covers only one billing cycle.

**Discounts** — one independent block appears below for each plan you've ticked above (e.g. a "Monthly" block and a "Yearly" block). Each plan's discount is configured completely separately — a partner deal might discount only the yearly plan, only the monthly plan, both with different terms, or neither.

For each plan you want to discount, tick **Apply a discount to \<Plan\>** in that plan's block:

  - **Type**: choose *Percent off* (most common) or *Amount off* (fixed dollar)
  - If *Percent off*: enter the percentage (e.g. `20` for 20% off)
  - If *Amount off*: enter the amount **in cents** (e.g. `1000` for $10.00 off) — currency defaults to SGD
  - **Duration**:
    - *Forever* — discount applies to every renewal for the life of the subscription
    - *First payment only* — one-time discount on the first charge after the trial
    - *N months* — discount applies for a set number of months; enter the number when prompted

Leave a plan's "Apply a discount" box unticked if that plan should be offered at full price.

Click **Create partner**.

The system will create a Stripe coupon automatically for each plan that has a discount configured. You do not need to do anything in Stripe.

---

## Step 4 — Get the partner URL

After saving, the partner appears in the table. Find the row and look at the **URL / Slug** column.

Click **Copy** next to the slug. This copies the full partner URL to your clipboard:

```
https://hinora.co/p/sgh-family
```

This is the URL that goes on the QR code and any communications to the partner.

---

## Step 5 — Generate the QR code

The admin portal does not generate QR codes directly. Use any free QR code generator:

1. Open [qr-code-generator.com](https://www.qr-code-generator.com) or [goqr.me](https://goqr.me)
2. Paste the partner URL (e.g. `https://hinora.co/p/sgh-family`)
3. Download as PNG or SVG
4. Hand the QR image and URL to the partner for use in posters, emails, or their patient portal

> **Always test the QR code by scanning it yourself before handing it over** (see Step 6).

---

## Step 6 — Test the link

Open the partner URL in a browser (or scan the QR code with your phone):

```
https://hinora.co/p/sgh-family
```

**There is no visible partner landing page anymore** — the link loads the partner's offer in the background and immediately redirects to the normal signup screen (`/signup/`). This is expected; you won't see anything partner-specific until you reach `/subscribe` later in the flow. If the slug is invalid or expired, this redirect still happens (silently, with no partner discount attached) rather than showing an error page.

Click through **Get Started** → **Create your account** and the rest of onboarding as a real user would.

On the **/subscribe** screen, confirm:
- Each plan's price reflects the agreed discount (strikethrough original price + discounted price), only on the plan(s) that were configured with a discount
- The plan's badge reads "Special discount for \<Organisation Name\>: X% off" on the discounted plan(s)
- Only the agreed plans are shown (e.g. only Monthly, if that was the deal)
- The trial length in the header and button matches what was agreed

You do not need to complete a payment to confirm the setup is correct.

---

## Step 7 — Send details to the partner

Send the partner contact:

1. **The URL**: `https://hinora.co/p/sgh-family`
2. **The QR code image** (PNG or SVG)
3. A brief description of what their users will see:

> *"When your users scan the QR code or open the link, they'll land on the Nora signup page. They create an account, complete a short onboarding, and when they reach the pricing screen their exclusive offer — a [X]-day free trial and [discount] — is already applied automatically. After subscribing, they download the Nora app to begin."*

---

## Checking usage after launch

In the admin portal → Partners, the table shows:

- **Usage column**: `X / Y signups` — number of users who signed up via the link, against the cap (if one was set). A user who signed up but has not yet subscribed is still counted.
- **Users column**: number of users who completed checkout and have an active subscription

Check back a few days after launch to confirm signups are coming in.

---

## Making changes after launch

### Change the discount or trial length

Admin portal → Partners → **Edit** on the partner row → update the relevant fields → **Save changes**.

The Stripe coupon is automatically updated (the old one is archived, a new one is created). Users who already subscribed before the change are **not** affected — their existing coupon stays on their Stripe subscription. Only new signups get the updated offer.

The URL and QR code do not change.

### Change the available plans

Admin portal → Partners → **Edit** → update **Available plans** → **Save changes**. Takes effect immediately for all new visitors. (The welcome message field can be edited too, but nothing in the app currently displays it.)

### Increase or remove the redemption cap

Admin portal → Partners → **Edit** → change the Max redemptions field → **Save changes**.

### Extend or remove the expiry date

Admin portal → Partners → **Edit** → change or clear the Expires field → **Save changes**.

### Pause the link temporarily

Admin portal → Partners → **Deactivate** on the partner row.

The URL immediately returns "link not found" to new visitors. Existing users who already signed up and subscribed keep their access — deactivating the link does not cancel their subscription.

To re-activate a paused partner, contact a developer (re-activate button coming soon).

### The link has expired (past the expiry date)

The URL automatically returns "this link has expired" once the expiry date passes. No action needed. Existing subscribers are unaffected.

---

## Troubleshooting

**The partner link doesn't seem to do anything special — no error, but also no offer**
- This is largely expected now: the link redirects silently with no visible confirmation. Check the partner's discount actually shows up later, on `/subscribe` — that's the real test, not the link itself.
- If it's genuinely not applying: check the slug in the URL matches exactly what was created (case-sensitive, hyphens not underscores), and check the partner status/expiry/redemption cap in the admin portal (an inactive/expired/over-cap link silently falls back to the normal no-partner flow rather than showing an error).

**Users are not seeing the discount at checkout**
- Confirm a discount was actually configured **on that specific plan** — check the Partners table, which shows a separate discount line per plan (e.g. "Yearly: 20% off forever"). A discount on yearly does not apply to monthly, and vice versa.
- Ask the user to clear their browser's `localStorage` and retry from the partner URL. The partner context is saved to `localStorage` the moment the `/p/:slug` link is visited (even though nothing appears onscreen) — if a user reaches `/create-account` without ever having opened the partner link first, no discount is applied.

**The discount is showing the wrong amount**
- The discount shown to users is computed both client-side (for display, from the same percent/amount config) and at Stripe checkout time (from the coupon) — they should always match. If the coupon was recently changed, the old coupon may still be attached to a user's checkout session in progress. Ask the user to go back to `/subscribe` and start a new checkout.

**The redemption count seems higher than expected**
- Redemptions are counted at signup, not at checkout completion. Users who created an account through the partner link but have not yet subscribed are included in the count. The **Users** column shows only those who completed checkout.
