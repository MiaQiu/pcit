import React, { useState } from 'react';
import DateItem from '../components/DateItem';
import CircularProgress from '../components/CircularProgress';

const ReportScreen = () => {
  const [selectedDate, setSelectedDate] = useState(28);

  const dates = [
    { date: 25, day: 'Sun' },
    { date: 26, day: 'Mon' },
    { date: 27, day: 'Tue' },
    { date: 28, day: 'Wed' },
    { date: 29, day: 'Thu' },
    { date: 30, day: 'Fri' },
  ];

  return (
    <div className="min-h-screen bg-yellow-50 pb-24">
      <div className="px-6 pt-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Daily Report</h1>

        {/* Date Picker */}
        <div className="flex overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide mb-6">
          {dates.map((item) => (
            <DateItem
              key={item.date}
              date={item.date}
              day={item.day}
              isActive={selectedDate === item.date}
              onClick={() => setSelectedDate(item.date)}
            />
          ))}
        </div>

        {/* Report Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            Great job Emma!
          </h2>

          {/* Happy Score Gauge */}
          <div className="flex justify-center mb-6">
            <CircularProgress value={50} />
          </div>

          <p className="text-center text-sm text-gray-500 mb-2">
            Happy Score
          </p>

          <p className="text-center text-gray-600 mt-4">
            You and Teddy played for:
          </p>
          <p className="text-center text-lg font-semibold text-gray-800">
            4 minutes, 59 seconds
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportScreen;
