import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import demo2Image from '../../assets/images/demo2.png';

const features = [
  { text: 'During playtime sessions' },
  { text: 'When setting boundaries' },
  { text: 'Through big emotional moments' },
];

export default function Demo2Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={10} backTo="/demo/1b">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          Nora listens to your day-to-day interactions
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Playtime, boundaries, big feelings — Nora listens to your real moments together and understands what's really happening.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={demo2Image} alt="" className="w-full max-w-xs h-auto" />
        </div>

        <div className="flex flex-col gap-2.5 mb-8">
          {features.map(item => (
            <div key={item.text} className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-4">
              <div className="w-2 h-2 rounded-full bg-[#8C49D5] flex-shrink-0" />
              <span className="text-[#1E2939] font-medium text-sm">{item.text}</span>
            </div>
          ))}
        </div>

      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/demo/2b')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
