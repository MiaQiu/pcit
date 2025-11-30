import React from 'react';

const SkillCard = ({ title, icon }) => {
  return (
    <div className="flex-shrink-0 w-32 bg-green-100 rounded-2xl p-4 mr-3">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
    </div>
  );
};

export default SkillCard;
