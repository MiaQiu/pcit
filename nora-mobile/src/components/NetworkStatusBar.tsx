import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const NetworkStatusBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [slideAnim] = useState(new Animated.Value(-100)); // Start hidden above

  useEffect(() => {
    // Get initial state
    const initialStatus = networkMonitor.getConnectionStatus();
    console.log('[NetworkStatusBar] Initial connection status:', initialStatus);
    setStatus(initialStatus);

    const unsubscribe = networkMonitor.addStatusListener((newStatus) => {
      console.log('[NetworkStatusBar] Status changed to:', newStatus);
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status !== 'online') {
      // Slide down when offline or server down
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide up when back online
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status]);

  const getMessage = () => {
    switch (status) {
      case 'offline':
        return 'No Internet Connection';
      case 'server_down':
        return 'Connection Issue';
      default:
        return '';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.text}>{getMessage()}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFA500', // Amber
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 9998,
  },
  text: {
    color: '#000000', // Black text for readability
    fontSize: 14,
    fontWeight: '600',
  },
});
