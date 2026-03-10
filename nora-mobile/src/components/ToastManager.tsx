import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, ToastType } from './Toast';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [nextId, setNextId] = useState(0);

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000, action?: ToastAction) => {
    const id = nextId;
    setNextId(id + 1);
    setToasts(prev => [...prev, { id, message, type, duration, action }]);
  };

  const hideToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={() => hideToast(toast.id)}
          action={toast.action}
        />
      ))}
    </ToastContext.Provider>
  );
};
