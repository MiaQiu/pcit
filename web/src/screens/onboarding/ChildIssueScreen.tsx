import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import MultipleChoice from '../../components/MultipleChoice';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { completeOnboarding } from '../../api';

const issueOptions = [
  { value: 'Behavior Challenges (Tantrums, Arguing)', label: 'Behavior Challenges (Tantrums, Arguing)' },
  { value: 'Handling big emotions', label: 'Handling big emotions' },
  { value: 'Low frustration tolerance', label: 'Low frustration tolerance' },
  { value: 'New Baby in the Home', label: 'New Baby in the Home' },
  { value: 'Moving House & School Changes', label: 'Moving House & School Changes' },
  { value: 'Navigating Parental Divorces', label: 'Navigating Parental Divorces' },
  { value: 'Building Social-Emotional Skills', label: 'Building Social-Emotional Skills' },
  { value: 'Attention and Focus Issues', label: 'Attention and Focus Issues' },
  { value: 'ADHD / Attention & Hyperactivity', label: 'ADHD / Attention & Hyperactivity' },
  { value: 'Learning More Effective Parenting Strategies', label: 'Learning More Effective Parenting Strategies' },
  { value: 'Others', label: 'Others' },
];

export default function ChildIssueScreen() {
  const navigate = useNavigate();
  const { data, setIssue, setIssueOther } = useOnboarding();
  const [otherText, setOtherText] = useState(data.issueOther);
  const [loading, setLoading] = useState(false);
  const showOther = data.issue.includes('Others');

  const handleChange = (vals: string | string[]) => {
    const arr = Array.isArray(vals) ? vals : [vals];
    setIssue(arr);
  };

  const handleContinue = async () => {
    if (showOther) setIssueOther(otherText);

    // Consolidated sync point: by now every field NameInputScreen..ChildIssueScreen collects is
    // available, so this is the one place we PATCH them all to the backend (only relevant if
    // signup already happened — i.e. accessToken exists, which is always true in the current
    // Landing -> Create Account -> Onboarding flow order). Mobile app login relies on these
    // fields being populated to decide whether to skip its own onboarding.
    if (data.accessToken && data.name && data.relationshipToChild && data.childName && data.childGender && data.childBirthday) {
      setLoading(true);
      try {
        await completeOnboarding({
          name: data.name,
          relationshipToChild: data.relationshipToChild,
          childName: data.childName,
          childGender: data.childGender,
          childBirthday: data.childBirthday.toISOString(),
          issue: data.issue,
        }, data.accessToken);
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    }

    navigate('/onboarding/snapshot-intro');
  };

  return (
    <OnboardingLayout progress={45} backTo="/onboarding/child-birthday">

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          What would feel most helpful to you as a parent?
        </h1>
        <p className="text-[#6B7280] text-sm mb-6 text-center">
          Pick the ones that resonate most.
        </p>

        <MultipleChoice
          options={issueOptions}
          selected={data.issue}
          multi={true}
          onChange={handleChange}
        />

        {showOther && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#1E2939] mb-2">
              Please describe:
            </label>
            <textarea
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              placeholder="Tell us more about your situation..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[#1E2939] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#8C49D5] focus:border-transparent
                         placeholder:text-gray-400 resize-none"
            />
          </div>
        )}
      </div>

      {/* Fixed button footer */}
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton
          onClick={handleContinue}
          disabled={data.issue.length === 0}
          loading={loading}
        >
          Continue
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
