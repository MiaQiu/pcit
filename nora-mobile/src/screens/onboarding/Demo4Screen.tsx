import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = SCREEN_WIDTH * 0.62;

// ── Radar chart (pentagon — 5 axes) ────────────────────────────────────────
const SVG_SIZE = 210;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const MAX_R = 72;
const AXES_N = 5;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

// Clockwise from top: Language, Cognition, Social, Emotional, Connect
const DATA_CHILD:     number[] = [0.90, 0.82, 0.75, 0.68, 0.86];
const DATA_MILESTONE: number[] = [0.56, 0.52, 0.50, 0.44, 0.58];

function pt(i: number, value: number) {
  const angle = (2 * Math.PI * i) / AXES_N - Math.PI / 2;
  return { x: CX + MAX_R * value * Math.cos(angle), y: CY + MAX_R * value * Math.sin(angle) };
}

const toPoints = (values: number[]) =>
  values.map((v, i) => `${pt(i, v).x},${pt(i, v).y}`).join(' ');

const gridPoints = (level: number) =>
  Array.from({ length: AXES_N }, (_, i) => `${pt(i, level).x},${pt(i, level).y}`).join(' ');

// Per-axis: anchor and label offset direction
const LABEL_META: Array<{ anchor: 'middle' | 'start' | 'end'; dx: number; dy: number }> = [
  { anchor: 'middle', dx: 0,   dy: -16 }, // Language  (top)
  { anchor: 'start',  dx: 10,  dy: 0   }, // Cognition (top-right)
  { anchor: 'start',  dx: 10,  dy: 4   }, // Social    (bottom-right)
  { anchor: 'end',    dx: -10, dy: 4   }, // Emotional (bottom-left)
  { anchor: 'end',    dx: -10, dy: 0   }, // Connect   (left)
];

const RadarChart: React.FC<{ axes: string[] }> = ({ axes }) => (
  <Svg width={SVG_SIZE} height={SVG_SIZE}>
    {GRID_LEVELS.map((level) => (
      <Polygon key={level} points={gridPoints(level)} fill="none" stroke="#E5E7EB" strokeWidth={1} />
    ))}
    {Array.from({ length: AXES_N }, (_, i) => {
      const end = pt(i, 1);
      return <Line key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} stroke="#E5E7EB" strokeWidth={1} />;
    })}
    <Polygon
      points={toPoints(DATA_MILESTONE)}
      fill="none"
      stroke="#D97706"
      strokeWidth={1.5}
      strokeDasharray="4,3"
    />
    <Polygon
      points={toPoints(DATA_CHILD)}
      fill="rgba(139,92,246,0.22)"
      stroke="#7C3AED"
      strokeWidth={2}
    />
    {axes.map((label, i) => {
      const base = pt(i, 1);
      const { anchor, dx, dy } = LABEL_META[i];
      return (
        <SvgText
          key={i}
          x={base.x + dx}
          y={base.y + dy}
          textAnchor={anchor}
          fontSize={10}
          fontFamily="PlusJakartaSans_600SemiBold"
          fill="#374151"
        >
          {label}
        </SvgText>
      );
    })}
  </Svg>
);

// ── Screen ─────────────────────────────────────────────────────────────────
export const Demo4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  const radarAxes = [
    t('onboarding.demo4.axisLanguage'),
    t('onboarding.demo4.axisCognition'),
    t('onboarding.demo4.axisSocial'),
    t('onboarding.demo4.axisEmotional'),
    t('onboarding.demo4.axisConnect'),
  ];

  return (
    <DemoTemplate
      text={t('onboarding.demo4.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo3')}
      onNext={() => navigation.navigate('Demo5')}
    >
      <View style={styles.scene}>

        {/* Back card — report (left) */}
        <View style={[styles.card, styles.cardBack]}>
          <View style={styles.pill} />
          <Text style={styles.reportTitle}>{t('onboarding.demo4.reportTitle')}</Text>
          <Text style={styles.reportSubtitle}>{t('onboarding.demo4.reportSubtitle')}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeStar}>✦</Text>
            <Text style={styles.badgeText}>{t('onboarding.demo4.reportBadge')}</Text>
          </View>
          <Text style={styles.reportBody}>{t('onboarding.demo4.reportBody')}</Text>
        </View>

        {/* Front card — milestone chart (right) */}
        <View style={[styles.card, styles.cardFront]}>
          <View style={styles.pill} />
          <Text style={styles.milestoneTitle}>{t('onboarding.demo4.milestoneTitle')}</Text>
          <View style={styles.chartWrap}>
            <RadarChart axes={radarAxes} />
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendLine} />
              <Text style={styles.legendLabel}>{t('onboarding.demo4.legendChild')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDash} />
              <Text style={styles.legendLabel}>{t('onboarding.demo4.legendMilestone')}</Text>
            </View>
          </View>
        </View>

      </View>
    </DemoTemplate>
  );
};

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    height: 420,
    marginTop: 20,
    position: 'relative',
  },

  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardBack: {
    top: 0,
    left: 0,
    zIndex: 1,
  },
  cardFront: {
    top: 60,
    right: 0,
    zIndex: 2,
  },

  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },

  reportTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#111827',
    marginBottom: 4,
    lineHeight: 24,
  },
  reportSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 5,
    marginBottom: 10,
  },
  badgeStar: {
    fontSize: 11,
    color: '#7C3AED',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#7C3AED',
  },
  reportBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },

  milestoneTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
    lineHeight: 20,
  },
  chartWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#7C3AED',
  },
  legendDash: {
    width: 16,
    height: 0,
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderStyle: 'dashed',
  },
  legendLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#6B7280',
  },
});
