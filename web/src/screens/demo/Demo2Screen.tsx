import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const features = [
  { text: 'During playtime sessions' },
  { text: 'When setting boundaries' },
  { text: 'Through big emotional moments' },
];

export default function Demo2Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={10} backTo="/demo/1b">
      {/* Illustration — audio recording UI */}
      <div className="w-full h-60 bg-[#EDE9FE] flex items-center justify-center relative overflow-hidden">
        <div className="bg-white rounded-2xl p-5 shadow-sm w-60">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#8C49D5] rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <span className="text-sm font-semibold text-[#1E2939]">Nora is listening...</span>
          </div>
          <div className="flex gap-1 items-end h-10">
            {[3, 5, 4, 7, 3, 6, 4, 7, 3].map((h, i) => (
              <div key={i} className="flex-1 bg-[#8C49D5] rounded-full animate-pulse" style={{ height: `${h * 4}px` }} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Playtime session in progress</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight">
          Nora listens to your day-to-day interactions
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Playtime, boundaries, big feelings — Nora listens to your real moments together and understands what's really happening.
        </p>

        <div className="flex flex-col gap-2.5 mb-8">
          {features.map(item => (
            <div key={item.text} className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-4">
              <div className="w-2 h-2 rounded-full bg-[#8C49D5] flex-shrink-0" />
              <span className="text-[#1E2939] font-medium text-sm">{item.text}</span>
            </div>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/demo/2b')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
