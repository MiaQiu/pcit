import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import BackButton from '../components/BackButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import { login } from '../api';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { setEmail, setPassword, setAccessToken } = useOnboarding();
  const [emailVal, setEmailVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!emailVal || !passwordVal) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await login(emailVal, passwordVal);
      setEmail(emailVal);
      setPassword(passwordVal);
      setAccessToken(res.accessToken);
      navigate('/onboarding/name');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout>
      <div className="flex items-center px-4 pt-2">
        <BackButton to="/" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2">Log in</h1>
        <p className="text-[#6B7280] text-sm mb-8">Welcome back! We've missed you.</p>

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
              placeholder="••••••••"
              className="input-field"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => navigate('/forgot-password')}
              className="text-[#8C49D5] text-sm font-medium hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <PrimaryButton onClick={handleLogin} loading={loading}>
            Log In
          </PrimaryButton>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/create-account')}
              className="text-[#8C49D5] font-semibold hover:underline"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
