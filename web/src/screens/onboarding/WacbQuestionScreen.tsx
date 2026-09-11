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
  { key: 'q1Dawdle',        text: (name) => `In the past two weeks, how often has ${name} purposely dragged their feet during daily routine activities (e.g., mealtime or bedtime)?` },
  { key: 'q2Disobey',       text: (name) => `In the past two weeks, how often has ${name} refused to listen or said 'no' when given rules or requests?` },
  { key: 'q3Tantrum',       text: (name) => `In the past two weeks, how often has ${name} had a temper tantrum that was hard to stop (e.g., crying, whining, yelling, screaming, or throwing themselves on the floor)?` },
  { key: 'q4Defiance',      text: (name) => `In the past two weeks, how often has ${name} deliberately argued with, talked back to, or provoked adults?` },
  { key: 'q5FocusDemand',   text: (name) => `In the past two weeks, how often has ${name} had difficulty focusing on one activity or frequently demanded attention?` },
  { key: 'q6Restless',      text: (name) => `In the past two weeks, how often has ${name} interrupted others or been unable to sit still?` },
  { key: 'q7TaskCompletion', text: (name) => `In the past two weeks, how often has ${name} had difficulty completing daily tasks or schoolwork on time?` },
  { key: 'q8Destroy',       text: (name) => `In the past two weeks, how often has ${name} broken things or handled other people's toys or belongings roughly?` },
  { key: 'q9Aggression',    text: (name) => `In the past two weeks, how often has ${name} acted physically aggressively or gotten into physical fights with others (e.g., parents, siblings, or peers)?` },
  { key: 'q10LieSteal',     text: (name) => `In the past two weeks, how often has ${name} lied or stolen other people's belongings?` },
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

  const progress = Math.round(((15 + qNum) / 32) * 100);

  const handleAnswer = async (val: number) => {
    if (!question) return;
    setWacbAnswer(question.key, val);
    // Small delay so the selection highlight is visible before navigating
    await new Promise(r => setTimeout(r, 360));
    if (qNum < 10) {
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="mb-4 text-center">
          <span className="text-xs font-semibold text-[#8C49D5] uppercase tracking-wide">
            Question {qNum} of 10
          </span>
        </div>

        <h1 className="text-[#1E2939] text-xl font-bold mb-6 leading-snug text-center">
          {question.text(childName)}
        </h1>

        {/* <div className="rounded-xl p-4 mb-6">
          <p className="text-[#6B7280] text-xs">
            There are no right or wrong answers — and this is not a diagnosis.
          </p>
        </div> */}

        <ScaleQuestion value={currentValue} onChange={handleAnswer} />

      </div>

      {/* Fixed button footer */}
      <div className="px-1 pb-2 pt-3">
        <PrimaryButton
          onClick={() => handleAnswer(currentValue!)}
          disabled={currentValue === undefined}
          loading={submitting}
        >
          {qNum === 10 ? 'See My Results' : 'Next'}
        </PrimaryButton>
      </div>
    </OnboardingLayout>
  );
}
