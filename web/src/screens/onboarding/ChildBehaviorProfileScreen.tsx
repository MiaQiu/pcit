import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import { useOnboarding, computeWacbScore, getBehaviorCategory, getBehaviorProfile } from '../../contexts/OnboardingContext';

const sectionIcons = {
  means: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  plan: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  expect: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default function ChildBehaviorProfileScreen() {
  const navigate = useNavigate();
  const { data } = useOnboarding();
  const childName = data.childName || 'Your child';

  const score = computeWacbScore(data.wacb);
  const category = getBehaviorCategory(score);
  const profile = getBehaviorProfile(category);

  const sections = [
    { key: 'means', label: 'What this means', content: profile.whatItMeans, icon: sectionIcons.means },
    { key: 'plan', label: 'Your Starting Plan', content: profile.startingPlan, icon: sectionIcons.plan },
    { key: 'expect', label: 'What to expect', content: profile.whatToExpect, icon: sectionIcons.expect },
  ];

  return (
    <OnboardingLayout progress={81} backTo="/onboarding/wacb/9">

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
        <h1 className="text-[#1E2939] text-xl font-bold leading-tight mb-1">
          {childName}'s Behavior Profile
        </h1>
        <p className="text-[#6B7280] text-sm mb-6">
          Based on your responses over the past two weeks
        </p>

        <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: profile.bgColor }}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-base" style={{ color: profile.color }}>
                {profile.label}
              </span>
              <span className="text-xs font-medium" style={{ color: profile.color }}>
                Score: {score}
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min((score / 63) * 100, 100)}%`, backgroundColor: profile.color }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: profile.color }}>
              <span>0</span><span>63</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {sections.map(s => (
            <div key={s.key} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2" style={{ color: profile.color }}>
                {s.icon}
                <h3 className="font-bold text-[#1E2939] text-sm">{s.label}</h3>
              </div>
              <p className="text-[#6B7280] text-sm leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton onClick={() => navigate('/onboarding/intro3')}>
          Introducing Emotional Massage
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
