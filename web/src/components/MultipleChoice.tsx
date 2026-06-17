import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface MultipleChoiceProps {
  options: Option[];
  selected: string | string[] | null;
  multi?: boolean;
  onChange: (value: string | string[]) => void;
}

export default function MultipleChoice({ options, selected, multi = false, onChange }: MultipleChoiceProps) {
  const isSelected = (value: string): boolean => {
    if (multi) return Array.isArray(selected) && selected.includes(value);
    return selected === value;
  };

  const handleSelect = (value: string) => {
    if (multi) {
      const current = Array.isArray(selected) ? selected : [];
      onChange(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
    } else {
      onChange(value);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {options.map(option => {
        const sel = isSelected(option.value);
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-base transition-all duration-150
              ${sel
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
