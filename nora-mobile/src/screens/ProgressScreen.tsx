/**
 * Progress Screen
 * User progress, stats, and streak tracking
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { RootStackNavigationProp } from '../navigation/types';
import { useRecordingService } from '../contexts/AppContext';

export const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const recordingService = useRecordingService();
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLatestRecording();
  }, []);

  const loadLatestRecording = async () => {
    try {
      setLoading(true);
      const { recordings } = await recordingService.getRecordings();
      if (recordings && recordings.length > 0) {
        setLatestRecordingId(recordings[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      setLoading(false);
    }
  };

  const handleViewReport = () => {
    if (latestRecordingId) {
      navigation.navigate('Report', { recordingId: latestRecordingId });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Progress stats and calendar will appear here
          </Text>

          {/* Temporary button to view latest report */}
          <View style={styles.buttonContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#8C49D5" />
            ) : latestRecordingId ? (
              <Button onPress={handleViewReport} variant="primary">
                View Latest Report
              </Button>
            ) : (
              <Text style={styles.noRecordingsText}>
                No recordings yet. Record a session to see your report!
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    marginBottom: 24,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 400,
  },
  placeholderText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 16,
    alignItems: 'center',
  },
  noRecordingsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});
