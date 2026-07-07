import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';
import signupImage from '../assets/images/signup.jpg';

export default function LandingScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
        {/* Hero illustration */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden mb-8">
          <img src={signupImage} alt="" className="w-full h-full object-cover" />
        </div>

        <h2 className="text-[#1E2939] text-2xl font-bold text-center mb-3 leading-tight">
          Raise confident, happy kids — with just 5 minutes a day
        </h2>
        <p className="text-[#6B7280] text-sm text-center mb-8 leading-relaxed">
          Science-backed parenting coaching, personalized for your child
        </p>

        <div className="mt-auto">
          <PrimaryButton onClick={() => navigate('/create-account')}>
            Get Started
          </PrimaryButton>
        </div>
      </div>
    </OnboardingLayout>
  );
}
