'use strict';

// Partner discounts are configured per-plan: config.discounts = { monthly, yearly },
// each an independent { percentOff|amountOff, duration, durationMonths?, stripeCouponId } or null.
//
// Back-compat: partners created before per-plan discounts have a single shared
// config.discount field instead. normalizeDiscounts() reads either shape and always
// returns the new { monthly, yearly } form, so every caller only deals with one format.

function discountLabel(discount) {
  if (!discount) return null;
  const amount = discount.percentOff
    ? `${discount.percentOff}% off`
    : `$${(discount.amountOff / 100).toFixed(2)} off`;
  if (discount.duration === 'forever') return `${amount} forever`;
  if (discount.duration === 'once') return `${amount} on first payment`;
  if (discount.duration === 'repeating') return `${amount} for ${discount.durationMonths} months`;
  return amount;
}

function normalizeDiscounts(config) {
  if (!config) return { monthly: null, yearly: null };
  if (config.discounts) {
    return { monthly: config.discounts.monthly ?? null, yearly: config.discounts.yearly ?? null };
  }
  if (config.discount) {
    const plans = config.plans ?? ['monthly', 'yearly'];
    const shared = config.discount;
    return {
      monthly: plans.includes('monthly') ? shared : null,
      yearly: plans.includes('yearly') ? shared : null,
    };
  }
  return { monthly: null, yearly: null };
}

module.exports = { discountLabel, normalizeDiscounts };
