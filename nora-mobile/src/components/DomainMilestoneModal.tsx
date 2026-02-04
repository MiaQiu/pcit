/**
 * Domain Milestone Modal
 * Displays detailed milestones for a developmental domain when users tap on radar chart labels
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import type { DomainMilestone, DomainType, DomainProfiling } from '@nora/core';

interface DomainMilestoneModalProps {
  visible: boolean;
  domain: DomainType | null;
  milestones: DomainMilestone[] | null;
  profiling?: DomainProfiling | null;
  childName?: string | null;
  loading?: boolean;
  onClose: () => void;
}

// Status colors following the plan spec
const STATUS_COLORS = {
  ACHIEVED: {
    background: '#FFFBEB',
    icon: '#F59E0B',
  },
  EMERGING: {
    background: '#F8F7FC',
    icon: '#8B5CF6',
  },
  NOT_YET: {
    background: '#F9FAFB',
    icon: '#9CA3AF',
  },
};

const MilestoneItem: React.FC<{ milestone: DomainMilestone }> = ({ milestone }) => {
  const colors = STATUS_COLORS[milestone.status];

  const getIcon = () => {
    switch (milestone.status) {
      case 'ACHIEVED':
        return <Ionicons name="trophy" size={18} color={colors.icon} />;
      case 'EMERGING':
        return <Ionicons name="sparkles" size={18} color={colors.icon} />;
      case 'NOT_YET':
        return <Ionicons name="ellipse-outline" size={18} color={colors.icon} />;
    }
  };

  return (
    <View style={[styles.milestoneItem, { backgroundColor: colors.background }]}>
      <View style={styles.milestoneHeader}>
        <View style={styles.iconContainer}>{getIcon()}</View>
        <View style={styles.milestoneContent}>
          <Text style={styles.milestoneTitle}>{milestone.displayTitle}</Text>
          <Text style={styles.milestoneStage}>{milestone.groupingStage}</Text>
        </View>
      </View>
      {milestone.actionTip && milestone.status !== 'ACHIEVED' && (
        <Text style={styles.actionTip}>Tips: {milestone.actionTip}</Text>
      )}
    </View>
  );
};

export const DomainMilestoneModal: React.FC<DomainMilestoneModalProps> = ({
  visible,
  domain,
  milestones,
  profiling,
  childName,
  loading,
  onClose,
}) => {
  if (!domain) return null;

  // Group milestones by status
  const achieved = milestones?.filter((m) => m.status === 'ACHIEVED') || [];
  const emerging = milestones?.filter((m) => m.status === 'EMERGING') || [];
  const notYet = milestones?.filter((m) => m.status === 'NOT_YET') || [];

  const renderSection = (
    title: string,
    items: DomainMilestone[],
    status: 'ACHIEVED' | 'EMERGING' | 'NOT_YET'
  ) => {
    if (items.length === 0) return null;

    const colors = STATUS_COLORS[status];

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: colors.icon }]} />
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>({items.length})</Text>
        </View>
        {items.map((milestone) => (
          <MilestoneItem key={milestone.id} milestone={milestone} />
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>{domain} Milestones</Text>

          {/* Subtitle with counts */}
          {/* {!loading && milestones && (
            <Text style={styles.subtitle}>
              {achieved.length} achieved, {emerging.length} emerging, {notYet.length} not yet
            </Text>
          )} */}

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.mainPurple} />
              <Text style={styles.loadingText}>Loading milestones...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={true}
            >
              {/* Profiling Summary */}
              {profiling && (
                <View style={styles.profilingSection}>
                  <Text style={styles.profilingStatus}>
                    {childName || 'Your child'} is {profiling.developmental_status.toLowerCase()} in {domain} development.
                  </Text>
                </View>
              )}

              {renderSection('Achieved', achieved, 'ACHIEVED')}
              {renderSection('Emerging', emerging, 'EMERGING')}
              {renderSection('Not Yet Observed', notYet, 'NOT_YET')}

              {milestones && milestones.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No milestones found for this domain.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    maxWidth: 400,
    maxHeight: height * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeIcon: {
    fontSize: 32,
    color: COLORS.textDark,
    fontWeight: '300',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 32,
    color: COLORS.mainPurple,
    marginBottom: 4,
    paddingRight: 32,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: height * 0.5,
  },
  scrollViewContent: {
    paddingBottom: 16,
  },
  profilingSection: {
    //backgroundColor: '#F0F9FF',
    borderRadius: 12,
    //padding: 12,
    marginBottom: 20,
    //borderLeftWidth: 3,
    //borderLeftColor: COLORS.mainPurple,
  },
  profilingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profilingStatus: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
  },
  profilingLevel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
  },
  observationsList: {
    marginTop: 4,
  },
  observationItem: {
    marginTop: 8,
  },
  observationInsight: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  observationEvidence: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  sectionCount: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  milestoneItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  milestoneStage: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  actionTip: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#4B5563',
    marginTop: 8,
    marginLeft: 36,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
