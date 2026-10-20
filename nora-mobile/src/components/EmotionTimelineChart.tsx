/**
 * EmotionTimelineChart
 * The child's outburst level (0 calm – 5 aggression) over a screen-time
 * ending, from moduleCoaching.emotionTimeline, with the moments listed below.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { REPORT_CARD_COLORS } from './ReportCard';
import type { EmotionTimelinePoint } from '../constants/learnModules';

const MAX_LEVEL = 5;
const CHART_HEIGHT = 190;
const PAD = { top: 12, right: 14, bottom: 26, left: 58 };
const GRID_COLOR = '#EDE6F3';
const AXIS_TEXT_COLOR = '#7A6252';
// Calm green → aggression red, one per level.
const LEVEL_COLORS = ['#4CAF7A', '#9BC53D', '#F2C14E', '#F28C38', '#E5533D', '#B3261E'];

const clock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

interface EmotionTimelineChartProps {
  points: EmotionTimelinePoint[];
}

export const EmotionTimelineChart: React.FC<EmotionTimelineChartProps> = ({ points: rawPoints }) => {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const points = rawPoints
    .filter(p => Number.isFinite(p.seconds) && Number.isFinite(p.level))
    .map(p => ({ ...p, level: Math.min(MAX_LEVEL, Math.max(0, Math.round(p.level))) }))
    .sort((a, b) => a.seconds - b.seconds);
  if (points.length < 2) return null;

  const startSec = points[0].seconds;
  const span = Math.max(1, points[points.length - 1].seconds - startSec);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (s: number) => PAD.left + ((s - startSec) / span) * plotW;
  const y = (level: number) => PAD.top + (1 - level / MAX_LEVEL) * plotH;

  const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.seconds)},${y(p.level)}`).join(' ');
  const baseline = y(0);
  const areaPath = `${linePath} L${x(points[points.length - 1].seconds)},${baseline} L${x(startSec)},${baseline} Z`;
  const peak = Math.max(...points.map(p => p.level));
  const xTicks = [startSec, startSec + span / 2, startSec + span];

  return (
    <View style={styles.container}>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="emotionFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.mainPurple} stopOpacity={0.28} />
                <Stop offset="1" stopColor={COLORS.mainPurple} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {/* Level gridlines + labels */}
            {Array.from({ length: MAX_LEVEL + 1 }, (_, level) => (
              <React.Fragment key={level}>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(level)} y2={y(level)} stroke={GRID_COLOR} strokeWidth={1} />
                <SvgText x={PAD.left - 8} y={y(level) + 4} fontSize={11} fill={AXIS_TEXT_COLOR} textAnchor="end">
                  {t(`moduleReport.emotionLevels.${level}`)}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Time ticks */}
            {xTicks.map((s, i) => (
              <SvgText key={i} x={x(s)} y={CHART_HEIGHT - 6} fontSize={11} fill={AXIS_TEXT_COLOR}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {clock(s)}
              </SvgText>
            ))}

            <Path d={areaPath} fill="url(#emotionFill)" />
            <Path d={linePath} stroke={COLORS.mainPurple} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={x(p.seconds)} cy={y(p.level)} r={p.level === peak ? 6 : 4.5}
                fill={LEVEL_COLORS[p.level]} stroke="#FFFFFF" strokeWidth={1.5} />
            ))}
          </Svg>
        )}
      </View>

      {/* The moments behind each point */}
      <View style={styles.moments}>
        {points.map((p, i) => (
          <View key={i} style={styles.momentRow}>
            <View style={[styles.momentDot, { backgroundColor: LEVEL_COLORS[p.level] }]} />
            <Text style={styles.momentTime}>{clock(p.seconds)}</Text>
            <Text style={styles.momentLabel}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  moments: { marginTop: 8, gap: 6 },
  momentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  momentDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  momentTime: { fontFamily: FONTS.bold, fontSize: 15, lineHeight: 22, color: REPORT_CARD_COLORS.subtitle, minWidth: 38 },
  momentLabel: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: REPORT_CARD_COLORS.title },
});
