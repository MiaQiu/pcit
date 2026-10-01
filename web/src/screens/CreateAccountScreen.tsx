import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import BackButton from '../components/BackButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import { signup } from '../api';

export default function CreateAccountScreen() {
  const navigate = useNavigate();
  const { data, setEmail, setPassword, setAccessToken } = useOnboarding();
  const [emailVal, setEmailVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [phoneVal, setPhoneVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Campaign links can override this screen's title/subtitle (referral copy still wins).
  const landing = data.referralCode ? null : data.partnerInfo?.landing;
  // Campaign signups must tick a consent checkbox (parent/guardian + rules + Terms/Privacy).
  const isCampaign = data.partnerInfo?.kind === 'CAMPAIGN' && !data.referralCode;
  const rules = isCampaign ? data.partnerInfo?.campaignRules ?? null : null;
  const [agreed, setAgreed] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const handleSignup = async () => {
    if (!emailVal || !phoneVal.trim() || !passwordVal) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^\+?[\d\s().-]{7,25}$/.test(phoneVal.trim())) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (passwordVal.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordVal)) {
      setError('Password must include uppercase, lowercase, and a number.');
      return;
    }
    if (isCampaign && !agreed) {
      setError('Please tick the box to confirm and agree before creating your account.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const childBirthYear = data.childBirthday
        ? new Date(data.childBirthday).getFullYear()
        : new Date().getFullYear() - 4;
      const childConditions = data.issue.length > 0 ? data.issue : ['General parenting support'];

      const res = await signup(emailVal, passwordVal, {
        name: data.name || undefined,
        phone: phoneVal.trim(),
        childName: data.childName || undefined,
        childBirthYear,
        childBirthday: data.childBirthday ? new Date(data.childBirthday).toISOString() : undefined,
        childConditions,
        issue: data.issue.join(', ') || undefined,
        partnerSlug: data.referralCode ? undefined : (data.partnerInfo?.slug ?? undefined),
        referralCode: data.referralCode ?? undefined,
      });
      setEmail(emailVal);
      setPassword(passwordVal);
      setAccessToken(res.accessToken);
      navigate('/onboarding/name');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout>
      <div className="flex items-center px-4 pt-2">
        <BackButton to="/intro" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 whitespace-pre-line">
          {landing?.accountTitle || 'Create your account'}
        </h1>
        {data.referralCode ? (
          <p className="text-[#6B7280] text-sm mb-8">
            {data.referrerName ? `${data.referrerName} invited you to Nora. ` : ''}
            Create your account to start your{' '}
            {data.partnerInfo?.trialDays ?? 30}-day free trial.
          </p>
        ) : (
          <p className="text-[#6B7280] text-sm mb-8 whitespace-pre-line">
            {landing?.accountSubtitle || 'Join thousands of parents raising happier, more confident kids.'}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1E2939] mb-2">Email</label>
            <input
              type="email"
              value={emailVal}
              onChange={e => setEmailVal(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E2939] mb-2">Phone number</label>
            <input
              type="tel"
              value={phoneVal}
              onChange={e => setPhoneVal(e.target.value)}
              placeholder="9123 4567"
              className="input-field"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E2939] mb-2">Password</label>
            <input
              type="password"
              value={passwordVal}
              onChange={e => setPasswordVal(e.target.value)}
              placeholder="Min 8 chars, upper/lower/number"
              className="input-field"
              autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleSignup()}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          {isCampaign && (
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#8C49D5]"
              />
              <span className="text-xs text-[#4B5563] leading-relaxed">
                I am the parent or legal guardian of the participating child, and I agree to{' '}
                {rules && (
                  <>
                    the{' '}
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setShowRules(true); }}
                      className="text-[#8C49D5] underline"
                    >
                      {rules.title || 'Campaign Rules'}
                    </button>
                    {' '}and{' '}
                  </>
                )}
                Nora Parenting's standard{' '}
                <a href="https://hinora.co/terms" target="_blank" rel="noopener noreferrer" className="text-[#8C49D5] underline">Terms of Service</a>
                {' '}and{' '}
                <a href="https://hinora.co/privacy" target="_blank" rel="noopener noreferrer" className="text-[#8C49D5] underline">Privacy Policy</a>.
              </span>
            </label>
          )}

          <PrimaryButton onClick={handleSignup} loading={loading} disabled={isCampaign && !agreed}>
            Create Account
          </PrimaryButton>

          {!isCampaign && (
            <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="https://hinora.co/terms" target="_blank" rel="noopener noreferrer" className="text-[#8C49D5] underline">Terms of Service</a>
              {' '}and{' '}
              <a href="https://hinora.co/privacy" target="_blank" rel="noopener noreferrer" className="text-[#8C49D5] underline">Privacy Policy</a>
            </p>
          )}
        </div>
      </div>

      {showRules && rules && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setShowRules(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-rules-title"
            className="bg-white w-full max-w-[480px] max-h-[85dvh] rounded-t-2xl sm:rounded-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 id="campaign-rules-title" className="text-[#1E2939] text-lg font-bold pr-4">
                {rules.title || 'Campaign Rules'}
              </h2>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full hover:bg-gray-100 text-[#6B7280] text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 text-sm text-[#374151] leading-relaxed whitespace-pre-line">
              {rules.content}
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-gray-100">
              <PrimaryButton onClick={() => setShowRules(false)}>Close</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </OnboardingLayout>
  );
}
