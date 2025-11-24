import { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // TEMPORARY: Mock user for UI development (bypass login)
  const mockUser = {
    id: 'mock-user-123',
    email: 'demo@happypillar.com',
    name: 'Demo User',
    childName: 'Alex'
  };

  const [user, setUser] = useState(mockUser); // Set mock user by default
  const [loading, setLoading] = useState(false); // No loading needed
  const [error, setError] = useState(null);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    // TEMPORARY: Skip authentication, use mock user
    setUser(mockUser);
    setLoading(false);

    /* Original auth code - uncomment to re-enable login:
    if (!authService.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to load user:', err);
      authService.clearTokens();
    } finally {
      setLoading(false);
    }
    */
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const data = await authService.login(email, password);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const signup = async (email, password, name, childName, childAge, childCondition) => {
    try {
      setError(null);
      const data = await authService.signup(email, password, name, childName, childAge, childCondition);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
