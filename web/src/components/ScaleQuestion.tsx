import React from 'react';

const SCALE_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Very Often' },
];

interface ScaleQuestionProps {
  value: number | undefined;
  onChange: (value: number) => void;
}

export default function ScaleQuestion({ value, onChange }: ScaleQuestionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {SCALE_OPTIONS.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-base transition-all duration-150
              ${selected
                ? 'border-[#8C49D5] bg-[#F5F3FF] text-[#1E2939]'
                : 'border-gray-200 bg-white text-[#1E2939] hover:border-gray-300'
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
