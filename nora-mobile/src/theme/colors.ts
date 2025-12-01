/**
 * Nora Design System - Colors
 * Extracted from Figma design
 */

export const colors = {
  // Primary Colors
  purple: {
    main: '#8C49D5',
  },

  // Text Colors
  text: {
    dark: '#1E2939',
    primary: '#000000',
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
  },

  // Additional colors from design
  white: '#FFFFFF',
} as const;

export type ColorKey = keyof typeof colors;
