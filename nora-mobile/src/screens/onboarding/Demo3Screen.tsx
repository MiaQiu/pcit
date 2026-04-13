import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

export const Demo3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Coaching card with gradient border */}
        <View style={styles.cardWrapper}>
          <LinearGradient
            colors={['#C8C0F0', '#B8D4F5', '#D8C8F8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
          >
            <View style={styles.cardInner}>
              {/* Header */}
              <Text style={styles.cardTitle}>Nora Coaching Corner</Text>

              {/* Bubble 1 — left */}
              <View style={styles.bubbleLeft}>
                <Text style={styles.bubbleText}>
                  <Text style={styles.bubbleBold}>Handling Distractions: </Text>
                  I notice minor distractions when a little girl cried in the background, and Ziyi got a bit stuck in a "why?" loop. For future situations where an external distraction or minor crisis occurs, you can briefly validate his observation and immediately describe his play like "You are picking up the pink marker". This smoothly anchors his attention.
                </Text>
              </View>

              {/* Bubble 2 — right */}
              <View style={styles.bubbleRight}>
                <Text style={styles.bubbleText}>
                  <Text style={styles.bubbleBold}>Long Term Impact: </Text>
                  You did a stellar job keeping questions to a minimum. To further help with his frustration tolerance outside of playtime, try using this same, descriptive tone to label his emotions when he gets upset ("You are feeling frustrated right now") before trying to reason with him or set a limit.
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Body text */}
        <View style={styles.textContainer}>
          <Text style={styles.body}>
            Personalized coaching based on your real moments, grounded in child development science.
          </Text>
        </View>
      </ScrollView>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo4')}
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
  scrollContent: {
    paddingBottom: 96,
  },
  cardWrapper: {
    marginHorizontal: 20,
    marginTop: 32,
  },
  gradientBorder: {
    borderRadius: 24,
    padding: 2,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    paddingBottom: 28,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#8C49D5',
    textAlign: 'center',
    marginBottom: 20,
  },
  bubbleLeft: {
    backgroundColor: '#F3F0FF',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 14,
    marginRight: 32,
    marginBottom: 12,
  },
  bubbleRight: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 14,
    marginLeft: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bubbleText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
  },
  bubbleBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#1F2937',
  },
  textContainer: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
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
