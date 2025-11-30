import React, { useState, useEffect } from 'react';
import learningBg from '../assets/learning.png';
import learningService from '../services/learningService';

const LearnScreen = ({ setActiveScreen, navigateToDeck }) => {
  const [selectedStone, setSelectedStone] = useState(null);
  const [learningProgress, setLearningProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load learning progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const progress = await learningService.getProgress();
        setLearningProgress(progress);
      } catch (error) {
        console.error('Failed to load learning progress:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, []);

  // Function to check if a deck is completed
  const isDeckCompleted = (deckNumber) => {
    if (!learningProgress) return false;
    return deckNumber < learningProgress.currentDeck;
  };

  // Function to check if a deck is unlocked
  const isDeckUnlocked = (deckNumber) => {
    if (!learningProgress) return false;
    return deckNumber <= learningProgress.unlockedDecks;
  };

  // Function to check if a deck is current
  const isCurrentDeck = (deckNumber) => {
    if (!learningProgress) return false;
    return deckNumber === learningProgress.currentDeck;
  };

  // CDI Valley stones (10 stones along the bottom path)
  const cdiStones = [
    { deckNumber: 1, name: 'Intro-PCIT', left: '14%', bottom: '12%' },
    { deckNumber: 2, name: 'Intro-CDI', left: '32%', bottom: '11%' },
    { deckNumber: 3, name: 'Praise', left: '50%', bottom: '11%' },
    { deckNumber: 4, name: 'Reflecting', left: '66%', bottom: '14%' },
    { deckNumber: 5, name: 'Imitation', left: '75%', bottom: '20%' },
    { deckNumber: 6, name: 'Describing', left: '66%', bottom: '25%' },
    { deckNumber: 7, name: 'Enjoyment', left: '60%', bottom: '32%' },
    { deckNumber: 8, name: 'Avoid command', left: '44%', bottom: '33%' },
    { deckNumber: 9, name: 'Avoid questions', left: '30%', bottom: '37%' },
    { deckNumber: 10, name: 'Avoid criticism', left: '43%', bottom: '40%' },
  ];

  // PDI Climb stones (5 stones along the mountain path)
  const pdiStones = [
    { deckNumber: 11, name: 'Intro-PDI', left: '66%', bottom: '49%' },
    { deckNumber: 12, name: 'Effective command', left: '78%', bottom: '54%' },
    { deckNumber: 13, name: 'Command sequence', left: '60%', bottom: '56%' },
    { deckNumber: 14, name: 'Advanced application 1', left: '45%', bottom: '59%' },
    { deckNumber: 15, name: 'Advanced application 2', left: '50%', bottom: '66%' },
  ];

  return (
    <div className="min-h-screen bg-purple-100 pb-24 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${learningBg})` }}
      />

      {/* CDI Valley Stones */}
      {!loading && cdiStones.map((stone, index) => {
        const completed = isDeckCompleted(stone.deckNumber);
        const unlocked = isDeckUnlocked(stone.deckNumber);
        const current = isCurrentDeck(stone.deckNumber);

        return (
          <button
            key={stone.deckNumber}
            onClick={() => setSelectedStone(stone)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110"
            style={{ left: stone.left, bottom: stone.bottom }}
            disabled={!unlocked}
          >
            <div className="relative">
              {/* Stone */}
              <div
                className={`w-12 h-12 rounded-full shadow-lg border-4 ${
                  completed
                    ? 'bg-green-400 border-green-600'
                    : current
                    ? 'bg-yellow-300 border-yellow-500'
                    : unlocked
                    ? 'bg-blue-200 border-blue-400'
                    : 'bg-gray-300 border-gray-400'
                } flex items-center justify-center font-bold text-black p-1`}
              >
                <span className="text-[8px] text-center leading-tight">{stone.name}</span>
              </div>
              {/* Pulse animation for current deck */}
              {current && (
                <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-75"></div>
              )}
            </div>
          </button>
        );
      })}

      {/* PDI Climb Stones */}
      {!loading && pdiStones.map((stone, index) => {
        const completed = isDeckCompleted(stone.deckNumber);
        const unlocked = isDeckUnlocked(stone.deckNumber);
        const current = isCurrentDeck(stone.deckNumber);

        return (
          <button
            key={stone.deckNumber}
            onClick={() => setSelectedStone(stone)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110"
            style={{ left: stone.left, bottom: stone.bottom }}
            disabled={!unlocked}
          >
            <div className="relative">
              {/* Stone */}
              <div
                className={`w-12 h-12 rounded-full shadow-lg border-4 ${
                  completed
                    ? 'bg-orange-400 border-orange-600'
                    : current
                    ? 'bg-yellow-300 border-yellow-500'
                    : unlocked
                    ? 'bg-purple-200 border-purple-400'
                    : 'bg-gray-300 border-gray-400'
                } flex items-center justify-center font-bold text-black p-1`}
              >
                <span className="text-[8px] text-center leading-tight">{stone.name}</span>
              </div>
              {/* Pulse animation for current deck */}
              {current && (
                <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-75"></div>
              )}
            </div>
          </button>
        );
      })}

      {/* Stone Detail Modal */}
      {selectedStone && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setSelectedStone(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle Bar */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>

            {/* Content */}
            <div className="text-center">
              <div
                className={`w-16 h-16 rounded-full mx-auto mb-4 ${
                  isDeckCompleted(selectedStone.deckNumber)
                    ? selectedStone.deckNumber <= 10
                      ? 'bg-green-400'
                      : 'bg-orange-400'
                    : isCurrentDeck(selectedStone.deckNumber)
                    ? 'bg-yellow-300'
                    : isDeckUnlocked(selectedStone.deckNumber)
                    ? selectedStone.deckNumber <= 10
                      ? 'bg-blue-200'
                      : 'bg-purple-200'
                    : 'bg-gray-300'
                } flex items-center justify-center`}
              >
                <span className="text-2xl font-bold">
                  {isDeckCompleted(selectedStone.deckNumber) ? '✓' : isDeckUnlocked(selectedStone.deckNumber) ? '📚' : '🔒'}
                </span>
              </div>

              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Deck {selectedStone.deckNumber}: {selectedStone.name}
              </h3>

              <p className="text-gray-600 mb-6">
                {isDeckCompleted(selectedStone.deckNumber)
                  ? 'Deck completed! You can review it anytime.'
                  : isCurrentDeck(selectedStone.deckNumber)
                  ? 'This is your current deck. Continue learning!'
                  : isDeckUnlocked(selectedStone.deckNumber)
                  ? 'This deck is unlocked. Start learning!'
                  : 'Complete previous decks to unlock this one.'}
              </p>

              {isDeckUnlocked(selectedStone.deckNumber) && (
                <button
                  onClick={() => {
                    // Navigate to home screen with the selected deck
                    navigateToDeck(selectedStone.deckNumber);
                    setSelectedStone(null);
                  }}
                  className={`w-full py-4 rounded-full font-bold text-white shadow-lg ${
                    selectedStone.deckNumber <= 10
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {isDeckCompleted(selectedStone.deckNumber) ? 'Review Deck' : isCurrentDeck(selectedStone.deckNumber) ? 'Continue Learning' : 'Start Deck'}
                </button>
              )}

              {!isDeckUnlocked(selectedStone.deckNumber) && (
                <button
                  onClick={() => setSelectedStone(null)}
                  className="w-full py-4 rounded-full font-bold text-gray-700 bg-gray-200 shadow-lg"
                  disabled
                >
                  Locked
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnScreen;
