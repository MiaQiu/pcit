/**
 * Child Gender Screen
 * User selects their child's gender
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

type Gender = 'BOY' | 'GIRL' | 'OTHER';

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'BOY', label: 'Boy' },
  { id: 'GIRL', label: 'Girl' },
  { id: 'OTHER', label: 'Other' },
];

export const ChildGenderScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [selectedGender, setSelectedGender] = useState<Gender | null>(
    data.childGender || null
  );

  const handleGenderSelect = (gender: Gender) => {
    setSelectedGender(gender);
  };

  const handleContinue = () => {
    if (selectedGender) {
      updateData({ childGender: selectedGender });
      navigation.navigate('ChildBirthday');
    }
  };

  const isValid = selectedGender !== null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Dragon Header with Text Box */}
          <View style={styles.headerSection}>
            <View style={styles.dragonIconContainer}>
              <Image
                source={require('../../../assets/images/dragon_image.png')}
                style={styles.dragonIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerTextBox}>
              <Text style={styles.headerText}>
                Next question!
              </Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What is your child's gender?</Text>
          </View>

          {/* Gender Options */}
          <View style={styles.optionsContainer}>
            {GENDERS.map((gender) => (
              <TouchableOpacity
                key={gender.id}
                style={[
                  styles.optionButton,
                  selectedGender === gender.id && styles.optionButtonSelected,
                ]}
                onPress={() => handleGenderSelect(gender.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedGender === gender.id && styles.optionTextSelected,
                  ]}
                >
                  {gender.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  optionButtonSelected: {
    backgroundColor: '#F3E8FF',
    borderColor: '#8C49D5',
  },
  optionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#4A5565',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#8C49D5',
  },
  spacer: {
    height: 32,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
});
