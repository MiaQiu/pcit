# Sound Effects

This directory contains audio files used for play session notifications and alerts.

## Current Sounds

- `voice_reminder.mp3` - Custom voice reminder for CDI/PDI transitions

## Adding New Sounds

1. Place your audio file (mp3, wav, or m4a) in this directory
2. Add the export to `/src/constants/assets.ts`:
   ```typescript
   export const SOUNDS = {
     voiceReminder: require('../../assets/sounds/voice_reminder.mp3'),
     yourNewSound: require('../../assets/sounds/your_new_sound.mp3'),
   };
   ```
3. Add the option to `SOUND_OPTIONS` in `/src/screens/NotificationSettingsScreen.tsx`:
   ```typescript
   { id: 'your-sound-id', label: 'Your Sound Name', emoji: '🎵' },
   ```
4. The sound will now appear in the notification settings picker

## Audio Format Recommendations

- **Format**: MP3 or M4A (best compatibility)
- **Sample Rate**: 44.1kHz or 48kHz
- **Bit Rate**: 128kbps or higher
- **Duration**: Keep sounds short (1-5 seconds) for alerts
- **Volume**: Normalize audio to prevent clipping
