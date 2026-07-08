import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

export default function Demo2BScreen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={13} backTo="/demo/2">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight text-center">
          Nora helps you understand your parenting patterns.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed text-center">
          We analyze your interactions to identify what's working and where small shifts can make a big difference.
        </p>

        {/* Illustration */}
        <div className="w-full flex items-center justify-center my-8">
          <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-sm">
            <p className="text-xs font-semibold text-[#6B7280] mb-3 uppercase tracking-wide">Your Parenting Style</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-bold text-green-700 mb-2">PEN Skills</p>
                {['Praise', 'Echo', 'Narrate'].map(s => (
                  <div key={s} className="flex items-center gap-1.5 mb-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                        <path d="M1 3L2.5 4.5L6 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-xs text-green-700">{s}</span>
                  </div>
                ))}
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-700 mb-2">Avoid</p>
                {['Questions', 'Commands', 'Criticism'].map(s => (
                  <div key={s} className="flex items-center gap-1.5 mb-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
                      <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                        <path d="M1 1l4 4M5 1L1 5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="text-xs text-red-700">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-bold text-green-700 mb-3">Your PEN Skills</p>
            {['Praise', 'Echo', 'Narrate'].map(s => (
              <div key={s} className="flex items-center gap-2 mb-2">
                <div className="w-4.5 h-4.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-xs text-green-800 font-medium">{s}</span>
              </div>
            ))}
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-3">Areas to Avoid</p>
            {['Questions', 'Commands', 'Criticism'].map(s => (
              <div key={s} className="flex items-center gap-2 mb-2">
                <div className="w-4.5 h-4.5 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-xs text-red-800 font-medium">{s}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton onClick={() => navigate('/demo/3')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
