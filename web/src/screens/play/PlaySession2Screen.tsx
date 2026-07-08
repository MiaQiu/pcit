import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import play2Image from '../../assets/images/play2.png';

export default function PlaySession2Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={90} backTo="/play/1">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Let Your Child Lead
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          For the next 5 minutes, your goal is to be your child's biggest fan, not their teacher. Describe what they're doing, repeat their words.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={play2Image} alt="" className="w-full max-w-xs h-auto" />
        </div>

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
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/play/3')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
