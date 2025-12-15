# Nora Mobile

React Native mobile app for Nora - A parenting coaching app focused on the PEN (Praise, Echo, Narrate) method.

---

## 📱 Project Overview

Nora helps parents improve their interaction skills with children through:
- 2-minute educational lessons
- Interactive quizzes
- Practice recording sessions
- Progress tracking and insights
- Personalized coaching feedback

**Tech Stack**:
- React Native with Expo SDK 54
- TypeScript
- NativeWind v4 (Tailwind CSS for React Native)
- React Navigation
- Plus Jakarta Sans fonts

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

---

## 📚 Documentation

Complete design and implementation documentation is available in `/docs/`:

### Main Documentation
- **[docs/README.md](./docs/README.md)** - Documentation index and quick start
- **[docs/FIGMA_INTEGRATION_SUMMARY.md](./docs/FIGMA_INTEGRATION_SUMMARY.md)** - Complete summary of Figma integration

### Design Reference
- **[docs/FIGMA_DESIGN_CATALOG.md](./docs/FIGMA_DESIGN_CATALOG.md)** - Complete catalog of screens and components
- **[docs/SCREEN_IMPLEMENTATION_GUIDES.md](./docs/SCREEN_IMPLEMENTATION_GUIDES.md)** - Detailed screen specifications
- **[docs/COMPONENTS_SPECIFICATION.md](./docs/COMPONENTS_SPECIFICATION.md)** - Component specifications with TypeScript interfaces

### Figma File
**Design**: [Nora - Figma](https://www.figma.com/design/iHkY0DURZnXQiYwmheSKdo/Nora)

---

## 🏗️ Project Structure

```
nora-mobile/
├── docs/                          # Complete design documentation
│   ├── README.md
│   ├── FIGMA_DESIGN_CATALOG.md
│   ├── SCREEN_IMPLEMENTATION_GUIDES.md
│   ├── COMPONENTS_SPECIFICATION.md
│   └── FIGMA_INTEGRATION_SUMMARY.md
├── assets/
│   ├── images/                    # Local image assets
│   │   ├── dragon-purple.png
│   │   ├── ellipse-77.png
│   │   └── ellipse-78.png
│   └── README.md
├── scripts/
│   └── download-figma-assets.cjs  # Asset download script
├── src/
│   ├── components/                # Reusable components
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   └── LessonCard.tsx
│   ├── screens/                   # Screen components
│   │   └── HomeScreen.tsx
│   ├── navigation/                # Navigation setup
│   │   └── TabNavigator.tsx
│   └── constants/
│       └── assets.ts              # Centralized asset exports
└── App.tsx                        # Root component
```

---

## 🎨 Design System

### Colors
```typescript
mainPurple: '#8C49D5'    // Primary brand color
textDark: '#1E2939'      // Primary text
cardPurple: '#E4E4FF'    // Card background (phase 1)
cardOrange: '#FFE4C0'    // Card background (phase 2)
successGreen: '#4CAF50'  // Correct answers
errorRed: '#F44336'      // Incorrect answers
```

### Typography
- **Font**: Plus Jakarta Sans
- **Weights**: Regular (400), SemiBold (600), Bold (700)
- **Sizes**: 10px, 14px, 16px, 20px, 32px

### Spacing
- Screen padding: 24px
- Card border radius: 24px
- Button height: 64px
- Button border radius: 112px (pill)

---

## 📊 Implementation Progress

### Phase 1: Core Experience ✅ COMPLETE
- [x] Home Screen with lesson cards
- [x] Bottom tab navigation
- [x] Core components (Card, Badge, Button, LessonCard)
- [x] Design system setup
- [x] Local asset management

### Phase 2: Lesson Viewer 🔄 NEXT
- [ ] Reading mode screen
- [ ] Progress bar component
- [ ] Close button component
- [ ] Lesson navigation

### Phase 3: Quiz System ⏳
- [ ] Quiz mode screen
- [ ] Response buttons with states
- [ ] Feedback banner
- [ ] Score tracking

### Phase 4-6: Goals, Progress, Reports ⏳
- [ ] Goal screen with PEN skills
- [ ] Recording UI
- [ ] Progress dashboard
- [ ] Review reports with insights

**Overall Progress**: ~25% complete (2 of 8 screens)

---

## 🧩 Components

### ✅ Implemented
1. **Card** - Container component with variants
2. **Badge** - Phase label display
3. **Button** - CTA button with states
4. **LessonCard** - Main lesson card with dragon
5. **TabNavigator** - Bottom navigation tabs

### 🔄 Next Priority
6. **ProgressBar** - Segmented progress indicator
7. **ResponseButton** - Quiz answer buttons (4 states)
8. **CloseButton** - Screen close/back button
9. **FeedbackBanner** - Quiz feedback display

See [COMPONENTS_SPECIFICATION.md](./docs/COMPONENTS_SPECIFICATION.md) for complete list (20+ components).

---

## 🛠️ Development

### Scripts

```bash
# Development
npm start              # Start Expo dev server
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
npm run web           # Run in web browser

# Utilities
npm run download-assets  # Download Figma assets (if needed)
```

### Adding New Components

1. Reference [COMPONENTS_SPECIFICATION.md](./docs/COMPONENTS_SPECIFICATION.md) for specs
2. Create component in `/src/components/`
3. Use TypeScript interfaces from documentation
4. Match Figma measurements exactly
5. Add Figma node ID in comments

### Adding New Screens

1. Reference [SCREEN_IMPLEMENTATION_GUIDES.md](./docs/SCREEN_IMPLEMENTATION_GUIDES.md)
2. Create screen in `/src/screens/`
3. Use SafeAreaView wrapper
4. Follow layout structure from docs
5. Test against Figma screenshots

---

## 📦 Asset Management

### Local Assets
All images stored in `/assets/images/` and exported via `/src/constants/assets.ts`:

```typescript
import { DRAGON_PURPLE, ELLIPSE_77 } from '../constants/assets';

<Image source={DRAGON_PURPLE} style={styles.image} />
```

### Downloading New Assets

```bash
node scripts/download-figma-assets.cjs
```

**Note**: Figma asset URLs expire after 7 days. Always use local assets.

---

## 🔗 Resources

- **Figma Design**: [iHkY0DURZnXQiYwmheSKdo](https://www.figma.com/design/iHkY0DURZnXQiYwmheSKdo/Nora)
- **Documentation**: [/docs/README.md](./docs/README.md)
- **React Native**: [reactnative.dev](https://reactnative.dev)
- **Expo**: [docs.expo.dev](https://docs.expo.dev)
- **NativeWind**: [nativewind.dev](https://www.nativewind.dev)

---

## 📝 License

[Add license information]

---

## 👥 Team

[Add team information]

---

*Last Updated: December 1, 2025*
