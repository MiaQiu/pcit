import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { completeOnboarding } from '../../api';

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
  const [loading, setLoading] = useState(false);

  const childName = data.childName || 'your child';
  const isValid = month >= 0 && year > 0;

  const handleContinue = async () => {
    if (!isValid) return;
    const birthday = new Date(year, month, 1);
    setChildBirthday(birthday);

    if (data.accessToken && data.name && data.relationshipToChild && data.childName && data.childGender) {
      setLoading(true);
      try {
        await completeOnboarding({
          name: data.name,
          relationshipToChild: data.relationshipToChild,
          childName: data.childName,
          childGender: data.childGender,
          childBirthday: birthday.toISOString(),
          issue: data.issue,
        }, data.accessToken);
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    }

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

        {/* {isValid && (
          <div className="bg-[#F9F7FF] rounded-xl p-4 mb-6">
            <p className="text-[#6B7280] text-sm">
              Birthday:{' '}
              <span className="font-semibold text-[#1E2939]">
                {MONTHS[month]} {year}
              </span>
            </p>
          </div>
        )} */}

        <div className="mt-auto -mx-3">
          <PrimaryButton
            onClick={handleContinue}
            disabled={!isValid}
            loading={loading}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    </OnboardingLayout>
  );
}
