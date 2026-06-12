import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { RootStackNavigationProp } from '../navigation/types';
import amplitudeService from '../services/amplitudeService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const CORAL = '#D97558';
const GREEN = '#10B981';
const MIN_LOGS_FOR_INSIGHT = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbcLog {
  id: string;
  logType?: 'CHALLENGING' | 'POSITIVE';
  antecedents: string[];
  behaviors: string[];
  situations: string[];
  places: string[];
  persons: string[];
  consequences: string[];
  intensity?: number;
  durationBucket?: string;
  recordedAt: string;
  createdAt: string;
}

interface Insight {
  observation: string;
  validation: string;
  strategy: string;
  why: string;
}

interface InsightRecord {
  insightId: string;
  insight: Insight;
  followUpRating: number | null;
  followUpAt: string | null;
  createdAt: string;
}

// ─── Emoji maps ───────────────────────────────────────────────────────────────

const ANTECEDENT_EMOJI: Record<string, string> = {
  'My child was asked to do something': '📋',
  'My child was told no': '🛑',
  'My child was transitioning between activities': '🔄',
  'My child was tired or hungry': '😴',
  'My child was already upset or overwhelmed': '😤',
  'My child was already having strong emotions or feelings': '😤',
  'Something else happened first': '❓',
};
const SITUATION_EMOJI: Record<string, string> = {
  'Getting ready for school': '🎒',
  'Screen time': '📱',
  'Homework / academics': '📚',
  'Bedtime': '🌙',
  'Teasing / bullying': '😠',
  'Loud activity / crowds': '📣',
  'Something else': '❓',
};
const PLACE_EMOJI: Record<string, string> = {
  'Home': '🏠',
  'School': '🏫',
  'Extracurricular activity': '⚽',
  'Social situation': '👥',
  'Public place': '🌆',
  'New / unfamiliar location': '⚠️',
  'Somewhere else': '📍',
};
const PERSON_EMOJI: Record<string, string> = {
  'You': '🧑',
  'Sibling': '👶',
  'Another family member': '❤️',
  'Babysitter / childcare provider': '🧑‍🍼',
  'Teacher': '👩‍🏫',
  'Friend': '🤝',
  'No one': '🙅',
  'Someone else': '❓',
};
const BEHAVIOR_EMOJI: Record<string, string> = {
  'Yelling or screaming': '📢',
  'Crying or sobbing': '😢',
  'Arguing or talking back': '💬',
  'Hitting, kicking, or biting': '👊',
  'Throwing or breaking things': '💥',
  'Running away or hiding': '🏃',
  'Refusing to move / shutting down': '🧱',
  'Hurting themselves': '🩹',
  'Something else': '❓',
};
const CONSEQUENCE_EMOJI: Record<string, string> = {
  "My child didn't have to do what they were asked": '😌',
  'My child had to follow through with what they were asked': '✅',
  'My child got what they wanted after being told no': '🎁',
  "My child didn't get what they wanted": '🚫',
  'My child got more attention (even if I was upset)': '👀',
  "My child didn't get additional attention": '😐',
  'Something else happened after': '❓',
};

function emojiFor(tag: string, map: Record<string, string>): string {
  return map[tag] ?? '❓';
}

