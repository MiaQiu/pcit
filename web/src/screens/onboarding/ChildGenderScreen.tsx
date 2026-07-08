import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import MultipleChoice from '../../components/MultipleChoice';
import { useOnboarding } from '../../contexts/OnboardingContext';

// Values must match the server's childGender enum (server/routes/auth.cjs) exactly —
// it 400s the whole complete-onboarding request (including every other bundled field)
// on any mismatch, so this can't drift from ['BOY', 'GIRL', 'OTHER'].
const options = [
  { value: 'BOY', label: 'Boy' },
  { value: 'GIRL', label: 'Girl' },
  { value: 'OTHER', label: 'Prefer not to share' },
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

      <div className="px-1 pb-2 pt-3">
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
