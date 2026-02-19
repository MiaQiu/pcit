/**
 * ModulePickerModal
 * Shows after Foundation completion to help user choose their next module.
 * Recommended modules (based on child issue priorities) shown first.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import type { ModuleWithProgress } from '@nora/core';

const { height } = Dimensions.get('window');

interface ModulePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectModule: (moduleKey: string) => void;
  modules: ModuleWithProgress[];
  recommendedModules: string[];
}

export const ModulePickerModal: React.FC<ModulePickerModalProps> = ({
  visible,
  onClose,
  onSelectModule,
  modules,
  recommendedModules,
}) => {
  // Split modules into recommended and other (exclude Foundation and completed)
  const availableModules = modules.filter(
    m => m.key !== 'FOUNDATION' && !m.isLocked && m.completedLessons < m.lessonCount
  );

  const recommendedSet = new Set(recommendedModules);
  const recommended = availableModules
    .filter(m => recommendedSet.has(m.key))
    .sort((a, b) => recommendedModules.indexOf(a.key) - recommendedModules.indexOf(b.key));
  const others = availableModules.filter(m => !recommendedSet.has(m.key));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#999999" />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.title}>You've completed the Foundation!</Text>
          <Text style={styles.subtitle}>
            Pick a module to set as your daily lesson.
          </Text>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* Recommended section */}
            {recommended.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recommended for you</Text>
                {recommended.map(mod => (
                  <ModulePickerCard
                    key={mod.key}
                    module={mod}
                    isRecommended
                    onPress={() => onSelectModule(mod.key)}
                  />
                ))}
              </>
            )}

            {/* Other modules */}
            {others.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  {recommended.length > 0 ? 'Other modules' : 'Available modules'}
                </Text>
                {others.map(mod => (
                  <ModulePickerCard
                    key={mod.key}
                    module={mod}
                    isRecommended={false}
                    onPress={() => onSelectModule(mod.key)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          {/* Skip button */}
          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipText}>I'll decide later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Internal card component for module selection
const ModulePickerCard: React.FC<{
  module: ModuleWithProgress;
  isRecommended: boolean;
  onPress: () => void;
}> = ({ module, isRecommended, onPress }) => {
  const progress = module.lessonCount > 0
    ? module.completedLessons / module.lessonCount
    : 0;
  const isInProgress = module.completedLessons > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{module.title}</Text>
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
          </View>
        )}
      </View>
      <Text style={styles.cardDescription} numberOfLines={2}>{module.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardLessonCount}>
          {module.lessonCount} {module.lessonCount === 1 ? 'lesson' : 'lessons'}
        </Text>
        {isInProgress && (
          <Text style={styles.cardProgress}>
            {module.completedLessons}/{module.lessonCount} done
          </Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={COLORS.mainPurple} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: Dimensions.get('window').width - 40,
    maxWidth: 400,
    maxHeight: height * 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  celebrationEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  scrollArea: {
    maxHeight: height * 0.45,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
  },
  recommendedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLessonCount: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#999999',
    flex: 1,
  },
  cardProgress: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
  },
  skipButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#999999',
  },
});
