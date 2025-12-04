# Assets Directory

This directory contains all design assets downloaded from Figma.

## Images

All images are stored in the `images/` subdirectory and exported via `src/constants/assets.ts`.

### Lesson Card Assets

- **dragon-purple.png** - Purple dragon character used in lesson cards
- **ellipse-77.png** - Bottom decorative ellipse (cyan/turquoise gradient)
- **ellipse-78.png** - Top decorative ellipse (cyan/turquoise gradient)

### Button/Icon Assets

- **arrow-icon-1.png** - Arrow icon component (part 1)
- **arrow-icon-2.png** - Arrow icon component (part 2)

## SVG Assets

- **ellipse.svg** - Base ellipse shape for generating colored ellipses programmatically

## Usage

Import assets from the centralized constants file:

```typescript
import { DRAGON_PURPLE, ELLIPSE_77, ELLIPSE_78 } from '../constants/assets';

// Use in Image components
<Image source={DRAGON_PURPLE} style={styles.image} />
```

## Design System

### Colors (from Figma)

- **Main Purple**: `#8C49D5`
- **Text Dark**: `#1E2939`
- **White**: `#FFFFFF`
- **Card Purple**: `#E4E4FF`
- **Card Orange**: `#FFE4C0`
- **Ellipse Cyan**: `#9BD4DF`
- **Ellipse Orange**: `#FFB380`

### Typography

- **Regular**: PlusJakartaSans_400Regular
- **Semi Bold**: PlusJakartaSans_600SemiBold
- **Bold**: PlusJakartaSans_700Bold

## Updating Assets

To re-download assets from Figma:

```bash
node scripts/download-figma-assets.cjs
```

**Note**: Figma asset URLs expire after 7 days. Assets should be downloaded and committed to the repository.
