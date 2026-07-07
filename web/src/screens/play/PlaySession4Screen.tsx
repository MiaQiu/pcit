import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import play4Image from '../../assets/images/play4.jpg';

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
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Short Play, Big Insights
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          The recording stops automatically after 5 minutes. Our AI analyzes the interaction and generates a personalized report.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={play4Image} alt="" className="w-full h-auto" />
        </div>

        {/* <div className="flex flex-col gap-2.5 mb-8">
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
        </div> */}

      </div>
      <div className="px-1 pb-8 pt-3">
        <PrimaryButton onClick={() => navigate('/play/5')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
