import React from 'react';

const DateItem = ({ date, day, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-2 rounded-xl mr-2 ${
        isActive
          ? 'bg-blue-500 text-white'
          : 'bg-white text-gray-600'
      }`}
    >
      <p className={`text-lg font-bold ${isActive ? 'text-white' : 'text-gray-800'}`}>
        {date}
      </p>
      <p className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
        {day}
      </p>
    </button>
  );
};

export default DateItem;
