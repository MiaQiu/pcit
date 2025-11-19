import React from 'react';
import { ChevronRight } from 'lucide-react';
import SkillCard from '../components/SkillCard';

const LearnScreen = () => {
  const skills = [
    { title: 'Celebration', icon: '🍉' },
    { title: 'Avoiding Command', icon: '🌸' },
    { title: 'Reflection', icon: '🌻' },
    { title: 'Praise', icon: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-6 pt-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Learn</h1>

        {/* Today's Lesson Card */}
        <div className="bg-blue-200 rounded-3xl p-4 mb-8">
          <div className="bg-orange-100 rounded-2xl p-6">
            <p className="text-sm text-gray-600 mb-1">Today's Lesson:</p>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Narration</h2>
            <button className="bg-orange-400 text-white px-6 py-2 rounded-full font-medium hover:bg-orange-500 transition-colors">
              Start
            </button>
          </div>
        </div>

        {/* Skills Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Skills</h2>
            <button className="text-sm text-blue-500 flex items-center">
              See all
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {skills.map((skill, index) => (
              <SkillCard key={index} title={skill.title} icon={skill.icon} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnScreen;
