import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import demo5Image from '../../assets/images/demo5.png';

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
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          Empowering every caregiver, in 90+ languages.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Nora speaks your language — literally. Get coaching in your native language so nothing gets lost in translation.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={demo5Image} alt="" className="w-full max-w-xs h-auto" />
        </div>

        <div className="flex flex-wrap gap-2 mb-8 justify-center">
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
      <div className="px-1 pb-8 pt-3">
        <PrimaryButton onClick={() => navigate('/onboarding/name')}>
            Start My Journey
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
