import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

export const Demo2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../../assets/images/demo2.png')}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text style={styles.body}>
          Nora listens to your day-to-day interactions — playtime, boundaries, big feelings.
        </Text>
      </View>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo2B')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Next  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
  },
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
