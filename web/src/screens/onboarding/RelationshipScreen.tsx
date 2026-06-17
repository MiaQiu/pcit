import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import MultipleChoice from '../../components/MultipleChoice';
import { useOnboarding } from '../../contexts/OnboardingContext';

const options = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Grandmother', label: 'Grandmother' },
  { value: 'Grandfather', label: 'Grandfather' },
  { value: 'Other', label: 'Other' },
];

export default function RelationshipScreen() {
  const navigate = useNavigate();
  const { data, setRelationshipToChild } = useOnboarding();

  return (
    <OnboardingLayout progress={32} backTo="/onboarding/name">

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight">
          Hi {data.name || 'there'}, what is your relationship to the child?
        </h1>
        <p className="text-[#6B7280] text-sm mb-6">
          This helps us tailor guidance to your role.
        </p>

        <MultipleChoice
          options={options}
          selected={data.relationshipToChild}
          onChange={val => setRelationshipToChild(val as string)}
        />
      </div>

      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
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
