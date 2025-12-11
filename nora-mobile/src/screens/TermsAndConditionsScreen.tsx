/**
 * Terms and Conditions Screen
 * Displays the app's terms and conditions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

export const TermsAndConditionsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: December 11, 2025</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using Nora, you accept and agree to be bound by the terms and provision of this agreement.
          </Text>

          <Text style={styles.sectionTitle}>2. Use License</Text>
          <Text style={styles.paragraph}>
            Permission is granted to temporarily download one copy of Nora for personal, non-commercial transitory viewing only.
          </Text>

          <Text style={styles.sectionTitle}>3. User Account</Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
          </Text>

          <Text style={styles.sectionTitle}>4. Privacy</Text>
          <Text style={styles.paragraph}>
            Your use of Nora is also governed by our Privacy Policy. Please review our Privacy Policy, which also governs the app and informs users of our data collection practices.
          </Text>

          <Text style={styles.sectionTitle}>5. Prohibited Uses</Text>
          <Text style={styles.paragraph}>
            You may not use Nora for any illegal or unauthorized purpose. You must not violate any laws in your jurisdiction while using the service.
          </Text>

          <Text style={styles.sectionTitle}>6. Modifications to Service</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify or discontinue the service at any time without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the service.
          </Text>

          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Nora shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
          </Text>

          <Text style={styles.sectionTitle}>8. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms and Conditions, please contact us through the app's support section.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 16,
  },
});
