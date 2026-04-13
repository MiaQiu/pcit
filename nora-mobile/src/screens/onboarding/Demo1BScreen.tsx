import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;

const CARDS = [
  { label: 'Therapeutic\nPlay Techniques', bg: '#D4E6C3' },
  { label: 'Setting\nBoundaries',          bg: '#C5C0E8' },
  { label: 'Manage\nEmotions',             bg: '#B8DDE4' },
];

export const Demo1BScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Horizontal card row */}
      <View style={styles.cardsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsScroll}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
        >
          {CARDS.map((card, index) => (
            <View
              key={card.label}
              style={[
                styles.card,
                { backgroundColor: card.bg },
                index === 1 && styles.cardCenter,
              ]}
            >
              <Image
                source={require('../../../assets/images/demo1B.png')}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <Text style={styles.cardLabel}>{card.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Body text */}
      <View style={styles.textSection}>
        <Text style={styles.bodyText}>
          Get simple strategies that actually work.
        </Text>
      </View>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo2')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Next  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
  },
  cardsScroll: {
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.3,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cardCenter: {
    height: CARD_WIDTH * 1.45,
    marginTop: -16,
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  cardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  textSection: {
    paddingHorizontal: 32,
    paddingVertical: 32,
    alignItems: 'center',
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 20,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 30,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
