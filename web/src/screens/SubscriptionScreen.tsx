import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import { createCheckoutSession, fetchPrices, StripePrices } from '../api';

type Plan = 'monthly' | 'yearly';

const CheckIcon = () => (
  <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
    <path d="M1 5.5L5 9.5L13 1" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function SubscriptionScreen() {
  const navigate = useNavigate();
  const { data } = useOnboarding();
  const partner = data.partnerInfo;

  // Only show plans allowed by the partner config (or both if no partner)
  const allowedPlans: Plan[] = (partner?.plans ?? ['monthly', 'yearly']) as Plan[];
  const [selectedPlan, setSelectedPlan] = useState<Plan>(
    allowedPlans.includes('yearly') ? 'yearly' : allowedPlans[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<StripePrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    fetchPrices()
      .then(setPrices)
      .catch(() => {})
      .finally(() => setPricesLoading(false));
  }, []);

  // Discounted price = what actually gets charged after the trial, once the partner's Stripe
  // coupon (percentOff or amountOff, matching Stripe's own discount fields) is applied — the
  // same math Stripe's checkout will do, so the price shown here isn't just a promise.
  // Each plan has its own independent discount (possibly none) — never assume one plan's
  // discount applies to the other.
  const monthlyDiscount = partner?.discounts?.monthly ?? null;
  const yearlyDiscount = partner?.discounts?.yearly ?? null;

  const applyDiscount = (amount: number, discount: typeof monthlyDiscount): number => {
    if (!discount) return amount;
    if (discount.percentOff) return amount * (1 - discount.percentOff / 100);
    if (discount.amountOff) return Math.max(amount - discount.amountOff / 100, 0);
    return amount;
  };
  const formatPrice = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const yearlyFormatted = prices?.yearly?.formatted ?? '—';
  const monthlyFormatted = prices?.monthly?.formatted ?? '—';
  const yearlyPerMonth = prices?.yearlyPerMonth ?? '—';
  const savingsPercent = prices?.savingsPercent ?? 0;

  const yearlyDiscounted = prices?.yearly && yearlyDiscount
    ? formatPrice(applyDiscount(prices.yearly.amount, yearlyDiscount), prices.yearly.currency)
    : null;
  const yearlyPerMonthDiscounted = prices?.yearly && yearlyDiscount
    ? formatPrice(applyDiscount(prices.yearly.amount, yearlyDiscount) / 12, prices.yearly.currency)
    : null;
  const monthlyDiscounted = prices?.monthly && monthlyDiscount
    ? formatPrice(applyDiscount(prices.monthly.amount, monthlyDiscount), prices.monthly.currency)
    : null;

  // "SAVE 29% + 20%" — the base yearly-vs-monthly savings, plus the yearly plan's own
  // discount on top of it, shown as two separate figures rather than merged into one.
  const saveBadge = [
    savingsPercent > 0 ? `${savingsPercent}%` : null,
    yearlyDiscount?.percentOff ? `${yearlyDiscount.percentOff}%` : null,
  ].filter(Boolean).join(' + ');

  const selectedDiscount = selectedPlan === 'yearly' ? yearlyDiscount : monthlyDiscount;
  const selectedPrice = selectedPlan === 'yearly'
    ? (yearlyDiscounted ?? yearlyFormatted)
    : (monthlyDiscounted ?? monthlyFormatted);

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createCheckoutSession({
        plan: selectedPlan,
        successUrl: `${window.location.origin}/success`,
        cancelUrl: window.location.href,
      }, data.accessToken);
      window.location.href = result.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout>
      {/* <p className="text-center text-[#1E2939] text-xl font-semibold mt-1 mb-4">Choose an option</p> */}

      {/* Header */}
      <div className="w-full px-6 pt-8 pb-8 text-center flex-shrink-0">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-1">Start Your Free Trial</h1>
        <p className="text-[#1E2939]/70 text-sm">
          {partner ? `${partner.trialDays} days free` : '7 days free'}, cancel anytime
        </p>
        {/* {(['monthly', 'yearly'] as const)
          .filter(plan => partner?.discounts?.[plan])
          .map(plan => (
            <div key={plan} className="mt-2 inline-flex items-center gap-2 bg-[#F5F3FF] rounded-full px-3 py-1">
              <span className="text-[#8C49D5] text-xs font-semibold">
                Special discount{partner?.name ? ` for ${partner.name}` : ''} ({plan}):
              </span>
              <span className="text-[#1E2939] text-xs font-semibold">{partner!.discounts[plan]!.label}</span>
            </div>
          ))} */}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4">
        {/* Plan options — filtered to partner's allowed plans */}
        <div className="flex flex-col gap-3 mb-6">
          {allowedPlans.includes('yearly') && (
            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`relative w-full text-left rounded-xl border-2 p-5 transition-all duration-150
                ${selectedPlan === 'yearly' ? 'border-[#8C49D5] bg-[#F5F3FF]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="absolute -top-3 left-4">
                <span className="bg-[#8C49D5] text-white text-xs font-bold px-3 py-1 rounded-full">
                  {yearlyDiscount
                    ? `Special discount for ${partner?.name}: ${yearlyDiscount.percentOff != null ? `${yearlyDiscount.percentOff}% off` : yearlyDiscount.label}`
                    : `BEST VALUE${saveBadge ? ` · SAVE ${saveBadge}` : ''}`}
                </span>
              </div>
              <p className="font-bold text-[#1E2939] text-base mt-1">Yearly</p>
              <div className="mt-1">
                {yearlyPerMonthDiscounted && (
                  <p className="text-[#9CA3AF] text-lg line-through">{yearlyPerMonth}/month</p>
                )}
                <p className="font-bold text-[#1E2939] text-2xl">
                  {pricesLoading ? '...' : `${yearlyPerMonthDiscounted ?? yearlyPerMonth}/month`}{' '}
                  <span className="text-[#6B7280] text-sm font-normal">(billed annually)</span>
                </p>
              </div>
            </button>
          )}

          {allowedPlans.includes('monthly') && (
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`relative w-full text-left rounded-xl border-2 p-5 transition-all duration-150
                ${selectedPlan === 'monthly' ? 'border-[#8C49D5] bg-[#F5F3FF]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              {monthlyDiscount && (
                <div className="absolute -top-3 left-4">
                  <span className="bg-[#8C49D5] text-white text-xs font-bold px-3 py-1 rounded-full">
                    {`Special discount for ${partner?.name}: ${monthlyDiscount.percentOff != null ? `${monthlyDiscount.percentOff}% off` : monthlyDiscount.label}`}
                  </span>
                </div>
              )}
              <p className="font-bold text-[#1E2939] text-base mt-1">Monthly</p>
              <div className="mt-1">
                {monthlyDiscounted && (
                  <p className="text-[#9CA3AF] text-lg line-through">{monthlyFormatted}/month</p>
                )}
                <p className="font-bold text-[#1E2939] text-2xl">
                  {pricesLoading ? '...' : `${monthlyDiscounted ?? monthlyFormatted}/month`}{' '}
                  <span className="text-[#6B7280] text-sm font-normal">(billed monthly)</span>
                </p>
              </div>
            </button>
          )}
        </div>

        {/* What's included */}
        <div className="border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-[#1E2939] font-semibold text-sm mb-3">Everything included:</p>
          <div className="flex flex-col gap-2">
            {[
              'Daily 5-minute play session coaching',
              'AI-powered session analysis',
              'Personalized parenting insights',
              '90+ language support',
              'Unlimited sessions',
            ].map(feature => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                  <CheckIcon />
                </div>
                <span className="text-[#6B7280] text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={handleSubscribe} loading={loading || pricesLoading}>
          Start {partner ? `${partner.trialDays}-day` : '7-day'} free trial
        </PrimaryButton>
        <div className="flex justify-center mt-3">
          <button
            onClick={() => navigate('/success')}
            className="text-[#6B7280] text-xs hover:text-[#1E2939] underline"
          >
            Skip for Now
          </button>
        </div>
        {/* <p className="text-center text-xs text-gray-400 mt-2">
          Free for {partner ? partner.trialDays : 7} days, then {pricesLoading ? '...' : `${selectedPrice}/${selectedPlan === 'yearly' ? 'year' : 'month'}`}
          {selectedDiscount ? ` (${selectedDiscount.label})` : ''}. Cancel anytime.
        </p> */}
      </div>
    </OnboardingLayout>
  );
}
