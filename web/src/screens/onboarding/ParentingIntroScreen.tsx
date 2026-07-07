import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import dragonImage from '../../assets/images/dragon.png';

const benefits = [
  {
    title: 'Build Stronger Bonding',
    desc: 'Deepen your connection through intentional daily moments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Reduce Behavior Issues',
    desc: 'Proven techniques that address the root causes of challenging behaviors',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="22 4 12 14.01 9 11.01" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Boost Social & Emotional Skills',
    desc: "Support your child's development across all key growth areas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="17 6 23 6 23 12" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function ParentingIntroScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={26} backTo="/demo/5">

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Just 5 minutes a day can make a difference.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 text-center">
          Small, consistent moments of intentional play build lasting change for your child.
        </p>

        {/* Illustration */}
        <div className="flex items-center justify-center my-8">
          <img src={dragonImage} alt="" className="w-40 h-auto" />
        </div>

        <div className="flex flex-col gap-3">
          {benefits.map(b => (
            <div key={b.title} className="flex items-start gap-4 bg-[#F9F7FF] rounded-xl p-4">
              <div className="w-9 h-9 bg-[#EDE9FE] rounded-lg flex items-center justify-center flex-shrink-0">
                {b.icon}
              </div>
              <div>
                <p className="font-semibold text-[#1E2939] text-sm mb-0.5">{b.title}</p>
                <p className="text-[#6B7280] text-xs leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-1 pb-8 pt-3">
        <PrimaryButton onClick={() => navigate('/onboarding/name')}>
          Get Your Personalized Plan
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
