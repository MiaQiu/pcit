import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const growthAreas = [
  {
    area: 'Emotional Regulation',
    desc: 'Managing feelings and reactions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    area: 'Social Skills',
    desc: 'Connecting and playing with others',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="#8C49D5" strokeWidth="2"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    area: 'Focus & Attention',
    desc: 'Staying on task and concentrating',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8C49D5" strokeWidth="2"/>
        <circle cx="12" cy="12" r="6" stroke="#8C49D5" strokeWidth="2"/>
        <circle cx="12" cy="12" r="2" fill="#8C49D5"/>
      </svg>
    ),
  },
  {
    area: 'Language Development',
    desc: 'Expressing thoughts and ideas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function Demo4Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={19} backTo="/demo/3">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          Help your child thrive.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Build on their strengths and support their emotional and social growth.
        </p>

        {/* Illustration — skill metrics */}
        <div className="w-full flex items-center justify-center my-8">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-sm overflow-hidden">
            <div className="bg-[#8C49D5] px-4 py-3">
              <span className="text-white text-sm font-semibold">Growth & Learning</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Social Skills', value: 78 },
                  { label: 'Emotional Reg.', value: 65 },
                  { label: 'Focus', value: 82 },
                  { label: 'Language', value: 71 },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-[#6B7280] mb-1">{item.label}</p>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
                      <div className="h-full bg-[#8C49D5] rounded-full" style={{ width: `${item.value}%` }} />
                    </div>
                    <p className="text-xs font-bold text-[#1E2939] mt-1">{item.value}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 mb-8">
          {growthAreas.map(item => (
            <div key={item.area} className="flex items-center gap-4 border border-gray-200 rounded-xl p-4">
              <div className="w-9 h-9 bg-[#EDE9FE] rounded-lg flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[#1E2939] text-sm">{item.area}</p>
                <p className="text-[#6B7280] text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/demo/5')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
