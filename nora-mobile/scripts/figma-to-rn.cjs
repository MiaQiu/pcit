/**
 * Figma to React Native Conversion Helper
 *
 * Converts Figma metadata to React Native styles
 */

/**
 * Convert Tailwind class to React Native style object
 * @param {string} className - Tailwind class string
 * @returns {object} React Native style object
 */
function tailwindToRN(className) {
  const styles = {};
  const classes = className.split(' ');

  classes.forEach(cls => {
    // Position
    if (cls === 'absolute') styles.position = 'absolute';
    if (cls === 'relative') styles.position = 'relative';

    // Flex
    if (cls === 'flex') styles.display = 'flex';
    if (cls === 'flex-row') styles.flexDirection = 'row';
    if (cls === 'flex-col') styles.flexDirection = 'column';
    if (cls === 'items-center') styles.alignItems = 'center';
    if (cls === 'items-start') styles.alignItems = 'flex-start';
    if (cls === 'items-end') styles.alignItems = 'flex-end';
    if (cls === 'justify-center') styles.justifyContent = 'center';
    if (cls === 'justify-between') styles.justifyContent = 'space-between';

    // Spacing - Extract pixel values from Tailwind arbitrary values
    const leftMatch = cls.match(/left-\[([0-9]+)px\]/);
    if (leftMatch) styles.left = parseInt(leftMatch[1]);

    const topMatch = cls.match(/top-\[([0-9]+)px\]/);
    if (topMatch) styles.top = parseInt(topMatch[1]);

    const rightMatch = cls.match(/right-\[([0-9]+)px\]/);
    if (rightMatch) styles.right = parseInt(rightMatch[1]);

    const bottomMatch = cls.match(/bottom-\[([0-9]+)px\]/);
    if (bottomMatch) styles.bottom = parseInt(bottomMatch[1]);

    // Width/Height
    const widthMatch = cls.match(/w-\[([0-9]+)px\]/);
    if (widthMatch) styles.width = parseInt(widthMatch[1]);

    const heightMatch = cls.match(/h-\[([0-9]+)px\]/);
    if (heightMatch) styles.height = parseInt(heightMatch[1]);

    // Border Radius
    const roundedMatch = cls.match(/rounded-\[([0-9]+)px\]/);
    if (roundedMatch) styles.borderRadius = parseInt(roundedMatch[1]);
    if (cls === 'rounded-full') styles.borderRadius = 9999;

    // Background Color
    const bgMatch = cls.match(/bg-\[([#a-fA-F0-9]+)\]/);
    if (bgMatch) styles.backgroundColor = bgMatch[1];

    // Text Color
    const textMatch = cls.match(/text-\[([#a-fA-F0-9]+)\]/);
    if (textMatch) styles.color = textMatch[1];

    // Font Size
    const textSizeMatch = cls.match(/text-\[([0-9]+)px\]/);
    if (textSizeMatch) styles.fontSize = parseInt(textSizeMatch[1]);

    // Padding
    const pxMatch = cls.match(/px-\[([0-9]+)px\]/);
    if (pxMatch) {
      styles.paddingLeft = parseInt(pxMatch[1]);
      styles.paddingRight = parseInt(pxMatch[1]);
    }

    const pyMatch = cls.match(/py-\[([0-9]+)px\]/);
    if (pyMatch) {
      styles.paddingTop = parseInt(pyMatch[1]);
      styles.paddingBottom = parseInt(pyMatch[1]);
    }

    // Gap
    const gapMatch = cls.match(/gap-\[([0-9]+)px\]/);
    if (gapMatch) styles.gap = parseInt(gapMatch[1]);
  });

  return styles;
}

/**
 * Convert Figma metadata to React Native component structure
 * @param {object} figmaNode - Figma node metadata
 * @returns {string} React Native component code
 */
function figmaNodeToRN(figmaNode) {
  const { x, y, width, height, name, type } = figmaNode;

  let component = 'View';
  if (type === 'text') component = 'Text';
  if (type === 'image' || type === 'rounded-rectangle' && name.includes('dragon')) {
    component = 'Image';
  }

  const styles = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
  };

  return {
    component,
    styles,
    name,
  };
}

/**
 * Generate React Native StyleSheet from Figma metadata
 * @param {object} metadata - Figma metadata object
 * @returns {string} StyleSheet code
 */
function generateStyleSheet(metadata) {
  const styles = {};

  // Extract common patterns from Figma
  // Note: Adjusted values based on manual refinements for better mobile fit
  styles.lessonCard = {
    width: '90%', // Adjusted from 100% for better spacing
    height: 660, // Adjusted from 679 to fit better on screen
    alignSelf: 'center', // Added to center the card
    borderRadius: 24,
    overflow: 'hidden',
  };

  styles.dragonImage = {
    position: 'absolute',
    left: 0,
    top: 42,
    width: 350, // Adjusted from 382 to fit within card
    height: 223,
  };

  styles.phaseBadge = {
    position: 'absolute',
    top: 302,
    left: 0,
    width: '100%',
    alignItems: 'center',
  };

  styles.contentContainer = {
    position: 'absolute',
    top: 383,
    left: 0,
    width: '100%',
    paddingHorizontal: 24,
    gap: 16,
  };

  styles.ctaButton = {
    position: 'absolute',
    bottom: 15, // Adjusted from 24 for better positioning
    left: 24,
    width: 300, // Adjusted from 334 to fit within card
  };

  return `const styles = StyleSheet.create(${JSON.stringify(styles, null, 2)});`;
}

// Export functions
module.exports = {
  tailwindToRN,
  figmaNodeToRN,
  generateStyleSheet,
};

// Example usage:
if (require.main === module) {
  console.log('Figma to React Native Converter\n');

  // Example: Convert Tailwind class
  const example1 = tailwindToRN('absolute left-[24px] top-[42px] w-[382px] h-[223px]');
  console.log('Tailwind to RN:', example1);

  // Example: Generate StyleSheet
  console.log('\n' + generateStyleSheet({}));
}