function shortLabel(tag: string): string {
  return tag.replace(/^My child\s+/i, '');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type LogField = 'antecedents' | 'behaviors' | 'situations' | 'places' | 'persons' | 'consequences';

function topTag(logs: AbcLog[], field: LogField): { tag: string; count: number } | null {
  const freq: Record<string, number> = {};
  for (const log of logs) {
    for (const tag of (log[field] ?? [])) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? { tag: entries[0][0], count: entries[0][1] } : null;
}

function thisWeekCounts(logs: AbcLog[]): number[] {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  const counts = new Array(7).fill(0);
  for (const log of logs) {
    const dSgt = new Date(new Date(log.recordedAt || log.createdAt).getTime() + 8 * 60 * 60 * 1000);
    if (dSgt >= monday) {
      const weekDay = dSgt.getUTCDay();
      counts[weekDay === 0 ? 6 : weekDay - 1]++;
    }
  }
  return counts;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Pattern card ─────────────────────────────────────────────────────────────

interface PatternCardData {
  title: string;
  emoji: string;
  tag: string;
  count: number;
  total: number;
}

const PatternCard: React.FC<PatternCardData & { cardWidth: number }> = ({ title, emoji, tag, count, total, cardWidth }) => (
  <View style={[styles.patternCard, { width: cardWidth }]}>
    <Text style={styles.patternCardTitle}>{title}</Text>
    <Text style={styles.patternCardEmoji}>{emoji}</Text>
    <Text style={styles.patternCardTag} numberOfLines={2}>{shortLabel(tag)}</Text>
    <Text style={styles.patternCardCount}>{count} of {total} logs</Text>
  </View>
);

// ─── Insight card (inline, replaces modal + button) ───────────────────────────

interface InsightCardProps {
  insight: Insight | null;
  loading: boolean;
  followUpRecord: InsightRecord | null;
  followUpSubmitted: boolean;
  followUpLoading: boolean;
  onFollowUp: (rating: number) => void;
  onRefresh: () => void;
}

const InsightCard: React.FC<InsightCardProps> = ({
  insight, loading, followUpRecord, followUpSubmitted, followUpLoading, onFollowUp, onRefresh,
}) => {
  if (loading) {
    return (
      <View style={insightStyles.card}>
        <View style={insightStyles.header}>
          <Ionicons name="bulb-outline" size={16} color={COLORS.mainPurple} />
          <Text style={insightStyles.headerTitle}>Nora's insight</Text>
        </View>
        <View style={insightStyles.loadingWrap}>
          <ActivityIndicator color={COLORS.mainPurple} size="small" />
          <Text style={insightStyles.loadingText}>Reading your logs…</Text>
        </View>
      </View>
    );
  }

  if (!insight) {
    return (
      <View style={insightStyles.card}>
        <View style={insightStyles.header}>
          <Ionicons name="bulb-outline" size={16} color={COLORS.mainPurple} />
          <Text style={insightStyles.headerTitle}>Nora's insight</Text>
          <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name="refresh-outline" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        <Text style={insightStyles.errorText}>Could not load. Tap ↻ to retry.</Text>
      </View>
    );
  }

  const insightDate = followUpRecord?.createdAt
    ? new Date(followUpRecord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={insightStyles.card}>
      {/* Header */}
      <View style={insightStyles.header}>
        <View style={insightStyles.headerLeft}>
          <Ionicons name="bulb-outline" size={16} color={COLORS.mainPurple} />
          <Text style={insightStyles.headerTitle}>Nora's insight</Text>
          {insightDate && <Text style={insightStyles.headerDate}>{insightDate}</Text>}
        </View>
        <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="refresh-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Sections */}
      <InsightSection label="What Nora noticed" text={insight.observation} />
      <InsightSection label="Validation" text={insight.validation} />
      <InsightSection label="Try this" text={insight.strategy} />
      <InsightSection label="Why it works" text={insight.why} />

      {/* Follow-up rating */}
      <View style={insightStyles.divider} />
      {followUpSubmitted ? (
        <View style={insightStyles.followUpDone}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.mainPurple} />
          <Text style={insightStyles.followUpDoneText}>Feedback saved — Nora will use this for the next tip</Text>
        </View>
      ) : (
        <View style={insightStyles.followUp}>
          <Text style={insightStyles.followUpQ}>Did this help?</Text>
          <View style={insightStyles.followUpBtns}>
            {[
              { emoji: '😟', label: 'No', val: 1 },
              { emoji: '😐', label: 'A bit', val: 3 },
              { emoji: '😊', label: 'Yes!', val: 5 },
            ].map(({ emoji, label, val }) => (
              <TouchableOpacity
                key={val}
                style={insightStyles.followUpBtn}
                onPress={() => onFollowUp(val)}
                disabled={followUpLoading}
                activeOpacity={0.8}
              >
                <Text style={insightStyles.followUpEmoji}>{emoji}</Text>
                <Text style={insightStyles.followUpLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const InsightSection: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <View style={insightStyles.section}>
    <Text style={insightStyles.sectionLabel}>{label}</Text>
    <Text style={insightStyles.sectionText}>{text}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const LogScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();
  const { width: screenWidth } = useWindowDimensions();

  const [logs, setLogs] = useState<AbcLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'challenges' | 'wins'>('challenges');

  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const insightFetchedRef = useRef(false);

  const [latestInsightRecord, setLatestInsightRecord] = useState<InsightRecord | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpSubmitted, setFollowUpSubmitted] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInsight = useCallback(async (force = false) => {
    if (insightLoading && !force) return;
    setInsightLoading(true);
    try {
      const r = await authService.authenticatedRequest(`${API_URL}/api/abc-logs/insights`);
      if (!r.ok) return;
      const data = await r.json();
      if (!data.needsMoreLogs) {
        setInsight(data.insight ?? null);
        if (data.insightId && !latestInsightRecord) {
          setLatestInsightRecord({ insightId: data.insightId, insight: data.insight, followUpRating: null, followUpAt: null, createdAt: new Date().toISOString() });
        }
      }
    } catch {
      // non-fatal
    } finally {
      setInsightLoading(false);
    }
  }, [authService, latestInsightRecord]);

  const fetchLatestInsightRecord = useCallback(async () => {
    try {
      const r = await authService.authenticatedRequest(`${API_URL}/api/abc-logs/insights/latest`);
      if (!r.ok) return;
      const data = await r.json();
      setLatestInsightRecord(data);
      if (data.followUpRating != null) setFollowUpSubmitted(true);
    } catch {
      // non-fatal
    }
  }, [authService]);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await authService.authenticatedRequest(`${API_URL}/api/abc-logs?limit=100`);
      const data = await r.json();
      const allLogs: AbcLog[] = data.logs ?? [];
      setLogs(allLogs);

      // Auto-fetch insight once we know there are enough logs — no button needed
      const challengingCount = allLogs.filter(l => !l.logType || l.logType === 'CHALLENGING').length;
      if (challengingCount >= MIN_LOGS_FOR_INSIGHT && !insightFetchedRef.current) {
        insightFetchedRef.current = true;
        fetchInsight();
        fetchLatestInsightRecord();
      }
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authService, fetchInsight, fetchLatestInsightRecord]);

  const submitFollowUp = async (rating: number) => {
    const id = latestInsightRecord?.insightId;
    if (!id || followUpLoading) return;
    setFollowUpLoading(true);
    try {
      await authService.authenticatedRequest(`${API_URL}/api/abc-logs/insights/${id}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      amplitudeService.trackEvent('abc_insight_followup_submitted', { rating });
      setFollowUpSubmitted(true);
      setLatestInsightRecord(prev => prev ? { ...prev, followUpRating: rating } : prev);
    } catch {
      // non-fatal
    } finally {
      setFollowUpLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    amplitudeService.trackScreenView('Log Insights');
    insightFetchedRef.current = false; // allow re-fetch on each focus
    fetchLogs();
  }, []));

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogPress = () => {
    amplitudeService.trackEvent('Log Screen Add Pressed');
    navigation.push('ABCLog', { mode: 'challenging', source: 'log_tab' });
  };

  const handleLogWinPress = () => {
    amplitudeService.trackEvent('Log Screen Log Win Pressed');
    navigation.push('ABCLog', { mode: 'positive', source: 'log_tab' });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const cardWidth = (screenWidth - 32 - 12) / 2;
  const challengingLogs = logs.filter(l => !l.logType || l.logType === 'CHALLENGING');
  const positiveLogs = logs.filter(l => l.logType === 'POSITIVE');
  const weekCounts = thisWeekCounts(challengingLogs);
  const daysWithLogs = weekCounts.filter(n => n > 0).length;
  const incidentsThisWeek = weekCounts.reduce((a, b) => a + b, 0);
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const recentLogs = challengingLogs.slice(0, 5);
  const hasEnoughForPatterns = challengingLogs.length >= MIN_LOGS_FOR_INSIGHT;

  const topAntecedent = topTag(challengingLogs, 'antecedents');
  const topBehavior = topTag(challengingLogs, 'behaviors');
  const topConsequence = topTag(challengingLogs, 'consequences');
  const topSituation = topTag(challengingLogs, 'situations');
  const topPlace = topTag(challengingLogs, 'places');
  const topPerson = topTag(challengingLogs, 'persons');

  const winFreq: Record<string, number> = {};
  for (const log of positiveLogs) {
    for (const tag of log.antecedents) { winFreq[tag] = (winFreq[tag] ?? 0) + 1; }
  }
  const topWins = Object.entries(winFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const patternCards: (PatternCardData & { cardWidth: number })[] = ([
    topAntecedent && { title: 'Top Trigger', emoji: emojiFor(topAntecedent.tag, ANTECEDENT_EMOJI), tag: topAntecedent.tag, count: topAntecedent.count, total: challengingLogs.length },
    topBehavior && { title: 'Common Behavior', emoji: emojiFor(topBehavior.tag, BEHAVIOR_EMOJI), tag: topBehavior.tag, count: topBehavior.count, total: challengingLogs.length },
    topConsequence && { title: 'What followed', emoji: emojiFor(topConsequence.tag, CONSEQUENCE_EMOJI), tag: topConsequence.tag, count: topConsequence.count, total: challengingLogs.length },
    topSituation && { title: 'When it happens', emoji: emojiFor(topSituation.tag, SITUATION_EMOJI), tag: topSituation.tag, count: topSituation.count, total: challengingLogs.length },
    topPlace && { title: 'Where it happens', emoji: emojiFor(topPlace.tag, PLACE_EMOJI), tag: topPlace.tag, count: topPlace.count, total: challengingLogs.length },
    topPerson && { title: 'Who was there', emoji: emojiFor(topPerson.tag, PERSON_EMOJI), tag: topPerson.tag, count: topPerson.count, total: challengingLogs.length },
  ] as (PatternCardData | false)[])
    .filter(Boolean)
    .map((card, _, arr) => ({
      ...(card as PatternCardData),
      cardWidth: arr.length % 2 !== 0 && arr.indexOf(card as PatternCardData) === arr.length - 1
        ? screenWidth - 32
        : cardWidth,
    }));

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.mainPurple} /></View>
      </SafeAreaView>
    );
  }

  // ── Shared header + tab toggle ─────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Behavior Log</Text>
      <TouchableOpacity
        style={[styles.addBtn, activeTab === 'wins' && { backgroundColor: GREEN }]}
        onPress={activeTab === 'wins' ? handleLogWinPress : handleLogPress}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addBtnText}>{activeTab === 'wins' ? 'Log Win' : 'Add'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabToggle = () => (
    <View style={styles.tabToggle}>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'challenges' && styles.tabBtnActive]}
        onPress={() => setActiveTab('challenges')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabBtnText, activeTab === 'challenges' && styles.tabBtnTextActive]}>Tough moments</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'wins' && styles.tabBtnActiveGreen]}
        onPress={() => setActiveTab('wins')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabBtnText, activeTab === 'wins' && styles.tabBtnTextActiveGreen]}>Bright spots</Text>
        {positiveLogs.length > 0 && (
          <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{positiveLogs.length}</Text></View>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  if (logs.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {renderHeader()}
        {renderTabToggle()}
        <View style={styles.emptyWrap}>
          <Ionicons name="journal-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Nothing logged yet</Text>
          <Text style={styles.emptyBody}>Log a tough moment or a win. Nora will start spotting patterns once you have a few of each.</Text>
          <View style={styles.emptyBtnRow}>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: COLORS.mainPurple }]} onPress={handleLogPress} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Log a moment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: GREEN }]} onPress={handleLogWinPress} activeOpacity={0.85}>
              <Ionicons name="star-outline" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Log a win</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {renderHeader()}
      {renderTabToggle()}

      {activeTab === 'wins' ? (

        /* ── Bright spots tab ─────────────────────────────────────────── */
        positiveLogs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="star-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No wins logged yet</Text>
            <Text style={styles.emptyBody}>
              Catch the moments your child did something well. PCIT works best when you track the good along with the tough.
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: GREEN }]} onPress={handleLogWinPress} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Log your first win</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLogs(true)} tintColor={GREEN} />}
          >
            <Text style={styles.sectionTitle}>Bright spots</Text>
            <Text style={styles.sectionSubtitle}>{positiveLogs.length} win{positiveLogs.length !== 1 ? 's' : ''} logged</Text>

            {topWins.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>MOST COMMON</Text>
                {topWins.map(([tag, count], idx) => (
                  <View key={tag} style={[styles.recentRow, idx < topWins.length - 1 && styles.recentRowBorder]}>
                    <View style={styles.winCountBadge}><Text style={styles.winCountText}>{count}</Text></View>
                    <Text style={[styles.recentTrigger, { flex: 1 }]} numberOfLines={2}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionHeader}>RECENT WINS</Text>
              {positiveLogs.slice(0, 8).map((log, idx) => (
                <View key={log.id} style={[styles.recentRow, idx < Math.min(positiveLogs.length, 8) - 1 && styles.recentRowBorder]}>
                  <Text style={styles.recentDate}>{formatDate(log.recordedAt || log.createdAt)}</Text>
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentTrigger} numberOfLines={1}>{log.antecedents[0] ?? '—'}</Text>
                    {log.antecedents.length > 1 && (
                      <Text style={styles.recentConsequence} numberOfLines={1}>+{log.antecedents.length - 1} more</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        )

      ) : (

        /* ── Tough moments tab ────────────────────────────────────────── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLogs(true)} tintColor={COLORS.mainPurple} />}
        >
          {challengingLogs.length === 0 ? (
            <View style={[styles.emptyWrap, { flex: 0, paddingTop: 40 }]}>
              <Ionicons name="journal-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No tough moments logged yet</Text>
              <Text style={styles.emptyBody}>Log a difficult moment and Nora will start spotting what triggers your child's behaviors.</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: COLORS.mainPurple }]} onPress={handleLogPress} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Log a behavior</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 1. This week — most immediate, shown first */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>THIS WEEK</Text>
                <View style={styles.weekRow}>
                  {DAY_LABELS.map((label, i) => (
                    <View key={label} style={styles.weekDayCol}>
                      <View style={[styles.weekDot, weekCounts[i] > 0 && styles.weekDotFilled]}>
                        {weekCounts[i] > 1 && <Text style={styles.weekDotCount}>{weekCounts[i]}</Text>}
                      </View>
                      <Text style={styles.weekDayLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.weekSummary}>
                  <Text style={styles.weekSummaryBold}>{daysWithLogs}</Text>
                  <Text style={styles.weekSummaryMuted}> of 7 days  ·  </Text>
                  <Text style={styles.weekSummaryBold}>{incidentsThisWeek}</Text>
                  <Text style={styles.weekSummaryMuted}> incident{incidentsThisWeek !== 1 ? 's' : ''} this week</Text>
                </Text>
              </View>

              {/* 2. Nora's insight (inline) OR building-toward-insight progress */}
              {hasEnoughForPatterns ? (
                <InsightCard
                  insight={insight}
                  loading={insightLoading}
                  followUpRecord={latestInsightRecord}
                  followUpSubmitted={followUpSubmitted}
                  followUpLoading={followUpLoading}
                  onFollowUp={submitFollowUp}
                  onRefresh={() => { insightFetchedRef.current = false; fetchInsight(true); }}
                />
              ) : (
                <View style={styles.buildingCard}>
                  <Ionicons name="analytics-outline" size={28} color={COLORS.mainPurple} style={{ marginBottom: 8 }} />
                  <Text style={styles.buildingTitle}>Building your child's profile</Text>
                  <Text style={styles.buildingBody}>
                    {MIN_LOGS_FOR_INSIGHT - challengingLogs.length} more log{MIN_LOGS_FOR_INSIGHT - challengingLogs.length !== 1 ? 's' : ''} and Nora can start spotting patterns.
                  </Text>
                  <View style={styles.buildingProgress}>
                    {Array.from({ length: MIN_LOGS_FOR_INSIGHT }).map((_, i) => (
                      <View key={i} style={[styles.buildingDot, i < challengingLogs.length && { backgroundColor: COLORS.mainPurple }]} />
                    ))}
                  </View>
                </View>
              )}

              {/* 3. Pattern grid — supporting evidence for the insight */}
              {hasEnoughForPatterns && patternCards.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Patterns</Text>
                  <Text style={styles.sectionSubtitle}>Based on {challengingLogs.length} logs</Text>
                  <View style={styles.patternGrid}>
                    {patternCards.map(card => (
                      <PatternCard key={card.title} {...card} />
                    ))}
                  </View>
                </>
              )}

              {/* Wins nudge — when no positive logs logged yet */}
              {positiveLogs.length === 0 && challengingLogs.length >= 2 && (
                <TouchableOpacity style={styles.winsNudge} onPress={handleLogWinPress} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winsNudgeTitle}>Catch the bright spots too</Text>
                    <Text style={styles.winsNudgeBody}>PCIT works best when you track both. Tap to log a moment your child handled well.</Text>
                  </View>
                  <Ionicons name="star-outline" size={24} color={GREEN} style={{ marginLeft: 12 }} />
                </TouchableOpacity>
              )}

              {/* 4. Recent logs — raw history, last */}
              {recentLogs.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionHeader}>RECENT</Text>
                  {recentLogs.map((log, idx) => (
                    <View key={log.id} style={[styles.recentRow, idx < recentLogs.length - 1 && styles.recentRowBorder]}>
                      <Text style={styles.recentDate}>{formatDate(log.recordedAt || log.createdAt)}</Text>
                      <View style={styles.recentTextWrap}>
                        <Text style={styles.recentTrigger} numberOfLines={1}>
                          {log.behaviors[0] ? shortLabel(log.behaviors[0]) : shortLabel(log.antecedents[0] ?? '—')}
                        </Text>
                        {log.antecedents[0] && log.behaviors[0] ? (
                          <Text style={styles.recentConsequence} numberOfLines={1}>after {shortLabel(log.antecedents[0])}</Text>
                        ) : log.consequences[0] ? (
                          <Text style={styles.recentConsequence} numberOfLines={1}>{shortLabel(log.consequences[0])}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Insight card styles ──────────────────────────────────────────────────────

const insightStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D8FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.mainPurple },
  headerDate: { fontFamily: FONTS.regular, fontSize: 12, color: '#9CA3AF' },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontFamily: FONTS.regular, fontSize: 14, color: '#6B7280' },
  errorText: { fontFamily: FONTS.regular, fontSize: 14, color: '#9CA3AF', paddingVertical: 8 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: CORAL,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionText: { fontFamily: FONTS.regular, fontSize: 15, color: '#374151', lineHeight: 23 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },
  followUp: {},
  followUpQ: { fontFamily: FONTS.bold, fontSize: 13, color: '#6B7280', marginBottom: 10 },
  followUpBtns: { flexDirection: 'row', gap: 10 },
  followUpBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  followUpEmoji: { fontSize: 22, marginBottom: 2 },
  followUpLabel: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#6B7280' },
  followUpDone: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  followUpDoneText: { fontFamily: FONTS.regular, fontSize: 13, color: '#6B7280', flex: 1 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF8F3' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 24, color: '#1E2939' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.mainPurple, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#fff' },

  tabToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, gap: 6 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnActiveGreen: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#9CA3AF' },
  tabBtnTextActive: { color: COLORS.mainPurple },
  tabBtnTextActiveGreen: { color: GREEN },
  tabBadge: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tabBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  sectionTitle: { fontFamily: FONTS.bold, fontSize: 18, color: '#1E2939', marginBottom: 2 },
  sectionSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: '#9CA3AF', marginBottom: 14 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#6B7280', letterSpacing: 0.8, marginBottom: 14 },

  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  patternCard: {
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  patternCardTitle: { fontFamily: FONTS.bold, fontSize: 11, color: '#6B7280', marginBottom: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  patternCardEmoji: { fontSize: 34, marginBottom: 10, lineHeight: 42 },
  patternCardTag: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#1E2939', textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  patternCardCount: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  buildingCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#E9D8FF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  buildingTitle: { fontFamily: FONTS.bold, fontSize: 15, color: '#1E2939', marginBottom: 4 },
  buildingBody: { fontFamily: FONTS.regular, fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 14 },
  buildingProgress: { flexDirection: 'row', gap: 8 },
  buildingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },

  winsNudge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  winsNudgeTitle: { fontFamily: FONTS.bold, fontSize: 14, color: '#065F46', marginBottom: 3 },
  winsNudgeBody: { fontFamily: FONTS.regular, fontSize: 13, color: '#047857', lineHeight: 18 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  weekDotFilled: { backgroundColor: COLORS.mainPurple, borderColor: COLORS.mainPurple },
  weekDotCount: { fontFamily: FONTS.bold, fontSize: 10, color: '#fff' },
  weekDayLabel: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA3AF' },
  weekSummary: { textAlign: 'center' },
  weekSummaryBold: { fontFamily: FONTS.bold, fontSize: 14, color: '#1E2939' },
  weekSummaryMuted: { fontFamily: FONTS.regular, fontSize: 14, color: '#6B7280' },

  recentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentDate: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#9CA3AF', width: 48, paddingTop: 1 },
  recentTextWrap: { flex: 1 },
  recentTrigger: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#1E2939' },
  recentConsequence: { fontFamily: FONTS.regular, fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  winCountBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  winCountText: { fontFamily: FONTS.bold, fontSize: 13, color: GREEN },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 20, color: '#1E2939' },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#fff' },
});
