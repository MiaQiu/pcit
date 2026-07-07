import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';

export default function NameInputScreen() {
  const navigate = useNavigate();
  const { data, setName } = useOnboarding();
  const [nameVal, setNameVal] = useState(data.name);

  return (
    <OnboardingLayout progress={29} backTo="/create-account">

      <div className="flex-1 flex flex-col px-4 pt-6 pb-8">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 text-center">
          What's your name?
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 text-center">
          We'll use this to personalize your experience with Nora.
        </p>

        <div className="mb-8">
          <label className="block text-sm font-medium text-[#1E2939] mb-2">Your Name</label>
          <input
            type="text"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            placeholder="Enter your name"
            className="input-field"
            autoFocus
            autoComplete="given-name"
            onKeyDown={e => {
              if (e.key === 'Enter' && nameVal.trim()) {
                setName(nameVal.trim());
                navigate('/onboarding/relationship');
              }
            }}
          />
        </div>

        <div className="mt-auto -mx-3">
          <PrimaryButton
            onClick={() => {
              if (nameVal.trim()) {
                setName(nameVal.trim());
                navigate('/onboarding/relationship');
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
