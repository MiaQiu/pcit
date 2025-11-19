import React, { useState } from 'react';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import LearnScreen from './screens/LearnScreen';
import RecordingScreen from './screens/RecordingScreen';
import ReportScreen from './screens/ReportScreen';
import ProfileScreen from './screens/ProfileScreen';

const App = () => {
  const [activeScreen, setActiveScreen] = useState('learn');

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

export default App;
