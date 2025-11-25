import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';
import SoundEffectSelector from '../components/SoundEffectSelector';

const SoundSettingsScreen = ({ setActiveScreen }) => {
  const [selectedSound, setSelectedSound] = useState('gentle-ding');
  const [saved, setSaved] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const savedSound = localStorage.getItem('recordingEndSound');
    if (savedSound) {
      setSelectedSound(savedSound);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('recordingEndSound', selectedSound);
    setSaved(true);

    // Reset saved indicator after 2 seconds
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setActiveScreen('profile')}
            className="p-2 -ml-2"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Sound Settings</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <SoundEffectSelector
          currentSound={selectedSound}
          onSelect={setSelectedSound}
        />

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`w-full mt-6 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            saved
              ? 'bg-green-600 cursor-default'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {saved ? (
            <>
              <Check size={20} />
              Saved!
            </>
          ) : (
            <>
              <Save size={20} />
              Save Preference
            </>
          )}
        </button>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-2">About Recording End Sound</h3>
          <p className="text-sm text-gray-600">
            When your 5-minute recording session completes, a brief sound effect will play
            to notify you. This helps you know when the recording has automatically stopped.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SoundSettingsScreen;
