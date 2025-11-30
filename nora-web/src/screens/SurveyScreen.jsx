import React from 'react';
import { ArrowLeft } from 'lucide-react';
import WacbSurvey from '../components/WacbSurvey';

const SurveyScreen = ({ setActiveScreen }) => {
  const handleSubmitSuccess = (result) => {
    console.log('Survey submitted:', result);
    // Navigate back to home after successful submission
    setTimeout(() => {
      setActiveScreen('home');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-purple-50 pb-24">
      <div className="px-6 pt-8">
        {/* Header with Back Button */}
        <div className="mb-6 flex items-center">
          <button
            onClick={() => setActiveScreen('home')}
            className="p-2 hover:bg-white rounded-full transition-colors mr-3"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Weekly Assessment</h1>
            <p className="text-sm text-gray-600">Track your child's progress</p>
          </div>
        </div>

        {/* Survey Component */}
        <WacbSurvey onSubmitSuccess={handleSubmitSuccess} />
      </div>
    </div>
  );
};

export default SurveyScreen;
