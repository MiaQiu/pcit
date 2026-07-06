import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { validatePartner, PartnerInfo } from '../api';
import { useOnboarding } from '../contexts/OnboardingContext';
import PrimaryButton from '../components/PrimaryButton';

export default function PartnerLandingScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setPartnerInfo } = useOnboarding();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) { navigate('/'); return; }
    validatePartner(slug)
      .then(info => {
        setPartner(info);
        setPartnerInfo({ slug, ...info });
      })
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#8C49D5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#1E2939] font-semibold text-lg mb-2">Link unavailable</p>
        <p className="text-[#6B7280] text-sm mb-6">{error || 'This partner link is no longer active.'}</p>
        <Link to="/" className="text-[#8C49D5] text-sm underline">Go to main signup</Link>
      </div>
    );
  }

  const trialText = partner.trialDays === 7
    ? '7-day free trial'
    : `${partner.trialDays}-day free trial`;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="w-full bg-[#8C49D5] px-6 pt-12 pb-10 text-center relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-white/70 text-sm font-medium mb-1 uppercase tracking-wide">Partner offer</p>
          <h1 className="text-white text-2xl font-bold">{partner.name}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-8 flex flex-col">
        {/* Welcome message */}
        {partner.welcomeMessage && (
          <p className="text-[#374151] text-base text-center mb-6 leading-relaxed">
            {partner.welcomeMessage}
          </p>
        )}

        {/* Offer highlights */}
        <div className="bg-[#F5F3FF] border border-[#EDE9FE] rounded-2xl p-5 mb-8">
          <p className="text-[#8C49D5] text-xs font-bold uppercase tracking-wide mb-3">Your exclusive offer</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#8C49D5]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#8C49D5" strokeWidth="2"/>
                  <polyline points="12 6 12 12 16 14" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[#1E2939] font-semibold text-sm">{trialText}</p>
                <p className="text-[#6B7280] text-xs">No charge during your trial</p>
              </div>
            </div>
            {partner.discountLabel && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#8C49D5]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[#1E2939] font-semibold text-sm capitalize">{partner.discountLabel}</p>
                  <p className="text-[#6B7280] text-xs">Applied automatically at checkout</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#8C49D5]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[#1E2939] font-semibold text-sm">Full Nora access</p>
                <p className="text-[#6B7280] text-xs">AI coaching, session analysis, 90+ languages</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <PrimaryButton onClick={() => navigate('/create-account')}>
            Get Started
          </PrimaryButton>
          <p className="text-center text-xs text-[#6B7280] mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-[#8C49D5] underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
