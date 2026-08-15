import React from 'react';
import { View, Text, StyleSheet, TextStyle, StyleProp } from 'react-native';

interface ArcTextProps {
  text: string;
  style: StyleProp<TextStyle>;
}

// Renders text one letter at a time along a shallow arc (center letters lifted,
// outer letters dropped + tilted slightly) instead of a flat baseline —
// matches the chunky wavy headline treatment in the OB-play artwork.
export const ArcText: React.FC<ArcTextProps> = ({ text, style }) => {
  const mid = (text.length - 1) / 2;
  return (
    <View style={styles.row}>
      {text.split('').map((char, i) => {
        const offset = i - mid;
        const translateY = Math.pow(offset, 2) * 4;
        const rotate = offset * 4;
        return (
          <Text key={i} style={[style, { transform: [{ translateY }, { rotate: `${rotate}deg` }] }]}>
            {char}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
