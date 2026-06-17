import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const privacyItems = [
  {
    title: 'End-to-end encryption',
    desc: 'All recordings and data are encrypted at rest and in transit',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#8C49D5" strokeWidth="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Never sold to third parties',
    desc: "Your family's data belongs to you, not advertisers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Delete anytime',
    desc: 'You can delete your data and account at any time',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polyline points="3 6 5 6 21 6" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#8C49D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'GDPR & COPPA compliant',
    desc: 'We meet global standards for privacy protection',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8C49D5" strokeWidth="2"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#8C49D5" strokeWidth="2"/>
      </svg>
    ),
  },
];

export default function PlaySession5Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={100} backTo="/play/4">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#EDE9FE] flex items-center justify-center relative overflow-hidden">
        <div className="text-center z-10">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#8C49D5" strokeWidth="1.5"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#8C49D5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="16" r="1.5" fill="#8C49D5"/>
          </svg>
          <div className="bg-white rounded-xl px-6 py-3 shadow-sm">
            <p className="text-[#1E2939] font-bold text-sm">Your data is safe</p>
            <p className="text-[#6B7280] text-xs">End-to-end protected</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Your data stays private
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Your data is always protected and never shared without your permission.
        </p>

        <div className="flex flex-col gap-2.5 mb-8">
          {privacyItems.map(item => (
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
        <PrimaryButton onClick={() => navigate('/create-account')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
