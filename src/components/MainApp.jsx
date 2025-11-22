import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import HomeScreen from '../screens/HomeScreen';
import LearnScreen from '../screens/LearnScreen';
import RecordingScreen from '../screens/RecordingScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { checkHealth } from '../services/pcitService';

const MainApp = () => {
  const [activeScreen, setActiveScreen] = useState('learn');
  const [backendStatus, setBackendStatus] = useState(null);
  const [selectedDeck, setSelectedDeck] = useState(null);

  // Check backend health on app startup
  useEffect(() => {
    const verifyBackend = async () => {
      try {
        const health = await checkHealth();
        setBackendStatus(health);
        if (!health.services?.anthropic) {
          console.warn('Anthropic API key not configured on backend');
        }
      } catch (error) {
        console.error('Backend health check failed:', error.message);
        setBackendStatus({ status: 'error', error: error.message });
      }
    };
    verifyBackend();
  }, []);

  // Function to navigate to a specific deck in HomeScreen
  const navigateToDeck = (deckNumber) => {
    setSelectedDeck(deckNumber);
    setActiveScreen('home');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return <HomeScreen selectedDeck={selectedDeck} />;
      case 'progress':
        return <ProgressScreen />;
      case 'learn':
        return <LearnScreen setActiveScreen={setActiveScreen} navigateToDeck={navigateToDeck} />;
      case 'profile':
        return <ProfileScreen />;
      case 'recording':
        // TEMP: Preview mode for session - set to null to disable preview
        const previewSessionId = '67264850-64fe-4ca2-b21d-3fbe84398d51';
        return <RecordingScreen setActiveScreen={setActiveScreen} previewSessionId={previewSessionId} />;
      default:
        return <LearnScreen setActiveScreen={setActiveScreen} navigateToDeck={navigateToDeck} />;
    }
  };

  return (
    <div className="font-sans antialiased">
      {renderScreen()}
      {activeScreen !== 'recording' && (
        <BottomNav
          activeScreen={activeScreen}
          setActiveScreen={setActiveScreen}
        />
      )}
    </div>
  );
};

export default MainApp;
