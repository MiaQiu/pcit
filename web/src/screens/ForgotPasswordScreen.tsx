import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import BackButton from '../components/BackButton';
import { forgotPassword } from '../api';

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [emailVal, setEmailVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!emailVal) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(emailVal);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout>
      <div className="flex items-center px-4 pt-2">
        <BackButton to="/login" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <div className="w-12 h-12 bg-[#EDE9FE] rounded-xl flex items-center justify-center mb-6">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 6L12 13L2 6" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 className="text-[#1E2939] text-2xl font-bold mb-2">Forgot Password?</h1>
        <p className="text-[#6B7280] text-sm mb-8">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="font-semibold text-[#1E2939] mb-2">Reset Link Sent!</h3>
            <p className="text-[#6B7280] text-sm">
              We've sent a password reset link to <strong>{emailVal}</strong>. Please check your inbox.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 text-[#8C49D5] font-semibold text-sm hover:underline"
            >
              Back to Log In
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#1E2939] mb-2">Email Address</label>
              <input
                type="email"
                value={emailVal}
                onChange={e => setEmailVal(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-auto">
              <PrimaryButton onClick={handleSubmit} loading={loading}>
                Send Reset Link
              </PrimaryButton>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-3 h-12 text-[#6B7280] font-medium text-sm hover:text-[#1E2939] transition-colors"
              >
                Back to Log In
              </button>
            </div>
          </>
        )}
      </div>
    </OnboardingLayout>
  );
}
