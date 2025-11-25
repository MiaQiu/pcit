import React, { useState } from 'react';
import { Volume2, Check } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

const SoundEffectSelector = ({ currentSound = 'gentle-ding', onSelect }) => {
  const [playing, setPlaying] = useState(null);
  const [selected, setSelected] = useState(currentSound);

  const soundOptions = [
    {
      id: 'gentle-ding',
      name: 'Gentle Ding',
      description: 'A soft, pleasant notification chime',
      icon: '🔔'
    },
    {
      id: 'success-chime',
      name: 'Success Chime',
      description: 'Two-tone ascending chime (sounds like success)',
      icon: '✨'
    },
    {
      id: 'soft-bell',
      name: 'Soft Bell',
      description: 'A single bell tone with harmonics',
      icon: '🎵'
    },
    {
      id: 'triple-beep',
      name: 'Triple Beep',
      description: 'Three short beeps in succession',
      icon: '📢'
    },
    {
      id: 'subtle-pop',
      name: 'Subtle Pop',
      description: 'A quiet, soft pop sound',
      icon: '💫'
    }
  ];

  const handlePlay = (soundId) => {
    setPlaying(soundId);
    playSound(soundId);

    // Reset playing indicator after sound duration
    const durations = {
      'gentle-ding': 500,
      'success-chime': 500,
      'soft-bell': 800,
      'triple-beep': 450,
      'subtle-pop': 100
    };

    setTimeout(() => setPlaying(null), durations[soundId]);
  };

  const handleSelect = (soundId) => {
    setSelected(soundId);
    if (onSelect) {
      onSelect(soundId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          Choose Recording End Sound
        </h3>
        <p className="text-sm text-gray-600">
          This sound will play when your 5-minute recording completes
        </p>
      </div>

      {soundOptions.map((option) => (
        <div
          key={option.id}
          className={`border-2 rounded-xl p-4 transition-all cursor-pointer ${
            selected === option.id
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
          onClick={() => handleSelect(option.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="text-3xl">{option.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-800">{option.name}</h4>
                  {selected === option.id && (
                    <Check size={16} className="text-green-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600">{option.description}</p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlay(option.id);
              }}
              className={`p-3 rounded-full transition-colors ${
                playing === option.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              disabled={playing === option.id}
            >
              <Volume2 size={20} />
            </button>
          </div>
        </div>
      ))}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Click the speaker icon to preview each sound before selecting
        </p>
      </div>
    </div>
  );
};

export default SoundEffectSelector;
