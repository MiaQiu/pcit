import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';

const tags = [
  'Child Development',
  'Attachment Science',
  'Speech Therapy',
  'Social Learning Science',
  'Behavior Management',
  'Play Therapy',
  'Authoritative Parenting',
];

export default function Demo1Screen() {
  const navigate = useNavigate();

  return (
    <OnboardingLayout progress={3} backTo="/">
      {/* Illustration */}
      <div className="w-full h-60 bg-[#EDE9FE] flex items-center justify-center relative overflow-hidden">
        <svg width="260" height="200" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Adult figure */}
          <circle cx="100" cy="60" r="22" fill="#8C49D5" opacity="0.8"/>
          <path d="M68 140c0-17.67 14.33-32 32-32s32 14.33 32 32" fill="#8C49D5" opacity="0.8"/>
          {/* Child figure */}
          <circle cx="165" cy="72" r="16" fill="#C4B5FD"/>
          <path d="M141 140c0-13.25 10.75-24 24-24s24 10.75 24 24" fill="#C4B5FD"/>
          {/* Connection arc */}
          <path d="M122 80 Q132 60 148 72" stroke="#8C49D5" strokeWidth="2.5" strokeDasharray="5 4" fill="none" opacity="0.5"/>
          {/* Heart */}
          <path d="M132 52 C132 50 130 47 127 47 C124 47 122 50 122 52 C122 57 132 63 132 63 C132 63 142 57 142 52 C142 50 140 47 137 47 C134 47 132 50 132 52Z" fill="#8C49D5" opacity="0.3"/>
        </svg>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        <p className="text-[#8C49D5] text-xs font-bold uppercase tracking-widest mb-1">Parenting is hard</p>
        <h1 className="text-[#1E2939] text-2xl font-bold mb-4 leading-tight">
          But you don't have to do it alone.
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">
          Meet Nora — Your guide to raising confident, happy kids. Science-backed. Personalized for your child (ages 1–7)
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {tags.map(tag => (
            <span key={tag} className="bg-[#EDE9FE] text-[#8C49D5] text-xs rounded-full px-3 py-1 font-medium">{tag}</span>
          ))}
        </div>

      </div>
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/demo/1b')}>
            Continue
          </PrimaryButton>
        </div>
    </OnboardingLayout>
  );
}
