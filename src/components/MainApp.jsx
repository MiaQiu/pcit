import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import HomeScreen from '../screens/HomeScreen';
import LearnScreen from '../screens/LearnScreen';
import RecordingScreen from '../screens/RecordingScreen';
import ReportScreen from '../screens/ReportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { checkHealth } from '../services/pcitService';

const MainApp = () => {
  const [activeScreen, setActiveScreen] = useState('learn');
  const [backendStatus, setBackendStatus] = useState(null);

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

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home':
        return <HomeScreen />;
      case 'progress':
        return <ReportScreen />;
      case 'learn':
        return <LearnScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'recording':
        return <RecordingScreen setActiveScreen={setActiveScreen} />;
      default:
        return <LearnScreen />;
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
