import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';

export default function PlaySession3Screen() {
  const navigate = useNavigate();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <OnboardingLayout progress={94} backTo="/play/2">
      {/* Illustration */}
      <div className="w-full h-52 bg-[#EDE9FE] flex items-center justify-center relative overflow-hidden">
        <div className="bg-white rounded-2xl p-4 shadow-sm w-56 relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#8C49D5] rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1E2939]">Nora App</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <p className="text-xs text-green-500">Recording...</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1 items-center mb-2">
            {[3, 5, 7, 4, 6, 5, 3, 7, 4].map((h, i) => (
              <div key={i} className="w-1.5 bg-[#8C49D5] rounded-full animate-pulse" style={{ height: `${h * 3}px` }} />
            ))}
          </div>
          <p className="text-xs text-gray-400">5:00 remaining</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Record Using Nora App
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Set your phone nearby where it can clearly hear your conversation. You don't need to hold it — just focus on the play!
        </p>

        <div className="bg-[#8C49D5] rounded-2xl p-5 mb-4 text-white">
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
        </div>

        <div className="bg-[#F9F7FF] border border-[#EDE9FE] rounded-xl p-4 mb-8">
          <p className="text-[#6B7280] text-xs leading-relaxed">
            <span className="font-semibold text-[#1E2939]">Tip:</span> Place your phone face-down on a nearby surface. This reduces distractions and keeps the focus on your child.
          </p>
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/play/4')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
