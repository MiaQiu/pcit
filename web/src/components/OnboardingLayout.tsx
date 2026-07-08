import React from 'react';
import ProgressHeader from './ProgressHeader';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  className?: string;
  progress?: number;
  onBack?: () => void;
  backTo?: string;
}

export default function OnboardingLayout({ children, className = '', progress, onBack, backTo }: OnboardingLayoutProps) {
  return (
    <div className="h-[100dvh] bg-white flex flex-col items-center justify-start overflow-hidden">
      <div className={`w-full max-w-[480px] h-full flex flex-col overflow-hidden ${className}`}>
        <div className="pt-3 pb-1 text-center">
          <span className="text-2xl font-bold tracking-[0.12em] text-[#1E2939] uppercase">Nora</span>
        </div>
        {progress !== undefined && (
          <ProgressHeader progress={progress} onBack={onBack} backTo={backTo} />
        )}
        {children}
      </div>
    </div>
  );
}
