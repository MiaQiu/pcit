import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const benefits = [
  { label: "Follow your child's lead" },
  { label: 'Stay fully present' },
  { label: 'Build positive behavior' },
  { label: 'Develop social skills' },
  { label: 'Improve focus' },
];

export default function Intro3Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={84} backTo="/onboarding/behavior-profile">
      {/* Illustration */}
      <div className="w-full h-56 bg-[#8C49D5] flex flex-col items-center justify-center px-6 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 text-center">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4">
            <circle cx="32" cy="32" r="28" fill="white" opacity="0.2"/>
            <circle cx="32" cy="24" r="10" fill="white" opacity="0.9"/>
            <path d="M14 52c0-9.94 8.06-18 18-18s18 8.06 18 18" fill="white" opacity="0.9"/>
          </svg>
          <div className="bg-white/20 rounded-2xl px-6 py-3">
            <p className="text-white font-bold text-lg">5 Minutes</p>
            <p className="text-white/80 text-sm">Daily Connection</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <div className="mb-3">
          <span className="text-xs font-bold tracking-widest text-[#8C49D5] uppercase">Emotional Massage</span>
        </div>

        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight">
          Emotional Massage
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 leading-relaxed">
          A simple 5-minute daily play with your child. By following your child's lead and staying fully present, you support their ability to build positive behavior, develop social skills, and improve focus.
        </p>

        <div className="flex flex-col gap-3">
          {benefits.map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#8C49D5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[#1E2939] text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/play/1')}>
          Let's Begin
        </PrimaryButton>
        <button
          onClick={() => navigate('/subscribe')}
          className="w-full mt-3 h-12 text-[#6B7280] font-medium text-sm hover:text-[#1E2939] transition-colors"
        >
          Skip for Now
        </button>
      </div>
    </OnboardingLayout>
  );
}
