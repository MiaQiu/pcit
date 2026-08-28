/**
 * ShareSheet
 * Custom in-app "Share" bottom sheet replacing RN's native Share.share() —
 * a preview image (optional), a "SHARE TO" row (WhatsApp via Linking.openURL;
 * Facebook via react-native-share's shareSingle, which invokes the app's
 * share extension/intent-target directly — an already-logged-in native post
 * composer, not a web dialog — falling back to clipboard-copy + app-launch
 * if shareSingle isn't available; WeChat via plain clipboard-copy + weixin://
 * app-launch, same shape as WhatsApp — WeChat has no public URL-based text
 * prefill (unlike WhatsApp's whatsapp://send?text=) and no shareSingle
 * target either; real rich sharing (jumping straight to WeChat's contact
 * picker) needs the Tencent SDK + a registered AppID, deferred for now. No
 * LinkedIn/Instagram — out of scope), and a "SHARE LINK" row with a short
 * /s/:code URL + Copy button.
 * Used by SubActionCard (HomeScreen_v2), HomeCardDetailScreen,
 * LessonReadScreen, LearnScreen_v3's Read modal, and LessonViewerScreen_v2
 * (the audio-first lesson player).
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Share, { Social } from 'react-native-share';
import { FONTS, COLORS } from '../constants/assets';
import { useRecordingService } from '../contexts/AppContext';
import { useToast } from './ToastManager';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  // Becomes ShortLink.targetUrl — the existing long-form share-home-card.html
  // / share-lesson.html URL.
  targetUrl: string;
  // Same title/subtitle shown on the generated share-image (see
  // server/services/shareImage.cjs) — the WhatsApp share text is composed
  // from exactly these two plus the link, nothing else, so what a recipient
  // reads always matches what they'd see if they opened the link.
  title: string;
  subtitle?: string;
  // The card's generated share-image.png URL (see server/services/shareImage.cjs).
  // Omit when there's genuinely nothing to preview yet — the image box is
  // skipped entirely rather than showing a placeholder.
  previewImageUrl?: string;
}

// Reopening the sheet for the same card/lesson in-session reuses the
// already-resolved short link instead of hitting the server again.
const shortUrlCache = new Map<string, string>();

export const ShareSheet: React.FC<ShareSheetProps> = ({ visible, onClose, targetUrl, title, subtitle, previewImageUrl }) => {
  const recordingService = useRecordingService();
  const { showToast } = useToast();
  const [shortUrl, setShortUrl] = useState<string | null>(targetUrl ? shortUrlCache.get(targetUrl) ?? null : null);
  const [loadingLink, setLoadingLink] = useState(false);
  // The share-image's canvas height adapts to its content server-side (see
  // buildShareCardImage), so its aspect ratio isn't a fixed 1200:630 — ask
  // the image itself for its real dimensions rather than assuming.
  const [previewAspectRatio, setPreviewAspectRatio] = useState(1200 / 630);

  useEffect(() => {
    if (!previewImageUrl) return;
    Image.getSize(
      previewImageUrl,
      (width, height) => { if (height > 0) setPreviewAspectRatio(width / height); },
      () => {} // keep the default ratio if this fails — never block the sheet over it
    );
  }, [previewImageUrl]);

  useEffect(() => {
    if (!visible || !targetUrl) return;
    const cached = shortUrlCache.get(targetUrl);
    if (cached) {
      setShortUrl(cached);
      return;
    }
    setLoadingLink(true);
    recordingService
      .createShareLink(targetUrl)
      .then(({ shortUrl: resolved }) => {
        shortUrlCache.set(targetUrl, resolved);
        setShortUrl(resolved);
      })
      .catch((err) => {
        console.error('Failed to create share link:', err);
        // Never block sharing — fall back to the long URL.
      })
      .finally(() => setLoadingLink(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, targetUrl]);

  const effectiveUrl = shortUrl || targetUrl;
  const shareText = subtitle ? `${title}\n${subtitle}\n\n${effectiveUrl}` : `${title}\n\n${effectiveUrl}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(effectiveUrl);
    showToast('Copied!', 'success');
  };

  const openWhatsApp = async () => {
    // Send the link only — WhatsApp unfurls it into the rich preview card
    // (og:title / og:description / og:image from share-home-card.html), so
    // adding title+subtitle as plain text just duplicates what the card shows.
    const url = `whatsapp://send?text=${encodeURIComponent(effectiveUrl)}`;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      showToast('WhatsApp is not installed', 'error');
      return;
    }
    Linking.openURL(url).catch(() => showToast('Could not open WhatsApp', 'error'));
  };

  const openFacebook = async () => {
    try {
      await Share.shareSingle({
        social: Social.Facebook,
        url: effectiveUrl,
        message: shareText,
      });
    } catch (err) {
      // No shareSingle extension available — fall back to clipboard-copy +
      // app-launch/web. Meta removed the ability to pre-fill a share's
      // message text platform-wide back in 2018 (a policy change, not a
      // technical gap) — `sharer.php` below only ever accepts `u` (the link).
      await Clipboard.setStringAsync(shareText);
      showToast('Copied! Paste it into your Facebook post', 'success');

      const appUrl = 'fb://';
      const canOpenApp = await Linking.canOpenURL(appUrl).catch(() => false);
      if (canOpenApp) {
        Linking.openURL(appUrl).catch(() => showToast('Could not open Facebook', 'error'));
        return;
      }

      Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(effectiveUrl)}`).catch(() =>
        showToast('Could not open Facebook', 'error')
      );
    }
  };

  // Same shape as openWhatsApp: WeChat has no public URL-based text prefill
  // (unlike whatsapp://send?text=), so the closest equivalent is copy-then-open.
  // canOpenURL('weixin://') needs com.tencent.mm declared for Android 11+
  // package visibility — added to app.json's react-native-share plugin
  // config (reused purely as a generic "add these packages to <queries>"
  // mechanism; WeChat doesn't go through that library at all).
  const openWeChat = async () => {
    const canOpen = await Linking.canOpenURL('weixin://').catch(() => false);
    if (!canOpen) {
      showToast('WeChat is not installed', 'error');
      return;
    }
    await Clipboard.setStringAsync(shareText);
    showToast('Copied! Paste it into WeChat', 'success');
    Linking.openURL('weixin://').catch(() => showToast('Could not open WeChat', 'error'));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={[styles.preview, { aspectRatio: previewAspectRatio }]}
              resizeMode="cover"
            />
          )}

          <Text style={styles.sectionLabel}>Share to</Text>
          <View style={styles.shareToRow}>
            <TouchableOpacity style={styles.iconButton} onPress={openWhatsApp} activeOpacity={0.7} accessibilityLabel="WhatsApp">
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={openFacebook} activeOpacity={0.7} accessibilityLabel="Facebook">
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={openWeChat} activeOpacity={0.7} accessibilityLabel="WeChat">
              <Ionicons name="logo-wechat" size={24} color="#07C160" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Share link</Text>
          <View style={styles.linkRow}>
            {loadingLink && !shortUrl ? (
              <ActivityIndicator size="small" color={COLORS.mainPurple} style={styles.linkLoading} />
            ) : (
              <Text style={styles.linkText} numberOfLines={1}>{effectiveUrl}</Text>
            )}
            <TouchableOpacity style={styles.copyButton} onPress={handleCopy} activeOpacity={0.8}>
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  shareToRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  linkLoading: {
    flex: 1,
    alignItems: 'flex-start',
  },
  linkText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },
  copyButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  copyButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
