import { useState, useEffect } from 'react';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>(
    networkMonitor.getConnectionStatus()
  );

  useEffect(() => {
    const unsubscribe = networkMonitor.addStatusListener((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return {
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isServerDown: status === 'server_down',
    status,
  };
};
