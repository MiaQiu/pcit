import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-6 pt-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Profile</h1>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-gray-800 font-medium">{user?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-800 font-medium">{user?.email || 'N/A'}</p>
            </div>
            {user?.childName && (
              <div>
                <p className="text-sm text-gray-500">Child's Name</p>
                <p className="text-gray-800 font-medium">{user.childName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-gray-800 font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
