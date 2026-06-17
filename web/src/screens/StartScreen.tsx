import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../components/OnboardingLayout';
import PrimaryButton from '../components/PrimaryButton';

export default function StartScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      {/* Top decoration */}
      <div className="w-full h-48 bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-md">
          <span className="text-4xl font-extrabold text-[#8C49D5]">N</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
        <h1 className="text-[#1E2939] text-3xl font-bold text-center mb-3">
          Welcome to Nora
        </h1>
        <p className="text-[#6B7280] text-base text-center mb-10">
          Your personalized parenting coach, powered by science
        </p>

        <div className="flex flex-col gap-4 mt-auto">
          <PrimaryButton onClick={() => navigate('/create-account')}>
            Create Account
          </PrimaryButton>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-14 border-2 border-[#8C49D5] text-[#8C49D5] rounded-full font-semibold text-lg
                       flex items-center justify-center transition-all duration-200 hover:bg-[#F5F3FF]"
          >
            Log In
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          By continuing, you agree to our{' '}
          <a href="#" className="text-[#8C49D5] underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-[#8C49D5] underline">Privacy Policy</a>
        </p>
      </div>
    </OnboardingLayout>
  );
}
