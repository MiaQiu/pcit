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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

const ISSUES = [
  {
    id: 'tantrums',
    label: 'Tantrums and meltdowns',
    icon: 'thunderstorm-outline' as const,
  },
  {
    id: 'defiance',
    label: 'Defiance and not listening',
    icon: 'hand-left-outline' as const,
  },
  {
    id: 'aggression',
    label: 'Aggression or hitting',
    icon: 'alert-circle-outline' as const,
  },
  {
    id: 'social',
    label: 'Social skills and sharing',
    icon: 'people-outline' as const,
  },
  {
    id: 'emotional',
    label: 'Emotional regulation',
    icon: 'heart-outline' as const,
  },
  {
    id: 'routine',
    label: 'Following routines and transitions',
    icon: 'calendar-outline' as const,
  },
  {
    id: 'general',
    label: 'General parenting support',
    icon: 'star-outline' as const,
  },
];

export const ChildIssueScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [selectedIssue, setSelectedIssue] = useState<string>(data.issue || '');

  const handleIssueSelect = (issueId: string) => {
    setSelectedIssue(issueId);
  };

  const handleContinue = () => {
    if (selectedIssue) {
      updateData({ issue: selectedIssue });
      navigation.navigate('Intro1');
    }
  };

  const isValid = selectedIssue !== '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>How can Nora help?</Text>
          <Text style={styles.subtitle}>
            Choose the area you'd most like support with
          </Text>
        </View>

        {/* Issue Options */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {ISSUES.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={[
                styles.issueCard,
                selectedIssue === issue.id && styles.issueCardSelected,
              ]}
              onPress={() => handleIssueSelect(issue.id)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconContainer,
                  selectedIssue === issue.id && styles.iconContainerSelected,
                ]}
              >
                <Ionicons
                  name={issue.icon}
                  size={24}
                  color={selectedIssue === issue.id ? '#8C49D5' : '#6B7280'}
                />
              </View>
              <Text
                style={[
                  styles.issueLabel,
                  selectedIssue === issue.id && styles.issueLabelSelected,
                ]}
              >
                {issue.label}
              </Text>
              {selectedIssue === issue.id && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color="#8C49D5" />
                </View>
              )}
            </TouchableOpacity>
          ))}
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
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
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  issueCardSelected: {
    borderColor: '#8C49D5',
    borderWidth: 2,
    backgroundColor: '#F9F5FF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerSelected: {
    backgroundColor: '#EDE9FE',
  },
  issueLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1F2937',
  },
  issueLabelSelected: {
    color: '#8C49D5',
  },
  checkmark: {
    marginLeft: 8,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 16,
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
