import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';
import dragonWavingImage from '../../assets/images/dragon-waving.png';

const items = [
  {
    title: '9 quick questions',
    desc: 'About recent behavior',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 11l3 3L22 4" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Takes about 2 minutes',
    desc: 'Simple scale-based answers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8C49D5" strokeWidth="2"/>
        <polyline points="12 6 12 12 16 14" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Get your personalized plan',
    desc: "Tailored to your child's unique needs",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function ChildSnapshotIntroScreen() {
  const navigate = useNavigate();
  const { data } = useOnboarding();
  const name = data.name || 'there';
  const childName = data.childName || 'your child';

  return (
    <OnboardingLayout progress={48} backTo="/onboarding/child-issue">

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
 

        <h1 className="text-[#1E2939] text-2xl font-bold mb-3 leading-tight text-center">
          Let's understand {childName} better.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          A few quick questions to understand {childName}'s recent behavior and tailor your support.
        </p>

        {/* Dragon + speech bubble
        <div className="flex items-center gap-3 my-8">
          <img src={dragonWavingImage} alt="" className="w-16 h-16 flex-shrink-0" />
          <div className="relative bg-white rounded-xl px-4 py-3 flex-1">
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rotate-45" />
            <p className="text-[#8C49D5] font-semibold text-sm relative">
              Hi {name}, you're in the right place.
            </p>
          </div>
        </div> */}
        <div className="flex flex-col gap-3 items-center">
          {items.map(item => (
            <div key={item.title} className="w-4/5 flex flex-col items-center text-center gap-2 border border-gray-200 rounded-xl p-4">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[#1E2939] text-sm">{item.title}</p>
                <p className="text-[#6B7280] text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-1 pb-8 pt-3">
        <PrimaryButton onClick={() => navigate('/onboarding/wacb/1')}>
          Start
        </PrimaryButton>
        <button
          onClick={() => navigate('/onboarding/behavior-profile?locked=true')}
          className="w-full mt-3 h-12 text-[#6B7280] font-medium text-sm hover:text-[#1E2939] transition-colors"
        >
          Skip for Now
        </button>
      </div>
    </OnboardingLayout>
  );
}
