import React from 'react';
import { Home, BarChart2, BookOpen, User } from 'lucide-react';

const BottomNav = ({ activeScreen, setActiveScreen }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'progress', icon: BarChart2, label: 'Progress' },
    { id: 'record', icon: null, label: 'Record' },
    { id: 'learn', icon: BookOpen, label: 'Learn' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex justify-around items-center">
      {navItems.map((item) => {
        if (item.id === 'record') {
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen('recording')}
              className="flex flex-col items-center -mt-6"
            >
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
            </button>
          );
        }

        const Icon = item.icon;
        const isActive = activeScreen === item.id ||
          (item.id === 'learn' && activeScreen === 'learn');

        return (
          <button
            key={item.id}
            onClick={() => setActiveScreen(item.id)}
            className="flex flex-col items-center py-2 px-3"
          >
            <Icon
              size={24}
              className={isActive ? 'text-green-500' : 'text-gray-400'}
            />
            <span className={`text-xs mt-1 ${isActive ? 'text-green-500 font-medium' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
