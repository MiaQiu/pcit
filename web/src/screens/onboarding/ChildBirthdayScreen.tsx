import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => currentYear - i);

export default function ChildBirthdayScreen() {
  const navigate = useNavigate();
  const { data, setChildBirthday } = useOnboarding();

  const [month, setMonth] = useState<number>(
    data.childBirthday ? data.childBirthday.getMonth() : -1
  );
  const [year, setYear] = useState<number>(
    data.childBirthday ? data.childBirthday.getFullYear() : -1
  );
  const childName = data.childName || 'your child';
  const isValid = month >= 0 && year > 0;

  const getChildAge = () => {
    const birthday = new Date(year, month, 1);
    const today = new Date();
    const age = today.getFullYear() - birthday.getFullYear();
    return today.getMonth() < birthday.getMonth() ? age - 1 : age;
  };
  const childAge = isValid ? getChildAge() : null;
  const showAgeWarning = childAge !== null && (childAge < 2 || childAge > 7);

  const handleContinue = () => {
    if (!isValid) return;
    const birthday = new Date(year, month, 1);
    setChildBirthday(birthday);
    // Synced to the backend later, in ChildIssueScreen — that's the last field collected in
    // this sequence, so everything (including issue) is available in one consolidated PATCH.
    navigate('/onboarding/child-issue');
  };

  return (
    <OnboardingLayout progress={42} backTo="/onboarding/child-gender">

      <div className="flex-1 flex flex-col px-4 pt-6 pb-2">
        <h1 className="text-[#1E2939] text-2xl font-bold mb-2 leading-tight text-center">
          When is {childName}'s birthday?
        </h1>
        <p className="text-[#6B7280] text-sm mb-8 text-center">
          This helps us tailor activities and milestones to the right age.
        </p>

        <div className="flex gap-4 mb-8">
          <div className="flex-1">
            <label className="block text-sm font-medium text-[#1E2939] mb-2">Month</label>
            <select
              value={month}
              onChange={e => setMonth(parseInt(e.target.value))}
              className="input-field bg-white cursor-pointer appearance-none"
            >
              <option value={-1} disabled>Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-[#1E2939] mb-2">Year</label>
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="input-field bg-white cursor-pointer appearance-none"
            >
              <option value={-1} disabled>Year</option>
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {showAgeWarning && (
          <div className="bg-[#F3E8FF] rounded-xl px-4 py-3 mb-6">
            <p className="text-[#4A5565] text-sm leading-relaxed">
              * Note on Age Suitability: Nora's method is clinically evidenced to be most effective for children between 2 and 7 years old. However, the foundational skills taught here, such as positive reinforcement and emotional regulation, can be adapted and beneficial for children of any age.
            </p>
          </div>
        )}

        <div className="mt-auto -mx-3">
          <PrimaryButton
            onClick={handleContinue}
            disabled={!isValid}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    </OnboardingLayout>
  );
}
