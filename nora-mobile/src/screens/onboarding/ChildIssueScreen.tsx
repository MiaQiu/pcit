/**
 * Child Issue Screen
 * User selects how Nora can help (7 options)
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
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

const ISSUES = [
  {
    id: 'tantrums',
    label: 'Tantrums or managing big feelings',
    icon: 'thunderstorm-outline' as const,
  },
  {
    id: 'not-listening',
    label: 'Not listening',
    icon: 'hand-left-outline' as const,
  },
  {
    id: 'arguing',
    label: 'Arguing',
    icon: 'alert-circle-outline' as const,
  },
  {
    id: 'social',
    label: 'Social-emotional skills',
    icon: 'people-outline' as const,
  },
  {
    id: 'new_baby_in_the_house',
    label: 'New baby in the home',
    icon: 'heart-outline' as const,
  },
  {
    id: 'frustration_tolerance',
    label: 'Low frustration tolerance',
    icon: 'calendar-outline' as const,
  },
  {
    id: 'Navigating_change',
    label: 'Navigating a big change',
    icon: 'star-outline' as const,
  },
];

export const ChildIssueScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [selectedIssues, setSelectedIssues] = useState<string[]>(
    data.issue ? (Array.isArray(data.issue) ? data.issue : [data.issue]) : []
  );

  const handleIssueSelect = (issueId: string) => {
    setSelectedIssues((prev) => {
      if (prev.includes(issueId)) {
        // Remove if already selected
        return prev.filter((id) => id !== issueId);
      } else {
        // Add if not selected
        return [...prev, issueId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedIssues.length > 0) {
      updateData({ issue: selectedIssues });
      navigation.navigate('InitialReassurance');
    }
  };

  const isValid = selectedIssues.length > 0;

  return (
    <SafeAreaView style={styles.container}>
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
            There are no right or wrong answers. Select all that applies.
            </Text>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>How can Nora help?</Text>
          {/* <Text style={styles.subtitle}>
            Choose the area you'd most like support with
          </Text> */}
        </View>

        {/* Issue Options */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {ISSUES.map((issue) => {
            const isSelected = selectedIssues.includes(issue.id);
            return (
              <TouchableOpacity
                key={issue.id}
                style={[
                  styles.issueCard,
                  isSelected && styles.issueCardSelected,
                ]}
                onPress={() => handleIssueSelect(issue.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.issueLabel,
                    isSelected && styles.issueLabelSelected,
                  ]}
                >
                  {issue.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#007866" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
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
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  issueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 30,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  issueCardSelected: {
    borderColor: '#007866',
    borderWidth: 2,
    backgroundColor: '#EBF9F8',
  },
  issueLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
  issueLabelSelected: {
    color: '#1E2939',
  },
  checkmark: {
    marginLeft: 8,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 32,
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
