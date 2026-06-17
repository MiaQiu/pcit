import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const strategies = [
  {
    label: 'Therapeutic Play Techniques',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'Setting Boundaries',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8C49D5" strokeWidth="2"/>
        <path d="M8 12h8" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Manage Emotions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function Demo1BScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={6} backTo="/demo/1">
      {/* Illustration */}
      <div className="w-full h-60 bg-[#8C49D5] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-6 left-6 w-14 h-14 bg-white/10 rounded-2xl" />
        <div className="absolute bottom-6 right-6 w-10 h-10 bg-white/10 rounded-xl" />
        <div className="absolute top-8 right-12 w-8 h-8 bg-white/10 rounded-full" />
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="relative z-10">
          {/* Three pillars */}
          <rect x="10" y="50" width="24" height="44" rx="4" fill="white" opacity="0.3"/>
          <rect x="48" y="30" width="24" height="64" rx="4" fill="white" opacity="0.5"/>
          <rect x="86" y="16" width="24" height="78" rx="4" fill="white" opacity="0.7"/>
          {/* Stars at top of pillars */}
          <circle cx="22" cy="44" r="4" fill="white" opacity="0.6"/>
          <circle cx="60" cy="24" r="4" fill="white" opacity="0.8"/>
          <circle cx="98" cy="10" r="4" fill="white"/>
        </svg>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight">
          Get simple strategies that actually work.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Nora gives you practical, evidence-based techniques you can use every day to support your child's growth.
        </p>

        <div className="flex flex-col gap-2.5 mb-8">
          {strategies.map(s => (
            <div key={s.label} className="flex items-center gap-4 border border-gray-200 rounded-xl p-4">
              <div className="w-9 h-9 bg-[#EDE9FE] rounded-lg flex items-center justify-center flex-shrink-0">
                {s.icon}
              </div>
              <span className="font-medium text-[#1E2939] text-sm">{s.label}</span>
            </div>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/demo/2')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
