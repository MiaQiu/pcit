/**
 * EmotionTimelineChart
 * The child's outburst level over a screen-time ending, from
 * moduleCoaching.emotionTimeline: a smooth curve over a continuous 0-5 scale
 * whose level labels (Calm … Hitting) are guides, shown only up to the
 * session's peak. Callouts (moduleCoaching.emotionCallouts) mark the moments
 * the coaching is about; the moments are listed below.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Path, Circle, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { REPORT_CARD_COLORS } from './ReportCard';
import type { EmotionCallout, EmotionTimelinePoint } from '../constants/learnModules';

const MAX_LEVEL = 5;
const MIN_TOP_LEVEL = 2; // a mild session still shows up to Whining
const PLOT_HEIGHT = 150;
const PAD = { right: 14, bottom: 26, left: 62 };
const CALLOUT_ROW = 24; // height of one row of callout pills above the plot
const GRID_COLOR = '#EDE6F3';
const AXIS_TEXT_COLOR = '#7A6252';
// Calm green → aggression red, one per whole level.
const LEVEL_COLORS = ['#4CAF7A', '#9BC53D', '#F2C14E', '#F28C38', '#E5533D', '#B3261E'];
const CALLOUT_COLORS: Record<EmotionCallout['kind'], string> = {
  trigger: '#D64545',
  fuel:    '#E39B2D',
  calm:    '#2F8F6B',
};

const clock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const levelColor = (level: number) => LEVEL_COLORS[Math.min(MAX_LEVEL, Math.max(0, Math.round(level)))];

// Monotone cubic (Fritsch–Carlson) through the points: smooth, and never
// overshoots above the peak or below calm between two points.
const smoothPath = (pts: { x: number; y: number }[]) => {
  const n = pts.length;
  if (n < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const slope = pts.slice(1).map((p, i) => (dx[i] ? (p.y - pts[i].y) / dx[i] : 0));
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      tangent[i] = k * a * slope[i];
      tangent[i + 1] = k * b * slope[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += ` C${pts[i].x + third},${pts[i].y + tangent[i] * third} ${pts[i + 1].x - third},${pts[i + 1].y - tangent[i + 1] * third} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

interface EmotionTimelineChartProps {
  points: EmotionTimelinePoint[];
  callouts?: EmotionCallout[];
}

export const EmotionTimelineChart: React.FC<EmotionTimelineChartProps> = ({ points: rawPoints, callouts: rawCallouts = [] }) => {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [showMoments, setShowMoments] = useState(false);

  const points = rawPoints
    .filter(p => Number.isFinite(p.seconds) && Number.isFinite(p.level))
    .map(p => ({ ...p, level: Math.min(MAX_LEVEL, Math.max(0, p.level)) }))
    .sort((a, b) => a.seconds - b.seconds);
  if (points.length < 2) return null;

  const startSec = points[0].seconds;
  const endSec = points[points.length - 1].seconds;
  const span = Math.max(1, endSec - startSec);
  const callouts = rawCallouts.filter(c => c.seconds >= startSec && c.seconds <= endSec).slice(0, 2);

  // Scale tops out at the session's peak, rounded up (labels stop there too).
  const peak = Math.max(...points.map(p => p.level));
  const topLevel = Math.min(MAX_LEVEL, Math.max(MIN_TOP_LEVEL, Math.ceil(peak)));

  const padTop = 10 + callouts.length * CALLOUT_ROW;
  const chartHeight = padTop + PLOT_HEIGHT + PAD.bottom;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const x = (s: number) => PAD.left + ((s - startSec) / span) * plotW;
  const y = (level: number) => padTop + (1 - level / topLevel) * PLOT_HEIGHT;

  const xy = points.map(p => ({ x: x(p.seconds), y: y(p.level) }));
  const linePath = smoothPath(xy);
  const baseline = y(0);
  const areaPath = `${linePath} L${x(endSec)},${baseline} L${x(startSec)},${baseline} Z`;
  const xTicks = [startSec, startSec + span / 2, endSec];

  // The rise the coaching is about: from the trigger to where the curve stops climbing.
  const trigger = callouts.find(c => c.kind === 'trigger');
  const riseEnd = (() => {
    if (!trigger) return null;
    const after = points.filter(p => p.seconds >= trigger.seconds);
    let i = 0;
    while (i + 1 < after.length && after[i + 1].level > after[i].level) i++;
    return i > 0 ? after[i].seconds : null;
  })();
  const riseBand = trigger && riseEnd != null ? { from: trigger.seconds, to: riseEnd } : null;

  const calloutTimes = new Set(callouts.map(c => c.seconds));
  // Rows below the chart: the points, plus any callout that isn't at a point.
  const rows = [
    ...points.map(p => ({ seconds: p.seconds, label: p.label, color: levelColor(p.level), callout: calloutTimes.has(p.seconds) })),
    ...callouts
      .filter(c => !points.some(p => p.seconds === c.seconds))
      .map(c => ({ seconds: c.seconds, label: c.label, color: CALLOUT_COLORS[c.kind], callout: true })),
  ].sort((a, b) => a.seconds - b.seconds);

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>{t('moduleReport.emotionTimeline')}</Text>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={chartHeight}>
            <Defs>
              <LinearGradient id="emotionFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.mainPurple} stopOpacity={0.26} />
                <Stop offset="1" stopColor={COLORS.mainPurple} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {riseBand && (
              <Rect x={x(riseBand.from)} y={padTop} width={Math.max(2, x(riseBand.to) - x(riseBand.from))} height={PLOT_HEIGHT}
                fill={CALLOUT_COLORS.trigger} opacity={0.08} />
            )}

            {/* Level guides, up to the session's peak */}
            {Array.from({ length: topLevel + 1 }, (_, level) => (
              <React.Fragment key={level}>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(level)} y2={y(level)} stroke={GRID_COLOR} strokeWidth={1} />
                <SvgText x={PAD.left - 8} y={y(level) + 4} fontSize={11} fill={AXIS_TEXT_COLOR} textAnchor="end">
                  {t(`moduleReport.emotionLevels.${level}`)}
                </SvgText>
              </React.Fragment>
            ))}

            {xTicks.map((s, i) => (
              <SvgText key={i} x={x(s)} y={chartHeight - 6} fontSize={11} fill={AXIS_TEXT_COLOR}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {clock(s)}
              </SvgText>
            ))}

            {/* Callouts: dashed line at the moment, label pill above the plot (one row each) */}
            {callouts.map((c, i) => {
              const color = CALLOUT_COLORS[c.kind];
              const cx = x(c.seconds);
              const pillW = Math.min(plotW, c.label.length * 6.4 + 18);
              const pillX = Math.min(Math.max(cx - pillW / 2, PAD.left), PAD.left + plotW - pillW);
              const pillY = 4 + i * CALLOUT_ROW;
              return (
                <React.Fragment key={i}>
                  <Line x1={cx} x2={cx} y1={pillY + 18} y2={baseline} stroke={color} strokeWidth={1.5} strokeDasharray="4,4" />
                  <Rect x={pillX} y={pillY} width={pillW} height={18} rx={9} fill={color} />
                  <SvgText x={pillX + pillW / 2} y={pillY + 13} fontSize={11} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
                    {c.label}
                  </SvgText>
                </React.Fragment>
              );
            })}

            <Path d={areaPath} fill="url(#emotionFill)" />
            <Path d={linePath} stroke={COLORS.mainPurple} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={xy[i].x} cy={xy[i].y} r={p.level === peak ? 6 : 4.5}
                fill={levelColor(p.level)} stroke="#FFFFFF" strokeWidth={1.5} />
            ))}
          </Svg>
        )}
      </View>

      {/* The moments behind the curve (collapsed by default); the ones the coaching is about in bold */}
      <TouchableOpacity style={styles.momentsToggle} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: showMoments }}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setShowMoments(v => !v);
        }}
      >
        <Text style={styles.momentsToggleText}>
          {t(showMoments ? 'moduleReport.hideMoments' : 'moduleReport.showMoments', { count: rows.length })}
        </Text>
        <Ionicons name={showMoments ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.mainPurple} />
      </TouchableOpacity>
      {showMoments && (
      <View style={styles.moments}>
        {rows.map((row, i) => (
          <View key={i} style={styles.momentRow}>
            <View style={[styles.momentDot, { backgroundColor: row.color }]} />
            <Text style={styles.momentTime}>{clock(row.seconds)}</Text>
            <Text style={[styles.momentLabel, row.callout && styles.momentLabelCallout]}>{row.label}</Text>
          </View>
        ))}
      </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  chartTitle: { fontFamily: FONTS.bold, fontSize: 15, lineHeight: 20, color: REPORT_CARD_COLORS.subtitle, marginBottom: 6 },
  momentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6, marginTop: 4 },
  momentsToggleText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.mainPurple },
  moments: { marginTop: 6, gap: 6 },
  momentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  momentDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  momentTime: { fontFamily: FONTS.bold, fontSize: 15, lineHeight: 22, color: REPORT_CARD_COLORS.subtitle, minWidth: 38 },
  momentLabel: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: REPORT_CARD_COLORS.title },
  momentLabelCallout: { fontFamily: FONTS.bold },
});
