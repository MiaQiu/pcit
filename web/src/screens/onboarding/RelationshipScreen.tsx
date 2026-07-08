import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import MultipleChoice from '../../components/MultipleChoice';
import { useOnboarding } from '../../contexts/OnboardingContext';

// Values must match the server's relationshipToChild enum (server/routes/auth.cjs) exactly —
// it 400s the whole complete-onboarding request (including every other bundled field) on
// any mismatch, so this can't drift from ['MOTHER','FATHER','GRANDMOTHER','GRANDFATHER','GUARDIAN','OTHER'].
const options = [
  { value: 'MOTHER', label: 'Mother' },
  { value: 'FATHER', label: 'Father' },
  { value: 'GRANDMOTHER', label: 'Grandmother' },
  { value: 'GRANDFATHER', label: 'Grandfather' },
  { value: 'OTHER', label: 'Other' },
];

export default function RelationshipScreen() {
  const navigate = useNavigate();
  const { data, setRelationshipToChild } = useOnboarding();

  return (
    <OnboardingLayout progress={32} backTo="/onboarding/name">

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          Hi {data.name || 'there'}, what is your relationship to the child?
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 text-center">
          This helps us tailor guidance to your role.
        </p>

        <MultipleChoice
          options={options}
          selected={data.relationshipToChild}
          onChange={val => setRelationshipToChild(val as string)}
        />
      </div>

      <div className="px-1 pb-2 pt-3">
        <PrimaryButton
          onClick={() => navigate('/onboarding/child-name')}
          disabled={!data.relationshipToChild}
        >
          Continue
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
