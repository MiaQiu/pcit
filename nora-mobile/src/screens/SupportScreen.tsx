/**
 * Support Screen
 * Allows users to submit support requests with description and file attachments
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { FONTS, COLORS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';

interface AttachedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export const SupportScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();

  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAttachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      console.log('Document picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles: AttachedFile[] = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        }));

        console.log('Adding files to state:', newFiles);
        setAttachedFiles(prev => {
          const updated = [...prev, ...newFiles];
          console.log('Total attached files:', updated.length);
          return updated;
        });

        Alert.alert('Success', `${newFiles.length} file(s) attached`);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to attach file. Please try again.');
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your email address.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Required Field', 'Please enter a description of your issue.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const submitWithRetry = async (isRetry: boolean = false): Promise<any> => {
      // Refresh token before submission if not a retry
      if (!isRetry) {
        await authService.refreshAccessToken();
      }

      const token = authService.getAccessToken();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

      const formData = new FormData();
      formData.append('email', email);
      formData.append('description', description);

      // Attach files
      console.log('Attaching files:', attachedFiles.length);
      attachedFiles.forEach((file, index) => {
        console.log(`Attaching file ${index + 1}:`, file.name, file.mimeType, file.size);
        const fileData: any = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        };
        formData.append('attachments', fileData);
      });

      console.log('Submitting to:', `${apiUrl}/api/support/request`);

      const response = await fetch(`${apiUrl}/api/support/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      // Handle 401 - token expired
      if (response.status === 401 && !isRetry) {
        console.log('[SupportScreen] Token expired, refreshing and retrying...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          return submitWithRetry(true);
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const error = await response.json();
        console.error('Server error response:', error);
        throw new Error(error.error || 'Failed to submit support request');
      }

      return await response.json();
    };

    try {
      setIsSubmitting(true);

      const result = await submitWithRetry();
      console.log('Support request submitted successfully:', result);

      Alert.alert(
        'Request Submitted',
        'Thank you for contacting us. We will review your request and get back to you shortly.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );

      // Reset form
      setEmail('');
      setDescription('');
      setAttachedFiles([]);
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.introText}>
            Having trouble or need help? Describe your issue below and we'll get back to you as soon as possible.
          </Text>

          {/* Email Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.emailInput}
              placeholder="your.email@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Describe your issue or question..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>

          {/* Attachments Section */}
          <View style={styles.section}>
            <View style={styles.attachmentHeader}>
              <Text style={styles.label}>Attachments</Text>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handleAttachFile}
                activeOpacity={0.7}
              >
                <Ionicons name="attach" size={20} color="#8C49D5" />
                <Text style={styles.attachButtonText}>Attach File</Text>
              </TouchableOpacity>
            </View>

            {attachedFiles.length > 0 && (
              <View style={styles.fileList}>
                {attachedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileIcon}>
                      <Ionicons name="document-outline" size={20} color="#8C49D5" />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveFile(index)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
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
  introText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#1F2937',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 150,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#8C49D5',
  },
  fileList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 2,
  },
  fileSize: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
  },
  removeButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#8C49D5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
