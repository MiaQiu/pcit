/**
 * Reassurance Screen
 * Personalized message with dragon after surveys
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ReassuranceScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();

  const userName = data.name || 'there';
  const childName = data.childName || 'your child';

  return (
    <LinearGradient
      colors={['#96D1E1', '#FFFFFF', '#FFFFFF']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Dragon Image */}
          <Image
            source={require('../../../assets/images/dragon_waving.png')}
            style={styles.dragon}
            resizeMode="contain"
          />

          {/* Text Content */}
          <View style={styles.textContent}>
            <Text style={styles.title}>
              Hi {userName}, Nora is creating a personalized approach for you and {childName}.
            </Text>
            <Text style={styles.description}>
              We'll focus on the skills that matter most — one step at a time.
            </Text>
          </View>
        </View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('FocusAreas')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Let's go!  →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragon: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    marginBottom: 20,
  },
  textContent: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1E2939',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    textAlign: 'center',
    lineHeight: 24,
    marginLeft:12,
    marginRight:12
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
