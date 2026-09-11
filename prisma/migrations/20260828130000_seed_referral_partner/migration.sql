-- Reserved "referral" partner row.
--
-- Referred users are attached to this partner (User.partnerId) so the existing
-- partner -> Stripe-checkout pipeline grants them a 30-day trial with no coupon.
-- Per-referrer attribution ("who referred whom", reward status) lives in the
-- Referral table, not here. Partner.redemptions doubles as a referred-signups
-- counter.
--
-- Edit the trial length later from the admin Partners page like any partner.

INSERT INTO "Partner" ("id", "slug", "name", "status", "config", "expiresAt", "redemptions", "createdAt")
VALUES (
  gen_random_uuid()::text,
  'referral',
  'Referral',
  'ACTIVE',
  '{"trialDays":30,"plans":["monthly","yearly"],"discounts":{"monthly":null,"yearly":null},"maxRedemptions":null}'::jsonb,
  NULL,
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
