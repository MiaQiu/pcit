import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, clearToken } from '../api/client';
import { verifyToken, login as apiLogin, therapistLogin as apiTherapistLogin } from '../api/adminApi';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: 'admin' | 'therapist' | null;
  login: (password: string) => Promise<void>;
  therapistLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  role: null,
  login: async () => {},
  therapistLogin: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'therapist' | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      verifyToken().then(({ valid, role: r }) => {
        if (valid) {
          setIsAuthenticated(true);
          setRole(r);
        } else {
          clearToken();
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (password: string) => {
    await apiLogin(password);
    setIsAuthenticated(true);
    setRole('admin');
  };

  const therapistLogin = async (email: string, password: string) => {
    await apiTherapistLogin(email, password);
    setIsAuthenticated(true);
    setRole('therapist');
  };

  const logout = () => {
    clearToken();
    setIsAuthenticated(false);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, role, login, therapistLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
