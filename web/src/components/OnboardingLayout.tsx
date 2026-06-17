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
    <div className="h-screen bg-[#EDE9FE] flex flex-col items-center justify-start overflow-hidden">
      <div className={`w-full max-w-[480px] h-full bg-white flex flex-col overflow-hidden ${className}`}>
        <div className="pt-5 pb-1 text-center">
          <span className="text-3xl font-bold tracking-[0.12em] text-[#8C49D5] uppercase">Nora</span>
        </div>
        {progress !== undefined && (
          <ProgressHeader progress={progress} onBack={onBack} backTo={backTo} />
        )}
        {children}
      </div>
    </div>
  );
}
