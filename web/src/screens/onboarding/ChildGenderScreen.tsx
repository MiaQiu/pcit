import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import MultipleChoice from '../../components/MultipleChoice';
import { useOnboarding } from '../../contexts/OnboardingContext';

const options = [
  { value: 'Boy', label: 'Boy' },
  { value: 'Girl', label: 'Girl' },
  { value: 'Prefer not to share', label: 'Prefer not to share' },
];

export default function ChildGenderScreen() {
  const navigate = useNavigate();
  const { data, setChildGender } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <OnboardingLayout progress={39} backTo="/onboarding/child-name">

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          What is {childName}'s gender?
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 text-center">
          Used only to personalize guidance.
        </p>

        <MultipleChoice
          options={options}
          selected={data.childGender}
          onChange={val => setChildGender(val as string)}
        />
      </div>

      <div className="px-1 pb-8 pt-3">
        <PrimaryButton
          onClick={() => navigate('/onboarding/child-birthday')}
          disabled={!data.childGender}
        >
          Continue
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
