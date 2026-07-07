import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import emotionalMassageImage from '../../assets/images/emotional-massage.png';

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
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4">
        <div className="mb-3 text-center">
          <span className="text-xs font-bold tracking-widest text-[#8C49D5] uppercase">Emotional Massage</span>
        </div>

        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          Emotional Massage
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 leading-relaxed text-center">
          A simple 5-minute daily play with your child. By following your child's lead and staying fully present, you support their ability to build positive behavior, develop social skills, and improve focus.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={emotionalMassageImage} alt="" className="w-full max-w-xs h-auto" />
        </div>

        {/* <div className="flex flex-col gap-3">
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
        </div> */}
      </div>

      <div className="px-1 pb-8 pt-3">
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
