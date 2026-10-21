/**
 * ReportsCalendar
 * "Past reports" month calendar: days with a completed report (or the Monday
 * a weekly report was generated) are highlighted; tapping one lists that
 * day's reports. Used by ProgressScreen (play sessions, module reports and
 * weekly reports) and the Learn module's "My plan" tab (its module reports).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TrackedTouchable } from './TrackedTouchable';
import { toSingaporeDateString, getTodaySingapore } from '../utils/timezone';
import type { LearnModuleKey } from '../constants/learnModules';

interface CalendarDay {
  date: Date;
  hasRecording: boolean;
}

export interface VisibleWeeklyReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  headline: string | null;
}

export interface CalendarRecording {
  id: string;
  createdAt: string;
  mode?: string;
  overallScore?: number | null;
  analysisStatus?: string | null;
  // Set → a Learn module report (e.g. screen-time ending), not a play session.
  moduleKey?: LearnModuleKey;
  // Overrides the row's default title (mode / module name).
  label?: string;
}

export const ReportsCalendar: React.FC<{
  title: string;
  subtitle?: string;
  recordingDates: Date[];
  recordings: CalendarRecording[];
  weeklyReports?: VisibleWeeklyReport[];
  onReportPress: (recordingId: string, moduleKey?: LearnModuleKey) => void;
  onWeeklyReportPress?: (reportId: string) => void;
}> = ({ title, subtitle, recordingDates, recordings, weeklyReports = [], onReportPress, onWeeklyReportPress }) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (autoSelectedRef.current || recordings.length === 0) return;
    const completed = recordings.filter(r => r.analysisStatus === 'COMPLETED');
    if (completed.length === 0) return;
    const latest = completed.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
    const dateStr = toSingaporeDateString(new Date(latest.createdAt));
    setSelectedDate(dateStr);
    setCurrentMonth(new Date(latest.createdAt));
    autoSelectedRef.current = true;
  }, [recordings]);

  const goToPreviousMonth = () => {
    setSelectedDate(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setSelectedDate(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Generate calendar days for the current month, padded to full weeks
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Adjust day of week: Monday=0, Tuesday=1, ..., Sunday=6
    // JavaScript's getDay(): Sunday=0, Monday=1, ..., Saturday=6
    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek < 0) startingDayOfWeek = 6; // Sunday becomes 6

    const days: CalendarDay[] = [];

    // Convert recording dates to set for faster lookup (using Singapore timezone)
    const recordingDateStrings = new Set(recordingDates.map(d => toSingaporeDateString(d)));

    // Add previous month's trailing days
    for (let i = 0; i < startingDayOfWeek; i++) {
      const date = new Date(year, month, -startingDayOfWeek + i + 1);
      const dateStr = toSingaporeDateString(date);
      days.push({ date, hasRecording: recordingDateStrings.has(dateStr) });
    }

    // Add current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = toSingaporeDateString(date);
      days.push({ date, hasRecording: recordingDateStrings.has(dateStr) });
    }

    // Pad with next month's days to complete the last week
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = toSingaporeDateString(date);
      days.push({ date, hasRecording: recordingDateStrings.has(dateStr) });
    }

    return days;
  };

  const days = generateCalendarDays();
  const monthName = currentMonth.toLocaleDateString(dateLocale, {
    month: 'short',
    year: 'numeric',
  });

  const weeklyReportMondayStrings = new Set(
    weeklyReports.map(report => toSingaporeDateString(new Date(report.weekEndDate)))
  );

  // Get all COMPLETED recordings for the selected date
  const selectedDateRecordings = selectedDate
    ? recordings.filter(r =>
        r.analysisStatus === 'COMPLETED' &&
        toSingaporeDateString(new Date(r.createdAt)) === selectedDate
      )
    : [];

  // Show weekly report only on the Monday (SGT) it was generated.
  // weekEndDate in UTC lands on Monday SGT — match that date directly.
  const selectedDateWeeklyReport = selectedDate
    ? weeklyReports.find(report =>
        selectedDate === toSingaporeDateString(new Date(report.weekEndDate))
      ) || null
    : null;

  const formatMode = (mode: string) => mode === 'CDI' ? t('progress.playTime') : t('progress.discipline');

  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(dateLocale, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <View>
      <Text style={styles.calendarTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.calendarSubtitle}>{subtitle}</Text>}
      <View style={styles.calendarContainer}>
        {/* Month navigation */}
        <View style={styles.monthNavigation}>
          <TrackedTouchable analyticsId="goToPreviousMonth" onPress={goToPreviousMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color="#6B7280" />
          </TrackedTouchable>
          <Text style={styles.monthName}>{monthName}</Text>
          <TrackedTouchable analyticsId="goToNextMonth" onPress={goToNextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TrackedTouchable>
        </View>

        {/* Day headers */}
        <View style={styles.dayHeaderRow}>
          {[t('progress.mon'), t('progress.tue'), t('progress.wed'), t('progress.thu'), t('progress.fri'), t('progress.sat'), t('progress.sun')].map((day, index) => (
            <Text key={index} style={styles.dayHeader}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth();
            const isToday = toSingaporeDateString(day.date) === getTodaySingapore();
            const dateStr = toSingaporeDateString(day.date);
            const isSelected = dateStr === selectedDate;

            const isWeeklyReportMonday = isCurrentMonth && weeklyReportMondayStrings.has(dateStr);

            if (day.hasRecording && isCurrentMonth) {
              return (
                <TrackedTouchable analyticsId={`Calendar Day: ${dateStr}`}
                  key={index}
                  style={styles.dayCell}
                  onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCircle, styles.dayCircleActive, isSelected && styles.dayCircleSelected]}>
                    <Text style={[styles.dayText, styles.dayTextActive]}>
                      {day.date.getDate()}
                    </Text>
                  </View>
                </TrackedTouchable>
              );
            }

            if (isWeeklyReportMonday) {
              return (
                <TrackedTouchable analyticsId={`Calendar Day (Weekly Report): ${dateStr}`}
                  key={index}
                  style={styles.dayCell}
                  onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCircle, styles.dayCircleWeekly, isSelected && styles.dayCircleSelected]}>
                    <Text style={[styles.dayText, styles.dayTextActive]}>
                      {day.date.getDate()}
                    </Text>
                  </View>
                </TrackedTouchable>
              );
            }

            return (
              <View key={index} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    !isCurrentMonth && styles.dayCircleInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextInactive,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Day reports panel — shown when an orange day is selected */}
        {selectedDate && (selectedDateRecordings.length > 0 || selectedDateWeeklyReport) && (
          <View style={styles.dayReportsPanel}>
            <View style={styles.dayReportsDivider} />
            <Text style={styles.dayReportsDate}>{formatSelectedDate(selectedDate)}</Text>
            {selectedDateRecordings.map((recording) => (
              <TrackedTouchable analyticsId="progress.sessionReport"
                key={recording.id}
                style={styles.dayReportItem}
                onPress={() => onReportPress(recording.id, recording.moduleKey)}
                activeOpacity={0.7}
              >
                <View style={styles.dayReportItemLeft}>
                  <View style={styles.dayReportDot} />
                  <View>
                    <Text style={styles.dayReportItemTitle}>
                      {recording.label ?? (recording.moduleKey ? t(`learnV2.modules.${recording.moduleKey}.title`) : formatMode(recording.mode ?? 'CDI'))}
                    </Text>
                    <Text style={styles.dayReportItemSub}>{t('progress.sessionReport')}</Text>
                  </View>
                </View>
                <View style={styles.dayReportItemRight}>
                  {recording.moduleKey ? null : recording.overallScore ? (
                    <Text style={styles.dayReportScore}>{recording.overallScore}</Text>
                  ) : (
                    <Text style={styles.dayReportNoScore}>--</Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TrackedTouchable>
            ))}
            {selectedDateWeeklyReport && (
              <TrackedTouchable analyticsId="progress.weeklyReport"
                style={styles.dayReportItem}
                onPress={() => onWeeklyReportPress?.(selectedDateWeeklyReport.id)}
                activeOpacity={0.7}
              >
                <View style={styles.dayReportItemLeft}>
                  <View style={[styles.dayReportDot, styles.dayReportDotWeekly]} />
                  <View>
                    <Text style={styles.dayReportItemTitle}>
                      {t('progress.weeklyReport')}
                    </Text>
                    {/* <Text style={styles.dayReportItemSub}>Weekly Report</Text> */}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TrackedTouchable>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 12,
    marginLeft:5
  },
  calendarSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
    marginTop: -8,
    marginLeft:5
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthArrow: {
    padding: 4,
  },
  monthName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    flex: 1,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  dayHeader: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#9CA3AF',
    width: 36,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  dayCircleActive: {
    backgroundColor: '#FF8C42',
  },
  dayCircleWeekly: {
    backgroundColor: '#FF8C42',
  },
  dayCircleSelected: {
    borderWidth: 2.5,
    borderColor: '#8C49D5',
  },
  dayCircleInactive: {
    backgroundColor: 'transparent',
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: '#8C49D5',
  },
  dayText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#6B7280',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  dayTextInactive: {
    color: '#D1D5DB',
  },
  dayReportsPanel: {
    marginTop: 8,
  },
  dayReportsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  dayReportsDate: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  dayReportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayReportItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dayReportDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF8C42',
  },
  dayReportDotWeekly: {
    backgroundColor: '#8C49D5',
  },
  dayReportItemTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
  },
  dayReportItemSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  dayReportItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayReportScore: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#8C49D5',
  },
  dayReportNoScore: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#D1D5DB',
  },
});
