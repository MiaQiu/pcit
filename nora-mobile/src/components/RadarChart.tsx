/**
 * RadarChart Component
 * Displays a 5-axis radar chart for developmental progress visualization
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Defs, Pattern, Path } from 'react-native-svg';
import { DevelopmentalProgress, DomainType } from '@nora/core';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RadarChartProps {
  data: DevelopmentalProgress;
  onDomainPress?: (domain: DomainType) => void;
}

const DOMAINS: DomainType[] = ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'];

// Chart configuration
const CHART_SIZE = Math.min(SCREEN_WIDTH - 80, 280);
const CENTER = CHART_SIZE / 2;
const MAX_RADIUS = CHART_SIZE / 2 - 40; // Leave room for labels
const GRID_LEVELS = 3; // Number of concentric pentagons

// Colors
const CHILD_FILL_COLOR = 'rgba(140, 73, 213, 0.3)'; // Purple at 30% opacity
const CHILD_STROKE_COLOR = '#8C49D5'; // Purple
const BENCHMARK_STROKE_COLOR = '#FF8C42'; // Orange
const GRID_COLOR = '#E5E7EB';
const LABEL_COLOR = '#1E2939';

/**
 * Convert polar coordinates to Cartesian
 * Angle starts from top (270 degrees in standard coords) and goes clockwise
 */
const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } => {
  // Start from top (-90 degrees) and go clockwise
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

/**
 * Calculate points for a regular pentagon at given radius
 */
const getPentagonPoints = (radius: number): Array<{ x: number; y: number }> => {
  return DOMAINS.map((_, index) => {
    const angle = (index * 360) / DOMAINS.length;
    return polarToCartesian(CENTER, CENTER, radius, angle);
  });
};

/**
 * Convert points array to SVG polygon points string
 */
const pointsToString = (points: Array<{ x: number; y: number }>): string => {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
};

/**
 * Get label position with offset for better readability
 */
const getLabelPosition = (index: number): { x: number; y: number; textAnchor: 'start' | 'middle' | 'end' } => {
  const angle = (index * 360) / DOMAINS.length;
  const labelRadius = MAX_RADIUS + 24;
  const pos = polarToCartesian(CENTER, CENTER, labelRadius, angle);

  // Determine text anchor based on position
  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  if (angle > 45 && angle < 135) {
    textAnchor = 'start'; // Right side
  } else if (angle > 225 && angle < 315) {
    textAnchor = 'end'; // Left side
  }

  return { ...pos, textAnchor };
};

export const RadarChart: React.FC<RadarChartProps> = ({ data, onDomainPress }) => {
  // Calculate normalized values for each domain
  // 100% = all milestones in that domain (total)
  // Child's value = (achieved + 0.5 * emerging) / total
  // Emerging milestones count as 50% progress
  // Benchmark value = benchmark / total
  const childValues = DOMAINS.map((domain) => {
    const domainData = data.domains[domain];
    if (!domainData || domainData.total === 0) {
      return 0;
    }
    const effectiveProgress = domainData.achieved + (domainData.emerging * 0.5);
    return (effectiveProgress / domainData.total) * 100;
  });

  const benchmarkValues = DOMAINS.map((domain) => {
    const domainData = data.domains[domain];
    if (!domainData || domainData.total === 0) {
      return 0;
    }
    return (domainData.benchmark / domainData.total) * 100;
  });

  // Calculate child data points
  const childPoints = childValues.map((value, index) => {
    const radius = (value / 100) * MAX_RADIUS;
    const angle = (index * 360) / DOMAINS.length;
    return polarToCartesian(CENTER, CENTER, radius, angle);
  });

  // Calculate benchmark points (variable per domain based on age)
  const benchmarkPoints = benchmarkValues.map((value, index) => {
    const radius = (value / 100) * MAX_RADIUS;
    const angle = (index * 360) / DOMAINS.length;
    return polarToCartesian(CENTER, CENTER, radius, angle);
  });

  // Grid lines at 33%, 66%, 100% of max (which is 50%, 100%, 150% of benchmark)
  const gridRadii = [
    MAX_RADIUS * 0.333,
    MAX_RADIUS * 0.667,
    MAX_RADIUS,
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Developmental Stage</Text>
      <View style={styles.chartWrapper}>
        <Svg width={CHART_SIZE} height={CHART_SIZE}>
          {/* Dashed line pattern for benchmark */}
          <Defs>
            <Pattern id="dashedPattern" patternUnits="userSpaceOnUse" width="8" height="8">
              <Path d="M0,4 L8,4" stroke={BENCHMARK_STROKE_COLOR} strokeWidth="2" strokeDasharray="4,4" />
            </Pattern>
          </Defs>

          {/* Grid lines - concentric pentagons */}
          {gridRadii.map((radius, i) => (
            <Polygon
              key={`grid-${i}`}
              points={pointsToString(getPentagonPoints(radius))}
              fill="none"
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}

          {/* Axis lines from center to each vertex */}
          {DOMAINS.map((_, index) => {
            const endPoint = polarToCartesian(CENTER, CENTER, MAX_RADIUS, (index * 360) / DOMAINS.length);
            return (
              <Line
                key={`axis-${index}`}
                x1={CENTER}
                y1={CENTER}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
            );
          })}

          {/* Benchmark polygon - dashed orange line */}
          <Polygon
            points={pointsToString(benchmarkPoints)}
            fill="none"
            stroke={BENCHMARK_STROKE_COLOR}
            strokeWidth={2}
            strokeDasharray="6,4"
          />

          {/* Child data polygon - filled purple */}
          <Polygon
            points={pointsToString(childPoints)}
            fill={CHILD_FILL_COLOR}
            stroke={CHILD_STROKE_COLOR}
            strokeWidth={2}
          />

          {/* Data points */}
          {childPoints.map((point, index) => (
            <Circle
              key={`point-${index}`}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={CHILD_STROKE_COLOR}
            />
          ))}
        </Svg>

        {/* Domain labels positioned outside the chart */}
        {DOMAINS.map((domain, index) => {
          const pos = getLabelPosition(index);
          const LabelWrapper = onDomainPress ? TouchableOpacity : View;
          return (
            <LabelWrapper
              key={domain}
              style={[
                styles.labelContainer,
                {
                  left: pos.x - 40,
                  top: pos.y - 10,
                  width: 80,
                  alignItems: pos.textAnchor === 'start' ? 'flex-start' : pos.textAnchor === 'end' ? 'flex-end' : 'center',
                },
              ]}
              {...(onDomainPress ? { onPress: () => onDomainPress(domain), activeOpacity: 0.7 } : {})}
            >
              <Text style={[styles.label, onDomainPress && styles.labelTappable]}>{domain}</Text>
            </LabelWrapper>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.legendChildLine]} />
          <Text style={styles.legendText}>Your Child</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.legendBenchmarkLine]} />
          <Text style={styles.legendText}>Age Benchmark</Text>
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
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chartWrapper: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    position: 'relative',
  },
  labelContainer: {
    position: 'absolute',
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: LABEL_COLOR,
    textAlign: 'center',
  },
  labelTappable: {
    textDecorationLine: 'underline',
    color: '#8C49D5',
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
  legendChildLine: {
    backgroundColor: CHILD_STROKE_COLOR,
  },
  legendBenchmarkLine: {
    backgroundColor: BENCHMARK_STROKE_COLOR,
    // Simulate dashed effect with multiple small views would be complex,
    // so we use a solid line but with opacity to differentiate
  },
  legendText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
});

export default RadarChart;
