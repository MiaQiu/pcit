import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import demo1Image from '../../assets/images/demo1.png';

export default function Demo1Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={3} backTo="/">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <p className="text-[#8C49D5] text-xs font-bold uppercase tracking-widest mb-1 text-center">Parenting is hard</p>
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          But you don't have to do it alone.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Meet Nora — Your guide to raising confident, happy kids. Science-backed. Personalized for your child (ages 1–7)
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={demo1Image} alt="" className="w-full max-w-xs h-auto" />
        </div>
      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/demo/1b')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
