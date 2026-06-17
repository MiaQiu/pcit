import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ProgressHeaderProps {
  progress: number; // 0–100
  onBack?: () => void;
  backTo?: string;
}

export default function ProgressHeader({ progress, onBack, backTo }: ProgressHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={handleBack}
        className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
        aria-label="Go back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 19L8 12L15 5" stroke="#1E2939" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className="flex-1 h-2 bg-[#EDE9FE] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#8C49D5] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
