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
  const [selectedPlan, setSelectedPlan] = useState<Plan>('yearly');
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

  const yearlyFormatted = prices?.yearly?.formatted ?? '—';
  const monthlyFormatted = prices?.monthly?.formatted ?? '—';
  const yearlyPerMonth = prices?.yearlyPerMonth ?? '—';
  const savingsPercent = prices?.savingsPercent ?? 0;
  const selectedPrice = selectedPlan === 'yearly' ? yearlyFormatted : monthlyFormatted;

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createCheckoutSession({
        plan: selectedPlan,
        successUrl: `${window.location.origin}/signup/success`,
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
      {/* Header */}
      <div className="w-full bg-[#8C49D5] px-6 pt-8 pb-8 text-center relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1 className="text-white text-2xl font-bold mb-1">Start Your Free Trial</h1>
          <p className="text-white/70 text-sm">7 days free, cancel anytime</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        {/* Plan options */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Yearly */}
          <button
            onClick={() => setSelectedPlan('yearly')}
            className={`relative w-full text-left rounded-xl border-2 p-5 transition-all duration-150
              ${selectedPlan === 'yearly' ? 'border-[#8C49D5] bg-[#F5F3FF]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="absolute -top-3 left-4">
              <span className="bg-[#8C49D5] text-white text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE{savingsPercent > 0 ? ` · SAVE ${savingsPercent}%` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="font-bold text-[#1E2939] text-base">Yearly</p>
                <p className="text-[#6B7280] text-sm">
                  {pricesLoading ? '...' : `${yearlyPerMonth}/month, billed annually`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#1E2939] text-xl">
                  {pricesLoading ? '...' : yearlyFormatted}
                </p>
                <p className="text-[#6B7280] text-xs">per year</p>
              </div>
            </div>
          </button>

          {/* Monthly */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`w-full text-left rounded-xl border-2 p-5 transition-all duration-150
              ${selectedPlan === 'monthly' ? 'border-[#8C49D5] bg-[#F5F3FF]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#1E2939] text-base">Monthly</p>
                <p className="text-[#6B7280] text-sm">Flexible, cancel anytime</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#1E2939] text-xl">
                  {pricesLoading ? '...' : monthlyFormatted}
                </p>
                <p className="text-[#6B7280] text-xs">per month</p>
              </div>
            </div>
          </button>
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
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={handleSubscribe} loading={loading || pricesLoading}>
          Start 7-day free trial
        </PrimaryButton>
        <div className="flex justify-center mt-3">
          <button
            onClick={() => navigate('/success')}
            className="text-[#6B7280] text-xs hover:text-[#1E2939] underline"
          >
            Skip for Now
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Free for 7 days, then {pricesLoading ? '...' : `${selectedPrice}/${selectedPlan === 'yearly' ? 'year' : 'month'}`}. Cancel anytime.
        </p>
      </div>
    </OnboardingLayout>
  );
}
