import React, { useState } from 'react';
import authService from '../services/authService';
import amplitudeService from '../services/amplitudeService';

const WacbSurvey = ({ onSubmitSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Step 1: Parenting Stress
  const [parentingStressLevel, setParentingStressLevel] = useState(null);
  const [parentingStressChange, setParentingStressChange] = useState(null);

  // Step 2: Child Behavior Questions
  const [questions, setQuestions] = useState({
    q1: { value: null, change: null },
    q2: { value: null, change: null },
    q3: { value: null, change: null },
    q4: { value: null, change: null },
    q5: { value: null, change: null },
    q6: { value: null, change: null },
    q7: { value: null, change: null },
    q8: { value: null, change: null },
    q9: { value: null, change: null },
  });

  const questionTexts = [
    { key: 'q1', text: 'Dawdle, linger, stall, or delay?' },
    { key: 'q2', text: 'Have trouble behaving at meal times?' },
    { key: 'q3', text: 'Disobey or act defiant?' },
    { key: 'q4', text: 'Act angry, or aggressive?' },
    { key: 'q5', text: 'Scream and yell when upset and is hard to calm?' },
    { key: 'q6', text: "Destroy or act careless with others' things?" },
    { key: 'q7', text: 'Provoke others or pick fights?' },
    { key: 'q8', text: 'Interrupt or seek attention?' },
    { key: 'q9', text: 'Have trouble paying attention or is overactive?' },
  ];

  const handleQuestionChange = (questionKey, value) => {
    setQuestions(prev => ({
      ...prev,
      [questionKey]: { ...prev[questionKey], value }
    }));
  };

  const handleChangeNeeded = (questionKey, needsChange) => {
    setQuestions(prev => ({
      ...prev,
      [questionKey]: { ...prev[questionKey], change: needsChange }
    }));
  };

  const validateForm = () => {
    if (parentingStressLevel === null) return 'Please rate your parenting stress level';
    if (parentingStressChange === null) return 'Please indicate if parenting stress needs to change';

    for (const q of questionTexts) {
      if (questions[q.key].value === null) {
        return `Please answer: ${q.text}`;
      }
      if (questions[q.key].change === null) {
        return `Please indicate if change is needed for: ${q.text}`;
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

      const response = await authService.authenticatedRequest(
        `${API_BASE_URL}/wacb-survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parentingStressLevel,
            parentingStressChange,
            q1Dawdle: questions.q1.value,
            q1Change: questions.q1.change,
            q2MealBehavior: questions.q2.value,
            q2Change: questions.q2.change,
            q3Disobey: questions.q3.value,
            q3Change: questions.q3.change,
            q4Angry: questions.q4.value,
            q4Change: questions.q4.change,
            q5Scream: questions.q5.value,
            q5Change: questions.q5.change,
            q6Destroy: questions.q6.value,
            q6Change: questions.q6.change,
            q7ProvokeFights: questions.q7.value,
            q7Change: questions.q7.change,
            q8Interrupt: questions.q8.value,
            q8Change: questions.q8.change,
            q9Attention: questions.q9.value,
            q9Change: questions.q9.change
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      const result = await response.json();

      // Track survey submission in Amplitude
      amplitudeService.trackSurveySubmission(
        result.totalScore,
        result.totalChangesNeeded
      );

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        // Reset form
        setParentingStressLevel(null);
        setParentingStressChange(null);
        setQuestions({
          q1: { value: null, change: null },
          q2: { value: null, change: null },
          q3: { value: null, change: null },
          q4: { value: null, change: null },
          q5: { value: null, change: null },
          q6: { value: null, change: null },
          q7: { value: null, change: null },
          q8: { value: null, change: null },
          q9: { value: null, change: null },
        });
        if (onSubmitSuccess) onSubmitSuccess(result);
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ScaleButton = ({ value, selected, onClick }) => (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`w-8 h-8 rounded-lg font-medium text-sm transition-colors ${
        selected === value
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {value}
    </button>
  );

  const YesNoButton = ({ label, selected, onClick }) => (
    <button
      type="button"
      onClick={() => onClick(label === 'Yes')}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        selected === (label === 'Yes')
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Child Progress Assessment</h2>
        <p className="text-sm text-gray-600 mt-1">Weekly Assessment of Child Behavior (WACB-N)</p>
      </div>

      {showSuccess && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          Survey submitted successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STEP 1: Parenting Stress */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">STEP 1: Parenting Stress</h3>

          <div className="mb-4">
            <p className="text-gray-700 mb-2">In the past week, how stressful was it to parent this child?</p>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Not at all</span>
              <span>Very</span>
            </div>
            <div className="flex gap-1 justify-between">
              {[1, 2, 3, 4, 5, 6, 7].map(val => (
                <ScaleButton
                  key={val}
                  value={val}
                  selected={parentingStressLevel}
                  onClick={setParentingStressLevel}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-gray-700 mb-2">Does this need to change?</p>
            <div className="flex gap-2">
              <YesNoButton label="Yes" selected={parentingStressChange} onClick={setParentingStressChange} />
              <YesNoButton label="No" selected={parentingStressChange} onClick={setParentingStressChange} />
            </div>
          </div>
        </div>

        {/* STEP 2: Child Behavior Questions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">STEP 2: Child Behavior</h3>
          <p className="text-sm text-gray-600 mb-4">
            How often does your child... (Circle one number per sentence)
          </p>

          <div className="space-y-4">
            {questionTexts.map(({ key, text }, index) => (
              <div key={key} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 font-medium mb-2">
                  {index + 1}. {text}
                </p>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Never</span>
                    <span>Always</span>
                  </div>
                  <div className="flex gap-1 justify-between">
                    {[1, 2, 3, 4, 5, 6, 7].map(val => (
                      <ScaleButton
                        key={val}
                        value={val}
                        selected={questions[key].value}
                        onClick={(v) => handleQuestionChange(key, v)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">Does this need to change?</span>
                  <div className="flex gap-2">
                    <YesNoButton
                      label="Yes"
                      selected={questions[key].change}
                      onClick={(val) => handleChangeNeeded(key, val)}
                    />
                    <YesNoButton
                      label="No"
                      selected={questions[key].change}
                      onClick={(val) => handleChangeNeeded(key, val)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-xs text-gray-500 border-t pt-4">
        <p>Copyright © [2011] Dr. Susan Timmer and The Regents of the University of California, Davis campus. All Rights Reserved. Used with permission.</p>
      </div>
    </div>
  );
};

export default WacbSurvey;
