/**
 * Progress Screen
 * User progress, stats, and streak tracking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { RootStackNavigationProp } from '../navigation/types';
import { useRecordingService, useLessonService } from '../contexts/AppContext';
import Svg, { Path, Circle, Line } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StatCardProps {
  value: number;
  label: string;
}

const StatCard: React.FC<StatCardProps> = ({ value, label }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface CalendarDay {
  date: Date;
  hasRecording: boolean;
}

const CalendarView: React.FC<{ recordingDates: Date[]; lessonCompletionDates: Date[] }> = ({ recordingDates, lessonCompletionDates }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Generate calendar days for the current month
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

    // Convert recording dates and lesson dates to sets for faster lookup
    const recordingDateStrings = new Set(recordingDates.map(d => d.toDateString()));
    const lessonDateStrings = new Set(lessonCompletionDates.map(d => d.toDateString()));

    // Add previous month's trailing days
    for (let i = 0; i < startingDayOfWeek; i++) {
      const date = new Date(year, month, -startingDayOfWeek + i + 1);
      const dateStr = date.toDateString();
      days.push({
        date,
        hasRecording: recordingDateStrings.has(dateStr) && lessonDateStrings.has(dateStr),
      });
    }

    // Add current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toDateString();
      days.push({
        date,
        hasRecording: recordingDateStrings.has(dateStr) && lessonDateStrings.has(dateStr),
      });
    }

    return days;
  };

  const days = generateCalendarDays();
  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <View>
      <Text style={styles.calendarTitle}>Your Streak</Text>
      <View style={styles.calendarContainer}>
        {/* Month navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.monthName}>{monthName}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={styles.dayHeaderRow}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
            <Text key={day} style={styles.dayHeader}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth();
            const isToday = day.date.toDateString() === new Date().toDateString();

            return (
              <View key={index} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    day.hasRecording && styles.dayCircleActive,
                    !isCurrentMonth && styles.dayCircleInactive,
                    isToday && !day.hasRecording && styles.dayCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      day.hasRecording && styles.dayTextActive,
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
      </View>
    </View>
  );
};

interface ScoreChartProps {
  data: Array<{ date: string; day: number; month: string; score: number }>;
}

const ScoreChart: React.FC<ScoreChartProps> = ({ data }) => {
  const chartWidth = SCREEN_WIDTH - 48 - 40; // padding + margins
  const chartHeight = 180;
  const maxDataPoints = 10; // Always show 10 points on x-axis
  const pointSpacing = chartWidth / (maxDataPoints - 1); // Space between points
  const leftPadding = 10; // No padding, start at edge

  if (data.length === 0) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Overall Nora Score</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data yet</Text>
        </View>
      </View>
    );
  }

  const maxScore = 100;
  const minScore = 0;
  const scoreRange = maxScore - minScore;

  // Calculate points for the line (only for actual data)
  const points = data.map((item, index) => {
    const x = leftPadding + (index * pointSpacing);
    const y = chartHeight - ((item.score - minScore) / scoreRange) * chartHeight;
    return { x, y };
  });

  // Create path data
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Overall Nora Score</Text>
      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {/* <Text style={styles.axisLabel}>{Math.round(maxScore)}</Text>
          <Text style={styles.axisLabel}>{Math.round((maxScore + minScore) / 2)}</Text>
          <Text style={styles.axisLabel}>{Math.round(minScore)}</Text> */}
          <Text style={styles.axisLabel}>{100}</Text>
          <Text style={styles.axisLabel}>{80}</Text>
          <Text style={styles.axisLabel}>{60}</Text>
          <Text style={styles.axisLabel}>{40}</Text>
          <Text style={styles.axisLabel}>{20}</Text>
          <Text style={styles.axisLabel}>{0}</Text>
        </View>

        {/* Chart */}
        <View style={styles.chartSvgContainer}>
          <Svg width={chartWidth} height={chartHeight}>
            {/* Y-axis */}
            <Line
              x1={0}
              y1={0}
              x2={0}
              y2={chartHeight}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
            {/* X-axis */}
            <Line
              x1={0}
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
            {/* Data line */}
            <Path
              d={pathData}
              stroke="#8C49D5"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Draw points */}
            {points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={4}
                fill="#8C49D5"
              />
            ))}
          </Svg>

          {/* X-axis labels - show day numbers for all 10 positions */}
          <View style={styles.xAxisLabelsContainer}>
            <View style={styles.xAxisLabels}>
              {Array.from({ length: maxDataPoints }).map((_, index) => {
                const hasData = index < data.length;

                return (
                  <View key={index} style={styles.xAxisLabelCell}>
                    {hasData ? (
                      <Text style={styles.xAxisLabel}>
                        {data[index].day}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Month label below the axis */}
            {data.length > 0 && (
              <Text style={styles.monthLabel}>{data[0].month}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const recordingService = useRecordingService();
  const lessonService = useLessonService();
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    lessonsCompleted: 0,
    playsessionsRecorded: 0,
    currentStreak: 0,
  });
  const [recordingDates, setRecordingDates] = useState<Date[]>([]);
  const [lessonCompletionDates, setLessonCompletionDates] = useState<Date[]>([]);
  const [scoreData, setScoreData] = useState<Array<{ date: string; day: number; month: string; score: number }>>([]);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      setLoading(true);

      // Fetch recording data, lesson stats, and lesson list in parallel
      const [recordingsResponse, learningStats, lessonsResponse] = await Promise.all([
        recordingService.getRecordings(),
        lessonService.getLearningStats().catch(err => {
          console.log('Failed to load learning stats:', err);
          return null;
        }),
        lessonService.getLessons().catch(err => {
          console.log('Failed to load lessons:', err);
          return { lessons: [], userProgress: {} };
        })
      ]);

      const { recordings } = recordingsResponse;
      const { lessons } = lessonsResponse;

      // Extract completed lesson dates
      const completedLessons = lessons.filter(l => l.progress?.status === 'COMPLETED');
      const completedLessonDates = completedLessons
        .map(l => l.progress?.completedAt ? new Date(l.progress.completedAt) : null)
        .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

      setLessonCompletionDates(completedLessonDates);

      if (recordings && recordings.length > 0) {
        setLatestRecordingId(recordings[0].id);

        // Calculate streak based on BOTH lessons AND recordings
        const currentStreak = calculateCombinedStreak(recordings, completedLessonDates);

        // Calculate stats - use lesson completion count from learning stats
        setStats({
          lessonsCompleted: learningStats?.completedLessons || 0,
          playsessionsRecorded: recordings.length,
          currentStreak,
        });

        // Extract recording dates
        const dates = recordings
          .map((r) => new Date(r.createdAt))
          .filter((date) => !isNaN(date.getTime()));
        setRecordingDates(dates);

        // Fetch real score data from analyses
        const realScoreData = await fetchScoreData(recordings);
        setScoreData(realScoreData);
      } else {
        // No recordings, so streak is 0 (requires both lessons and recordings)
        setStats({
          lessonsCompleted: learningStats?.completedLessons || 0,
          playsessionsRecorded: 0,
          currentStreak: 0,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load progress data:', error);
      setLoading(false);
    }
  };

  /**
   * Calculate streak based on consecutive days with BOTH a completed lesson AND a recording
   */
  const calculateCombinedStreak = (recordings: any[], lessonCompletionDates: Date[]): number => {
    if (recordings.length === 0 || lessonCompletionDates.length === 0) return 0;

    // Get unique recording dates (as date strings)
    const recordingDateStrings = new Set(
      recordings
        .map((r) => new Date(r.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .map((date) => date.toDateString())
    );

    // Get unique lesson completion dates (as date strings)
    const lessonDateStrings = new Set(
      lessonCompletionDates.map((date) => date.toDateString())
    );

    // Find days that have BOTH a recording AND a completed lesson
    const completeDays = Array.from(recordingDateStrings)
      .filter((dateStr) => lessonDateStrings.has(dateStr))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completeDays.length === 0) return 0;

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Streak must start from today or yesterday
    if (completeDays[0] === today || completeDays[0] === yesterday) {
      streak = 1;
      let currentDate = new Date(completeDays[0]);

      // Count consecutive days backwards
      for (let i = 1; i < completeDays.length; i++) {
        const expectedDate = new Date(currentDate.getTime() - 86400000).toDateString();
        if (completeDays[i] === expectedDate) {
          streak++;
          currentDate = new Date(completeDays[i]);
        } else {
          break;
        }
      }
    }

    return streak;
  };

  const calculateStreak = (recordings: any[]): number => {
    if (recordings.length === 0) return 0;

    const dates = recordings
      .map((r) => new Date(r.createdAt))
      .filter((date) => !isNaN(date.getTime()))
      .map((date) => date.toDateString())
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Check if today or yesterday has a recording
    if (dates[0] === today || dates[0] === yesterday) {
      streak = 1;
      let currentDate = new Date(dates[0]);

      for (let i = 1; i < dates.length; i++) {
        const expectedDate = new Date(currentDate.getTime() - 86400000).toDateString();
        if (dates[i] === expectedDate) {
          streak++;
          currentDate = new Date(dates[i]);
        } else {
          break;
        }
      }
    }

    return streak;
  };

  const fetchScoreData = async (recordings: any[]): Promise<Array<{ date: string; day: number; month: string; score: number }>> => {
    // Group recordings by date
    const recordingsByDate: { [date: string]: any[] } = {};

    recordings.forEach((recording) => {
      const date = new Date(recording.createdAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!recordingsByDate[dateKey]) {
        recordingsByDate[dateKey] = [];
      }
      recordingsByDate[dateKey].push(recording);
    });

    // Get highest score per day (overallScore is now stored in recording data)
    const scoreData = Object.entries(recordingsByDate).map(([dateKey, dayRecordings]) => {
      // Find highest score for the day
      let highestScore = 0;

      dayRecordings.forEach((recording) => {
        if (recording.overallScore && recording.overallScore > highestScore) {
          highestScore = recording.overallScore;
        }
      });

      const date = new Date(dateKey);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      return {
        date: dateKey,
        day: date.getDate(),
        month: monthNames[date.getMonth()],
        score: highestScore,
        sortKey: dateKey,
      };
    });

    // Filter out days with no scores and sort by date
    const filteredData = scoreData
      .filter(item => item.score > 0)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ date, day, month, score }) => ({ date, day, month, score }));

    // Limit to last 15 data points
    return filteredData.slice(-15);
  };

  const handleViewReport = () => {
    if (latestRecordingId) {
      navigation.navigate('Report', { recordingId: latestRecordingId });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8C49D5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Progress</Text>

        {/* Header with Dragon Icon and Text */}
        <View style={styles.headerSection}>
          <View style={styles.dragonIconContainer}>
            <Image
              source={require('../../assets/images/dragon_image.png')}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerText}>
              Look how far you've come! Keep up the amazing work.
            </Text>
          </View>
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <StatCard value={stats.lessonsCompleted} label="Lessons completed" />
          <StatCard value={stats.playsessionsRecorded} label="Play sessions" />
          <StatCard value={stats.currentStreak} label="Current Streak" />
        </View>

        {/* Calendar */}
        <CalendarView recordingDates={recordingDates} lessonCompletionDates={lessonCompletionDates} />

        {/* Score chart */}
        <ScoreChart data={scoreData} />

        {/* View Last Report Button */}
        <View style={styles.buttonContainer}>
          {latestRecordingId ? (
            <Button onPress={handleViewReport} variant="primary">
              View Lastest Report
            </Button>
          ) : (
            <Text style={styles.noRecordingsText}>
              No recordings yet. Record a session to see your report!
            </Text>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    marginBottom: 16,
  },
  headerSection: {
    paddingTop: 24,
    marginBottom: 12,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  calendarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 12,
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
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 16,
  },
  chartWrapper: {
    flexDirection: 'row',
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 24,
  },
  axisLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
  },
  chartSvgContainer: {
    flex: 1,
  },
  xAxisLabelsContainer: {
    marginTop: 8,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisLabelCell: {
    flex: 1,
    alignItems: 'center',
  },
  xAxisLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
  },
  monthLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 0,
  },
  noDataContainer: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 24,
  },
  noRecordingsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  bottomSpacer: {
    height: 24,
  },
});
