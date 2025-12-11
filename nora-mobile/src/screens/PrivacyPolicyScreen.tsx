/**
 * Privacy Policy Screen
 * Displays the app's privacy policy
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

export const PrivacyPolicyScreen: React.FC = () => {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: December 11, 2025</Text>

          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect information you provide directly to us, including your name, email address, and information about your child such as their name and age. We also collect audio recordings when you use our recording features.
          </Text>

          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to provide, maintain, and improve our services, to develop new features, and to protect Nora and our users. We analyze audio recordings to provide personalized parenting insights and recommendations.
          </Text>

          <Text style={styles.sectionTitle}>3. Information Sharing</Text>
          <Text style={styles.paragraph}>
            We do not share your personal information with third parties except as described in this policy. We may share information with service providers who assist us in operating the app and providing our services.
          </Text>

          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction. Your audio recordings are encrypted during transmission and storage.
          </Text>

          <Text style={styles.sectionTitle}>5. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time.
          </Text>

          <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            While Nora is designed to help parents, we do not knowingly collect personal information directly from children. Any information about children is provided by parents or guardians.
          </Text>

          <Text style={styles.sectionTitle}>7. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to access, update, or delete your personal information. You can do this through your account settings or by contacting us. You also have the right to object to certain processing of your data.
          </Text>

          <Text style={styles.sectionTitle}>8. Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your device to refuse all cookies or to indicate when a cookie is being sent.
          </Text>

          <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
          </Text>

          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy, please contact us through the app's support section.
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
