import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { networkMonitor, ConnectionStatus } from '../utils/NetworkMonitor';

export const NetworkStatusBar: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const { t } = useTranslation();

  useEffect(() => {
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
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [status]);

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
        <Text style={styles.text}>{t('networkStatus.offline')}</Text>
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
    backgroundColor: '#FFA500',
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
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
