import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthService } from '../contexts/AppContext';
import { FONTS, COLORS } from '../constants/assets';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface ReferralData {
  code: string;
  shareUrl: string;
  stats: {
    totalReferred: number;
    converted: number;
    pendingConversion: number;
  };
}

export const ReferralScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();
  const { t } = useTranslation();

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    amplitudeService.trackScreenView('Referral');
    fetchReferralCode();
  }, []);

  const fetchReferralCode = async () => {
    try {
      const token = authService.getAccessToken();
      const res = await fetch(`${API_URL}/api/referral/my-code`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load referral code');
      const json = await res.json();
      setData(json);
    } catch (err) {
      amplitudeService.trackError(err as Error, 'ReferralScreen.fetchReferralCode');
      Alert.alert(t('common.error'), t('referral.errorLoadReferral'));
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!data) return;
    amplitudeService.trackEvent('Referral Share Tapped', { referralCode: data.code });
    try {
      const result = await Share.share({
        message: t('referral.shareMessage'),
        url: data.shareUrl,
      });
      if (result.action === Share.sharedAction) {
        amplitudeService.trackEvent('Referral Shared', { referralCode: data.code });
      }
    } catch (err) {
      // User dismissed share sheet — no action needed
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('referral.headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : data ? (
          <>
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>{t('referral.heroTitle')}</Text>
              <Text style={styles.heroSubtitle}>
                {t('referral.heroSubtitle')}
              </Text>
            </View>

            <View style={styles.linkCard}>
              <Text style={styles.linkLabel}>{t('referral.yourInviteLink')}</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {data.shareUrl}
                </Text>
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>{t('referral.shareButton')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>{t('referral.yourReferrals')}</Text>

              <View style={styles.statRow}>
                <View style={styles.statDot} />
                <Text style={styles.statText}>
                  {t('referral.friendJoined', { count: data.stats.totalReferred })}
                </Text>
              </View>

              <View style={styles.statRow}>
                <View style={[styles.statDot, styles.statDotGreen]} />
                <Text style={styles.statText}>
                  {t('referral.subscribed', { count: data.stats.converted })}
                  {data.stats.converted > 0 ? (
                    <Text style={styles.rewardBadge}>
                      {' '}{t('referral.monthEarned', { count: data.stats.converted })}
                    </Text>
                  ) : null}
                </Text>
              </View>

              {data.stats.pendingConversion > 0 && (
                <View style={styles.statRow}>
                  <View style={[styles.statDot, styles.statDotAmber]} />
                  <Text style={styles.statText}>
                    {t('referral.onFreeTrial', { count: data.stats.pendingConversion })}
                  </Text>
                </View>
              )}

              {data.stats.totalReferred === 0 && (
                <Text style={styles.emptyStats}>
                  {t('referral.emptyStats')}
                </Text>
              )}
            </View>

            <View style={styles.howItWorksCard}>
              <Text style={styles.howTitle}>{t('referral.howItWorks')}</Text>
              {[
                { step: '1', text: t('referral.step1') },
                { step: '2', text: t('referral.step2') },
                { step: '3', text: t('referral.step3') },
              ].map(({ step, text }) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1F2937',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#1F2937',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  linkCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  linkLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  linkBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkText: {
    fontSize: 14,
    color: '#8C49D5',
    fontFamily: FONTS.semiBold,
  },
  shareButton: {
    backgroundColor: '#8C49D5',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statsTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1F2937',
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8C49D5',
    marginRight: 10,
  },
  statDotGreen: {
    backgroundColor: '#10B981',
  },
  statDotAmber: {
    backgroundColor: '#F59E0B',
  },
  statText: {
    fontSize: 15,
    color: '#374151',
  },
  statNumber: {
    fontFamily: FONTS.semiBold,
    color: '#1F2937',
  },
  rewardBadge: {
    color: '#10B981',
    fontFamily: FONTS.semiBold,
  },
  emptyStats: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    marginTop: 4,
  },
  howItWorksCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  howTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1F2937',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#8C49D5',
  },
  stepText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});
