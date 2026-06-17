import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const features = [
  {
    title: 'AI-powered analysis',
    desc: 'Advanced language models analyze every interaction',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="#8C49D5" strokeWidth="2"/>
        <line x1="8" y1="21" x2="16" y2="21" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="17" x2="12" y2="21" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Detailed skill breakdown',
    desc: 'See exactly how many times you used each technique',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="20" x2="12" y2="4" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
        <line x1="6" y1="20" x2="6" y2="14" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Personalized coaching',
    desc: 'Get specific phrases to try next session',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Track your growth',
    desc: 'Watch your skills improve session by session',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="17 6 23 6 23 12" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function PlaySession4Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={97} backTo="/play/3">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#EDE9FE] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="flex gap-3 z-10">
          <div className="bg-white rounded-2xl p-3 shadow-sm w-32">
            <p className="text-xs font-bold text-[#8C49D5] mb-2">PEN Skills</p>
            <div className="flex flex-col gap-1.5">
              {[['Praise', 3], ['Echo', 5], ['Narrate', 4]].map(([k, v]) => (
                <div key={k as string} className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 w-12">{k}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full bg-[#8C49D5] rounded-full" style={{ width: `${(v as number) * 20}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm w-28">
            <p className="text-xs font-bold text-green-600 mb-2">Today's Wins</p>
            {['Great narrating!', 'Active listening', 'Child led 85%'].map(w => (
              <div key={w} className="flex items-center gap-1.5 mb-1.5">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-xs text-gray-600">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Short Play, Big Insights
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          The recording stops automatically after 5 minutes. Our AI analyzes the interaction and generates a personalized report.
        </p>

        <div className="flex flex-col gap-2.5 mb-8">
          {features.map(item => (
            <div key={item.title} className="flex gap-4 items-start border border-gray-200 rounded-xl p-4">
              <div className="w-9 h-9 bg-[#EDE9FE] rounded-lg flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[#1E2939] text-sm">{item.title}</p>
                <p className="text-[#6B7280] text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/play/5')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
