import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const languages = [
  'English', '中文', 'Español', 'Français', 'العربية',
  'हिंदी', 'Português', '日本語', '한국어', 'Bahasa',
  'Türkçe', 'Italiano', 'Deutsch', 'ภาษาไทย', 'Русский',
  'Polski', 'Nederlands', 'Việt', 'Svenska', '+70 more',
];

export default function Demo5Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={23} backTo="/demo/4">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#8C49D5] flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 text-center">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" opacity="0.8"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="white" strokeWidth="1.5" opacity="0.8"/>
          </svg>
          <p className="text-white font-bold text-lg">90+ Languages</p>
          <p className="text-white/70 text-sm">Coaching in your native tongue</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight">
          Empowering every caregiver, in 90+ languages.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Nora speaks your language — literally. Get coaching in your native language so nothing gets lost in translation.
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {languages.map(lang => (
            <span
              key={lang}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                lang === '+70 more'
                  ? 'bg-[#8C49D5] text-white border-[#8C49D5]'
                  : 'bg-[#EDE9FE] text-[#8C49D5] border-[#EDE9FE]'
              }`}
            >
              {lang}
            </span>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/onboarding/parenting-intro')}>
            Start My Journey
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
