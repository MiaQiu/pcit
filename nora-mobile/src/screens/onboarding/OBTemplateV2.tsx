/**
 * OBTemplateV2
 * Background-image + real-text overlay variant of OBTemplate.
 * The `image` still has its text baked in for now (kept as a placeholder
 * background) — once a clean (text-free) version of the artwork is dropped
 * in, the overlaid text below will line up with it. Overlay positions are
 * percentage estimates eyeballed off the current artwork, so expect to
 * nudge them once the clean background lands.
 *
 * The <Image> itself keeps the exact same square box (size + position) as
 * the original OBTemplate — untouched. Only a separate absolutely-positioned
 * overlay View, sized/offset to the image's actual (letterboxed) rendered
 * rect, is added on top for the text so it lines up with the artwork.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  ImageSourcePropType,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OBTemplateV2Props {
  image: ImageSourcePropType;
  imageAspectRatio: number; // naturalWidth / naturalHeight
  imageScale?: number;
  onNext: () => void;
  children?: React.ReactNode; // overlay positioned on top of the image
  aboveImage?: React.ReactNode; // extra content stacked above the image, still in the centered content area
  belowImage?: React.ReactNode; // extra content stacked under the image, still in the centered content area
  contentOffsetY?: number; // shifts the whole centered content block (text + image) vertically
  imageOffsetY?: number; // shifts just the <Image>, independent of the text overlay
  imageBoxOffsetY?: number; // shifts the image + its text overlay together, independent of aboveImage/belowImage
}

export const OBTemplateV2: React.FC<OBTemplateV2Props> = ({
  image,
  imageAspectRatio,
  imageScale = 1,
  onNext,
  children,
  aboveImage,
  belowImage,
  contentOffsetY = 0,
  imageOffsetY = 0,
  imageBoxOffsetY = 0,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Identical to the original OBTemplate's square "contain" box — untouched.
  const imageSize = (SCREEN_WIDTH - 48) * imageScale;
  // The overlay's own rect: the image's actual (letterboxed) rendered size
  // within that square, so text percentages line up with the artwork
  // instead of the empty letterbox margin.
  const isPortrait = imageAspectRatio <= 1;
  const renderedWidth = isPortrait ? imageSize * imageAspectRatio : imageSize;
  const renderedHeight = isPortrait ? imageSize : imageSize / imageAspectRatio;
  const overlayLeft = (imageSize - renderedWidth) / 2;
  const overlayTop = (imageSize - renderedHeight) / 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.content, contentOffsetY ? { transform: [{ translateY: contentOffsetY }] } : null]}>
        {aboveImage}
        <View
          style={[
            { width: imageSize, height: imageSize },
            imageBoxOffsetY ? { transform: [{ translateY: imageBoxOffsetY }] } : null,
          ]}
        >
          <Image
            source={image}
            style={[
              { width: imageSize, height: imageSize },
              imageOffsetY ? { transform: [{ translateY: imageOffsetY }] } : null,
            ]}
            resizeMode="contain"
          />
          <View
            style={{
              position: 'absolute',
              left: overlayLeft,
              top: overlayTop,
              width: renderedWidth,
              height: renderedHeight,
            }}
          >
            {children}
          </View>
        </View>
        {belowImage}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
