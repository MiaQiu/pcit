/**
 * Asset Constants
 * Centralized exports for all local image assets
 */

// Lesson Card Assets
export const DRAGON_PURPLE = require('../../assets/images/dragon_image.png');

// Report screen hero dragons — pose 1 (waving, "good progress"), pose 2 (celebrating, "amazing session")
export const REPORT_DRAGON_GOOD = require('../../assets/images/report-dragon1.png');
export const REPORT_DRAGON_AMAZING = require('../../assets/images/report-dragon2.png');
export const REPORT_DETAIL_DRAGON = require('../../assets/images/reportdetail-dragon.png');
export const PROFILE_REPORT_CHILD = require('../../assets/images/dino_baby.webp');
export const PROFILE_REPORT_THANKS_DRAGON = require('../../assets/images/profilereportscreen.png');
export const REPORT_TARGET = require('../../assets/images/report-target.png');
export const REPORT_TARGET_SMALL = require('../../assets/images/target-small.png');

// Design Tokens from Figma
export const COLORS = {
  mainPurple: '#8C49D5',
  textDark: '#1E2939',
  white: '#FFFFFF',
  cardPurple: '#E4E4FF',
  cardOrange: '#FFE4C0',
  ellipseCyan: '#9BD4DF',
  ellipseOrange: '#FFB380',
  textSecondary: '#6B7280',
  // Report V2 "Today's Goal" spotlight card
  tealAccent: '#0D9488',
  tealTint: '#E3F4F2',
  neutralTint: '#F4F1EC',
};

// Typography
export const FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  regularItalic: 'PlusJakartaSans_400Regular_Italic',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  boldItalic: 'PlusJakartaSans_700Bold_Italic',
};

// Sound Effects
export const SOUNDS = {
  voiceReminder: require('../../assets/sounds/voice_reminder.mp3'),
  Win: require('../../assets/sounds/Win.mp3'),
  Bell: require('../../assets/sounds/Bell.mp3'),
  // Add more sounds here as needed
};
