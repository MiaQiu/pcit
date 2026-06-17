import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';

export default function LandingScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      {/* Hero illustration */}
      <div className="w-full bg-[#8C49D5] flex flex-col items-center justify-center px-6 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />

        {/* Abstract parent-child illustration */}
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none" className="relative z-10 mb-2">
          {/* Adult */}
          <circle cx="80" cy="48" r="20" fill="white" opacity="0.9"/>
          <path d="M52 130c0-15.46 12.54-28 28-28s28 12.54 28 28" fill="white" opacity="0.9"/>
          {/* Child */}
          <circle cx="138" cy="58" r="14" fill="white" opacity="0.6"/>
          <path d="M116 130c0-12.15 9.85-22 22-22s22 9.85 22 22" fill="white" opacity="0.6"/>
          {/* Connection */}
          <path d="M100 80 Q112 64 122 70" stroke="white" strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/>
          {/* Heart */}
          <path d="M110 45 C110 43 108 40.5 105.5 40.5 C103 40.5 101 43 101 45 C101 49 110 54 110 54 C110 54 119 49 119 45 C119 43 117 40.5 114.5 40.5 C112 40.5 110 43 110 45Z" fill="white" opacity="0.4"/>
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
        <h2 className="text-[#1E2939] text-2xl font-bold text-center mb-3 leading-tight">
          Raise confident, happy kids — with just 5 minutes a day
        </h2>
        <p className="text-[#6B7280] text-sm text-center mb-8 leading-relaxed">
          Science-backed parenting coaching, personalized for your child
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Child Development', 'Play Therapy', 'Research-Based'].map(tag => (
            <span key={tag} className="bg-[#EDE9FE] text-[#8C49D5] text-xs rounded-full px-3 py-1 font-medium">{tag}</span>
          ))}
        </div>

        <div className="mt-auto">
          <PrimaryButton onClick={() => navigate('/demo/1')}>
            Get Started
          </PrimaryButton>
          <p className="text-center text-xs text-gray-400 mt-4">
            Free to try · No credit card required
          </p>
          <p className="text-center text-sm text-gray-500 mt-3">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-[#8C49D5] font-semibold hover:underline"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
