/**
 * QuickGuideScreen
 * A single-topic "quick guide" reached from LearnScreen_v2's Quick Guides
 * section. Each guide is a hero illustration + a two-line title + a short
 * stack of copy cards, ending on a highlighted takeaway card.
 *
 * Card copy supports inline accent markers: **text** or ~~text~~ → purple accent.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';

type GuideKey = 'why5mins' | 'whyRecord';

interface GuideCardConfig {
  key: string;
  bodyKey?: string;
  highlight?: boolean;
}

interface GuideConfig {
  image: ReturnType<typeof require>;
  imageAspectRatio: number;
  imageWidth: number;
  cards: GuideCardConfig[];
}

const GUIDES: Record<GuideKey, GuideConfig> = {
  why5mins: {
    image: require('../../assets/images/new onboarding/why5mins.png'),
    imageAspectRatio: 916 / 960,
    imageWidth: 210,
    cards: [
      { key: 'card1' },
      { key: 'card2' },
      { key: 'card3' },
      { key: 'card4', highlight: true },
    ],
  },
  whyRecord: {
    image: require('../../assets/images/new onboarding/whyrecord.png'),
    imageAspectRatio: 412 / 546,
    imageWidth: 172,
    cards: [
      { key: 'card1', bodyKey: 'card1Body' },
      { key: 'card2' },
      { key: 'card3', highlight: true },
    ],
  },
};

// Splits copy into plain runs and **accent** / ~~accent~~ runs.
const renderRichText = (raw: string, baseStyle: any, accentStyle: any) => {
  const parts = raw.split(/(\*\*[^*]+\*\*|~~[^~]+~~)/g);
  return parts.filter(Boolean).map((part, i) => {
    const isAccent =
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('~~') && part.endsWith('~~'));
    return (
      <Text key={i} style={isAccent ? accentStyle : baseStyle}>
        {isAccent ? part.slice(2, -2) : part}
      </Text>
    );
  });
};

export const QuickGuideScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuickGuide'>>();
  const { t } = useTranslation();

  const guide = route.params.guide as GuideKey;
  const config = GUIDES[guide];
  const base = `learnV2.quickGuides.${guide}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <View style={styles.headerTextOverlay}>
            <Text style={styles.title}>{t(`${base}.titleLine1`)}</Text>
            <Text style={[styles.title, styles.titleAccent]}>{t(`${base}.titleLine2`)}</Text>
          </View>
          <Image
            source={config.image}
            style={{
              marginRight: -20,
              width: config.imageWidth,
              height: config.imageWidth / config.imageAspectRatio,
            }}
            resizeMode="contain"
          />
        </View>

        {config.cards.map(card => (
          <View key={card.key} style={[styles.card, card.highlight && styles.cardHighlight]}>
            <Text style={[styles.cardText, card.highlight && styles.cardTextHighlight]}>
              {renderRichText(
                t(`${base}.${card.key}`),
                card.highlight ? styles.cardTextHighlight : styles.cardText,
                card.highlight ? styles.cardTextHighlight : styles.cardAccent,
              )}
            </Text>
            {card.bodyKey && (
              <Text style={styles.cardBody}>{t(`${base}.${card.bodyKey}`)}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTextOverlay: {
    flex: 1,
    paddingLeft: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  titleAccent: {
    color: COLORS.mainPurple,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHighlight: {
    backgroundColor: '#F1E9FB',
    borderColor: '#F1E9FB',
    alignItems: 'center',
  },
  cardText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 25,
    color: COLORS.textDark,
  },
  cardAccent: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 25,
    color: COLORS.mainPurple,
  },
  cardTextHighlight: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    lineHeight: 28,
    color: COLORS.mainPurple,
    textAlign: 'center',
  },
  cardBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginTop: 12,
  },
});
