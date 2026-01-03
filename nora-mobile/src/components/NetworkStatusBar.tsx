import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const NetworkStatusBar: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [fadeAnim] = useState(new Animated.Value(0)); // Start hidden
  const [scaleAnim] = useState(new Animated.Value(0.8)); // Start slightly smaller

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
    if (status === 'offline') {
      // Fade in and scale up when offline
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out and scale down when online (or server down but connected)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status]);

  const getMessage = () => {
    switch (status) {
      case 'offline':
        return 'No Internet Connection';
      default:
        return '';
    }
  };

  // Only show when offline (not for server errors)
  if (status !== 'offline') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateX: '-50%' },
            { translateY: '-50%' },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View style={styles.button}>
        <Text style={styles.text}>{getMessage()}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 9998,
  },
  button: {
    backgroundColor: '#FFA500', // '#1E2939', //'#FFA500', // Amber
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#000000', //'#000000', // Black text for readability
    fontSize: 16,
    fontWeight: '700',
  },
});
