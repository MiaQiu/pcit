import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';
import play3Image from '../../assets/images/play3.png';

export default function PlaySession3Screen() {
  const navigate = useNavigate();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <OnboardingLayout progress={94} backTo="/play/2">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Record Using Nora App
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          Set your phone nearby where it can clearly hear your conversation. You don't need to hold it — just focus on the play!
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <img src={play3Image} alt="" className="w-full max-w-xs h-auto" />
        </div>

        {/* <div className="bg-[#8C49D5] rounded-2xl p-5 mb-4 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm">Daily Emotional Massage</p>
              <p className="text-white/70 text-xs">Today's session</p>
            </div>
          </div>
          <p className="text-white/90 text-sm">
            Let <span className="font-bold">{childName}</span> lead today's 5-minute play
          </p>
          <p className="text-xs text-white/70 mt-2">Tap record in the Nora mobile app to begin</p>
        </div> */}

        {/* <div className="bg-[#F9F7FF] border border-[#EDE9FE] rounded-xl p-4 mb-8">
          <p className="text-[#6B7280] text-xs leading-relaxed">
            <span className="font-semibold text-[#1E2939]">Tip:</span> Place your phone face-down on a nearby surface. This reduces distractions and keeps the focus on your child.
          </p>
        </div> */}

      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/play/4')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
