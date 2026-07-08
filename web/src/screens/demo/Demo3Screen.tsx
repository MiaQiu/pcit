import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const highlights = [
  {
    title: 'Real moment analysis',
    desc: 'AI listens and finds patterns in your play sessions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="#8C49D5" strokeWidth="2"/>
        <path d="m21 21-4.35-4.35" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Actionable suggestions',
    desc: 'Specific phrases and techniques tailored to your child',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="2" x2="12" y2="6" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
        <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-7-8-4 2-7 4-7 8a7 7 0 0 0 7 7z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Track your progress',
    desc: 'See how your parenting skills grow over time',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="17 6 23 6 23 12" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function Demo3Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={16} backTo="/demo/2b">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Nora Coaching Corner
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Personalized coaching based on your real moments, grounded in child development science.
        </p>

        {/* Illustration — coaching insight card */}
        <div className="w-full flex items-center justify-center my-8">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-sm overflow-hidden">
            <div className="bg-[#8C49D5] px-4 py-3 flex items-center gap-2">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <span className="text-[#8C49D5] text-xs font-bold">N</span>
              </div>
              <span className="text-white text-sm font-semibold">Nora Coaching Corner</span>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-[#8C49D5] mb-1">Today's Insight</p>
              <p className="text-sm font-semibold text-[#1E2939] mb-2">Great job narrating during block play!</p>
              <p className="text-xs text-[#6B7280] mb-3">You used 4 behavior descriptions, which helps your child feel seen and builds vocabulary.</p>
              <div className="bg-[#F9F7FF] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#1E2939] mb-1">Try this next time:</p>
                <p className="text-xs text-[#6B7280]">"You're building so carefully — one block at a time!"</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 mb-8">
          {highlights.map(item => (
            <div key={item.title} className="flex gap-4 border border-gray-200 rounded-xl p-4">
              <div className="w-9 h-9 bg-[#EDE9FE] rounded-lg flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[#1E2939] text-sm mb-0.5">{item.title}</p>
                <p className="text-[#6B7280] text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/demo/4')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
