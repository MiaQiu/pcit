import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

export default function PlaySession2Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={90} backTo="/play/1">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#8C49D5] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-4 right-8 w-16 h-16 bg-white/10 rounded-full" />
        <div className="absolute bottom-4 left-6 w-10 h-10 bg-white/10 rounded-full" />
        <div className="relative z-10 text-center">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="mx-auto mb-3">
            {/* Crown */}
            <path d="M10 42 L10 22 L20 32 L30 12 L40 32 L50 22 L50 42 Z" fill="white" opacity="0.9"/>
            <rect x="10" y="42" width="40" height="6" rx="3" fill="white" opacity="0.7"/>
          </svg>
          <p className="text-white font-bold text-base">Your child is the boss!</p>
          <p className="text-white/70 text-sm">You're their #1 fan</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Let Your Child Lead
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          For the next 5 minutes, your goal is to be your child's biggest fan, not their teacher. Describe what they're doing, repeat their words.
        </p>

        <div className="flex flex-col gap-3 mb-8">
          <div className="bg-[#EDE9FE] rounded-xl p-4">
            <p className="text-[#8C49D5] font-bold text-sm mb-1">Say:</p>
            <p className="text-[#1E2939] text-sm italic">"You're stacking the blocks so high!"</p>
          </div>
          <div className="bg-[#EDE9FE] rounded-xl p-4">
            <p className="text-[#8C49D5] font-bold text-sm mb-1">Say:</p>
            <p className="text-[#1E2939] text-sm italic">"You said 'vroooom' — that car is going fast!"</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-red-600 font-bold text-sm mb-1">Avoid:</p>
            <p className="text-[#6B7280] text-sm italic">"Why did you do that?" or "Don't do it like that"</p>
          </div>
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/play/3')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
