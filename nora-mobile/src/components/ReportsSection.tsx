import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackNavigationProp } from '../navigation/types';
import { useRecordingService } from '../contexts/AppContext';

interface Recording {
  id: string;
  mode: string;
  createdAt: string;
  overallScore?: number | null;
}

interface VisibleWeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  headline: string | null;
  totalDeposits: number;
  sessionIds: string[];
}

interface ReportsSectionProps {
  recordings: Recording[];
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({ recordings }) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const recordingService = useRecordingService();
  const [visibility, setVisibility] = useState<{ daily: boolean; weekly: boolean; monthly: boolean } | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<VisibleWeeklyReport[]>([]);
  const [loadingVisibility, setLoadingVisibility] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [visData, weeklyData] = await Promise.all([
        recordingService.getReportVisibility().catch(() => ({ daily: false, weekly: false, monthly: false })),
        recordingService.getVisibleWeeklyReports().catch(() => ({ reports: [] })),
      ]);
      setVisibility(visData);
      setWeeklyReports(weeklyData.reports);
    } finally {
      setLoadingVisibility(false);
    }
  };

  if (loadingVisibility) {
    return null;
  }

  const hasDaily = visibility?.daily && recordings.length > 0;
  // Weekly reports are controlled per-report via the visibility field in DB,
  // so show them whenever there are visible records (no global toggle needed)
  const hasWeekly = weeklyReports.length > 0;
  const hasMonthly = visibility?.monthly;

  if (!hasDaily && !hasWeekly && !hasMonthly) {
    return null;
  }

  const recentRecordings = recordings.slice(0, 5);

  // Calculate monthly stats
  const now = new Date();
  const currentMonthRecordings = recordings.filter(r => {
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlySessionCount = currentMonthRecordings.length;
  const scoredRecordings = currentMonthRecordings.filter(r => r.overallScore && r.overallScore > 0);
  const monthlyAvgScore = scoredRecordings.length > 0
    ? Math.round(scoredRecordings.reduce((sum, r) => sum + (r.overallScore || 0), 0) / scoredRecordings.length)
    : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMode = (mode: string) => {
    return mode === 'CDI' ? 'Child-Directed' : 'Parent-Directed';
  };

  const formatWeekRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Reports</Text>

      {/* Daily Reports */}
      {hasDaily && (
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Recent Sessions</Text>
          {recentRecordings.map((recording) => (
            <TouchableOpacity
              key={recording.id}
              style={styles.sessionCard}
              onPress={() => navigation.navigate('Report', { recordingId: recording.id })}
              activeOpacity={0.7}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionDate}>{formatDate(recording.createdAt)}</Text>
                <Text style={styles.sessionMode}>{formatMode(recording.mode)}</Text>
              </View>
              <View style={styles.sessionRight}>
                {recording.overallScore ? (
                  <Text style={styles.sessionScore}>{recording.overallScore}</Text>
                ) : (
                  <Text style={styles.sessionNoScore}>--</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Weekly Reports from DB */}
      {hasWeekly && (
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Weekly Reports</Text>
          {weeklyReports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.weeklyCard}
              onPress={() => navigation.navigate('WeeklyReport', { reportId: report.id })}
              activeOpacity={0.7}
            >
              <View style={styles.weeklyLeft}>
                <View style={styles.weeklyIconContainer}>
                  <Ionicons name="calendar-outline" size={24} color="#8C49D5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weeklyTitle} numberOfLines={1}>
                    {report.headline || 'Weekly Report'}
                  </Text>
                  <Text style={styles.weeklySubtitle}>
                    {formatWeekRange(report.weekStartDate, report.weekEndDate)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Monthly Summary */}
      {hasMonthly && (
        <View style={styles.monthlyCard}>
          <Text style={styles.monthlyTitle}>This Month</Text>
          <View style={styles.monthlyStats}>
            <View style={styles.monthlyStat}>
              <Text style={styles.monthlyStatValue}>{monthlySessionCount}</Text>
              <Text style={styles.monthlyStatLabel}>Sessions</Text>
            </View>
            <View style={styles.monthlyDivider} />
            <View style={styles.monthlyStat}>
              <Text style={styles.monthlyStatValue}>{monthlyAvgScore || '--'}</Text>
              <Text style={styles.monthlyStatLabel}>Avg Score</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 12,
  },
  subsection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
  },
  sessionMode: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sessionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionScore: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#8C49D5',
  },
  sessionNoScore: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#D1D5DB',
  },
  weeklyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weeklyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  weeklyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1E2939',
  },
  weeklySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  monthlyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthlyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  monthlyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyStat: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyStatValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1E2939',
  },
  monthlyStatLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  monthlyDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
});
