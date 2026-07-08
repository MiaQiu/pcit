import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';

export default function ChildNameScreen() {
  const navigate = useNavigate();
  const { data, setChildName } = useOnboarding();
  const [nameVal, setNameVal] = useState(data.childName);

  return (
    <OnboardingLayout progress={35} backTo="/onboarding/relationship">

      <div className="flex-1 flex flex-col px-4 pt-6 pb-2">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 text-center">
          What's your child's name?
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 text-center">
          We'll use this to make coaching feel more personal.
        </p>

        <div className="mb-8">
          <label className="block text-sm font-medium text-[#1E2939] mb-2">Child's Name</label>
          <input
            type="text"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            placeholder="Enter child's name"
            className="input-field"
            autoFocus
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter' && nameVal.trim()) {
                setChildName(nameVal.trim());
                navigate('/onboarding/child-gender');
              }
            }}
          />
        </div>

        <div className="mt-auto -mx-3">
          <PrimaryButton
            onClick={() => {
              if (nameVal.trim()) {
                setChildName(nameVal.trim());
                navigate('/onboarding/child-gender');
              }
            }}
            disabled={!nameVal.trim()}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    </OnboardingLayout>
  );
}
