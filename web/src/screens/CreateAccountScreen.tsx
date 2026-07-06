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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!emailVal || !passwordVal) {
      setError('Please fill in all fields.');
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
    setLoading(true);
    setError('');
    try {
      const childBirthYear = data.childBirthday
        ? new Date(data.childBirthday).getFullYear()
        : new Date().getFullYear() - 4;
      const childConditions = data.issue.length > 0 ? data.issue : ['General parenting support'];

      const res = await signup(emailVal, passwordVal, {
        name: data.name || undefined,
        childName: data.childName || undefined,
        childBirthYear,
        childBirthday: data.childBirthday ? new Date(data.childBirthday).toISOString() : undefined,
        childConditions,
        issue: data.issue.join(', ') || undefined,
        partnerSlug: data.partnerInfo?.slug ?? undefined,
      });
      setEmail(emailVal);
      setPassword(passwordVal);
      setAccessToken(res.accessToken);
      navigate('/subscribe');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout>
      <div className="flex items-center px-4 pt-2">
        <BackButton to="/play/5" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2">Create your account</h1>
        <p className="text-[#6B7280] text-sm mb-8">
          Join thousands of parents raising happier, more confident kids.
        </p>

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
          <PrimaryButton onClick={handleSignup} loading={loading}>
            Create Account
          </PrimaryButton>

          <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-[#8C49D5] underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#8C49D5] underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
