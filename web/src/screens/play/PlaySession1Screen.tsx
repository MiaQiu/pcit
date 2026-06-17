import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const toyCategories = [
  {
    label: 'BUILD & CREATE',
    desc: 'Blocks, LEGOs, magnetic tiles',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="22.08" x2="12" y2="12" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'IMAGINE & PRETEND',
    desc: 'Dolls, action figures, play kitchen',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'DRAW & EXPLORE',
    desc: 'Crayons, paint, clay, kinetic sand',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'SOLVE & PUZZLE',
    desc: 'Puzzles, sorting toys, stacking rings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function PlaySession1Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={87} backTo="/onboarding/intro3">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#EDE9FE] flex items-center justify-center relative overflow-hidden">
        <svg width="180" height="160" viewBox="0 0 180 160" fill="none">
          {/* Toy shelf abstract */}
          <rect x="20" y="100" width="140" height="8" rx="4" fill="#C4B5FD"/>
          <rect x="30" y="70" width="34" height="32" rx="6" fill="#8C49D5" opacity="0.5"/>
          <rect x="73" y="60" width="34" height="42" rx="6" fill="#8C49D5" opacity="0.7"/>
          <rect x="116" y="75" width="34" height="27" rx="6" fill="#8C49D5" opacity="0.4"/>

        </svg>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Prepare the Right Toys
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          To let your child's imagination run wild, pick unstructured toys. These allow them to be the boss of the play.
        </p>

        <div className="grid grid-cols-2 gap-2.5 mb-8">
          {toyCategories.map(cat => (
            <div key={cat.label} className="bg-[#F9F7FF] border border-[#EDE9FE] rounded-xl p-4">
              <div className="mb-2">{cat.icon}</div>
              <p className="text-[#8C49D5] font-bold text-xs mb-1">{cat.label}</p>
              <p className="text-[#6B7280] text-xs leading-relaxed">{cat.desc}</p>
            </div>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/play/2')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
