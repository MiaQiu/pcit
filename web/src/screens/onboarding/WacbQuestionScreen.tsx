import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import PrimaryButton from '../../components/PrimaryButton';
import ScaleQuestion from '../../components/ScaleQuestion';
import { useOnboarding, WacbAnswers } from '../../contexts/OnboardingContext';
import { submitWacbSurvey } from '../../api';

type WacbKey = keyof WacbAnswers;

interface Question {
  key: WacbKey;
  text: (name: string) => string;
}

const QUESTIONS: Question[] = [
  { key: 'q1Dawdle',       text: (name) => `In the past two weeks, how often has ${name} taken too long to do things or dragged their feet on purpose?` },
  { key: 'q2MealBehavior', text: (name) => `In the past two weeks, how often has ${name} acted up or misbehaved while eating?` },
  { key: 'q3Disobey',      text: (name) => `In the past two weeks, how often has ${name} refused to listen or said 'no' to rules?` },
  { key: 'q4Angry',        text: (name) => `In the past two weeks, how often has ${name} lost their temper or acted physically rough?` },
  { key: 'q5Scream',       text: (name) => `In the past two weeks, how often has ${name} had a screaming fit or tantrum that was hard to stop?` },
  { key: 'q6Destroy',      text: (name) => `In the past two weeks, how often has ${name} broken things or been too rough with other people's toys?` },
  { key: 'q7ProvokeFights', text: (name) => `In the past two weeks, how often has ${name} started arguments or teased others on purpose?` },
  { key: 'q8Interrupt',    text: (name) => `In the past two weeks, how often has ${name} interrupted conversations or demanded constant attention?` },
  { key: 'q9Attention',    text: (name) => `In the past two weeks, how often has ${name} struggled to focus or been unable to sit still?` },
];

export default function WacbQuestionScreen() {
  const { questionNumber } = useParams<{ questionNumber: string }>();
  const navigate = useNavigate();
  const { data, setWacbAnswer } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  const qNum = parseInt(questionNumber || '1');
  const qIndex = qNum - 1;
  const question = QUESTIONS[qIndex];
  const childName = data.childName || 'your child';
  const currentValue = question ? data.wacb[question.key] : undefined;

  const progress = Math.round(((15 + qNum) / 31) * 100);

  const handleAnswer = async (val: number) => {
    if (!question) return;
    setWacbAnswer(question.key, val);
    // Small delay so the selection highlight is visible before navigating
    await new Promise(r => setTimeout(r, 360));
    if (qNum < 9) {
      navigate(`/onboarding/wacb/${qNum + 1}`);
    } else {
      if (!data.accessToken) {
        navigate('/onboarding/behavior-profile');
        return;
      }
      setSubmitting(true);
      try {
        await submitWacbSurvey({
          parentingStressLevel: data.wacb.parentingStressLevel ?? 3,
          ...data.wacb,
          [question.key]: val,
        }, data.accessToken);
      } catch (e: unknown) {
        console.warn('WACB submit error:', e);
      } finally {
        setSubmitting(false);
      }
      navigate('/onboarding/behavior-profile');
    }
  };

  const handleBack = () => {
    if (qNum > 1) {
      navigate(`/onboarding/wacb/${qNum - 1}`);
    } else {
      navigate('/onboarding/snapshot-intro');
    }
  };

  if (!question) return null;

  return (
    <OnboardingLayout progress={progress} onBack={handleBack}>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
        <div className="mb-4">
          <span className="text-xs font-semibold text-[#8C49D5] uppercase tracking-wide">
            Question {qNum} of 9
          </span>
        </div>

        <h1 className="text-[#1E2939] text-xl font-bold mb-6 leading-snug">
          {question.text(childName)}
        </h1>

        <div className="bg-[#F9F7FF] border border-[#EDE9FE] rounded-xl p-4 mb-6">
          <p className="text-[#6B7280] text-xs italic">
            There are no right or wrong answers — and this is not a diagnosis.
          </p>
        </div>

        <ScaleQuestion value={currentValue} onChange={handleAnswer} />

      </div>

      {/* Fixed button footer */}
      <div className="px-6 pb-8 pt-3 bg-white border-t border-gray-100">
        <PrimaryButton
          onClick={() => handleAnswer(currentValue!)}
          disabled={currentValue === undefined}
          loading={submitting}
        >
          {qNum === 9 ? 'See My Results' : 'Next'}
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
