/**
 * MilestoneTimeline Component
 * Displays historical milestone progress over time as a line chart
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import type { MilestoneHistoryResponse } from '@nora/core';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MilestoneTimelineProps {
  data: MilestoneHistoryResponse;
}

// Colors matching the plan spec
const ACHIEVED_COLOR = '#F59E0B'; // Gold
const TOTAL_COLOR = '#8C49D5'; // Purple (achieved + emerging)
const GRID_COLOR = '#E5E7EB';

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ data }) => {
  const chartWidth = SCREEN_WIDTH - 48 - 40; // padding + margins
  const chartHeight = 160;
  const leftPadding = 10;

  const { history } = data;

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Milestone Progress</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No milestone history yet</Text>
        </View>
      </View>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...history.map((h) => h.achievedCount + h.emergingCount),
    1 // Ensure minimum of 1 to avoid division by zero
  );

  // Round up to nice number for y-axis
  const yAxisMax = Math.ceil(maxValue / 5) * 5 || 5;

  const pointSpacing = history.length > 1 ? chartWidth / (history.length - 1) : chartWidth;

  // Calculate points for achieved line
  const achievedPoints = history.map((item, index) => {
    const x = leftPadding + index * pointSpacing;
    const y = chartHeight - (item.achievedCount / yAxisMax) * chartHeight;
    return { x, y };
  });

  // Calculate points for total line (achieved + emerging)
  const totalPoints = history.map((item, index) => {
    const x = leftPadding + index * pointSpacing;
    const total = item.achievedCount + item.emergingCount;
    const y = chartHeight - (total / yAxisMax) * chartHeight;
    return { x, y };
  });

  // Create path data for achieved line
  const achievedPathData = achievedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  // Create path data for total line
  const totalPathData = totalPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');

  // Format month labels
  const getMonthLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Milestone Progress</Text>
      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>{yAxisMax}</Text>
          <Text style={styles.axisLabel}>{Math.round(yAxisMax / 2)}</Text>
          <Text style={styles.axisLabel}>0</Text>
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
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
            {/* X-axis */}
            <Line
              x1={0}
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
            {/* Grid lines */}
            <Line
              x1={0}
              y1={chartHeight / 2}
              x2={chartWidth}
              y2={chartHeight / 2}
              stroke={GRID_COLOR}
              strokeWidth={1}
              strokeDasharray="4,4"
            />

            {/* Total line (purple) - draw first so achieved line is on top */}
            <Path
              d={totalPathData}
              stroke={TOTAL_COLOR}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {totalPoints.map((point, index) => (
              <Circle
                key={`total-${index}`}
                cx={point.x}
                cy={point.y}
                r={3}
                fill={TOTAL_COLOR}
              />
            ))}

            {/* Achieved line (gold) */}
            <Path
              d={achievedPathData}
              stroke={ACHIEVED_COLOR}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {achievedPoints.map((point, index) => (
              <Circle
                key={`achieved-${index}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={ACHIEVED_COLOR}
              />
            ))}
          </Svg>

          {/* X-axis labels */}
          <View style={styles.xAxisLabels}>
            {history.map((item, index) => (
              <Text
                key={index}
                style={[
                  styles.xAxisLabel,
                  { left: leftPadding + index * pointSpacing - 15, width: 30 },
                ]}
              >
                {getMonthLabel(item.date)}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: ACHIEVED_COLOR }]} />
          <Text style={styles.legendText}>Achieved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: TOTAL_COLOR }]} />
          <Text style={styles.legendText}>Total (incl. emerging)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
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
    paddingTop: 0,
    paddingBottom: 24,
  },
  axisLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    minWidth: 20,
  },
  chartSvgContainer: {
    flex: 1,
  },
  xAxisLabels: {
    position: 'relative',
    height: 20,
    marginTop: 8,
  },
  xAxisLabel: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  noDataContainer: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLine: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
  },
  legendText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
});

export default MilestoneTimeline;
