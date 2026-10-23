/**
 * Screen-Time Scenes
 * Warm parent-and-child illustrations for the screen-time branch's
 * "practice" and "play" insight screens. Ported from the Nora-Onboarding-1
 * prototype (family-scenes.tsx) to react-native-svg.
 */

import React from 'react';
import Svg, { G, Path, Circle, Rect, Ellipse } from 'react-native-svg';

const INK = '#4a3470';
const line = { stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const SKIN_A = '#f2c9a8';
const SKIN_B = '#d9a07c';
const HAIR_A = '#5b3a2e';
const HAIR_B = '#2f2238';

function Eyes({ x, y, gap, happy = true }: { x: number; y: number; gap: number; happy?: boolean }) {
  return happy ? (
    <G fill="none" {...line} strokeWidth={1.4}>
      <Path d={`M${x - 1.8} ${y} q1.8 -2 3.6 0`} />
      <Path d={`M${x + gap - 1.8} ${y} q1.8 -2 3.6 0`} />
    </G>
  ) : (
    <G fill={INK}>
      <Circle cx={x} cy={y} r={1.3} />
      <Circle cx={x + gap} cy={y} r={1.3} />
    </G>
  );
}

function PracticeScene() {
  return (
    <G>
      <Rect width="320" height="120" rx="16" fill="#f4eefa" />
      <Circle cx="268" cy="30" r="40" fill="#ece3f7" />
      <Path d="M0 98 H320 V104 a16 16 0 0 1 -16 16 H16 a16 16 0 0 1 -16 -16z" fill="#e6dcf3" />
      {/* window + plant */}
      <Rect x="28" y="18" width="46" height="40" rx="6" fill="#fbf7f2" {...line} />
      <Path d="M51 18 v40 M28 38 h46" {...line} fill="none" />
      <Path d="M262 86 q-6 -18 4 -26 M266 86 q8 -16 -2 -28 M264 86 q0 -14 10 -20" fill="none" stroke="#7fb79c" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M254 86 h22 l-3 12 h-16z" fill="#e3b28f" {...line} />
      {/* table */}
      <Rect x="96" y="80" width="140" height="8" rx="3" fill="#cdb6e6" {...line} />
      {/* book on table */}
      <Path d="M142 80 l18 -4 l18 4 l0 -16 l-18 -4 l-18 4z" fill="#fffaf3" {...line} />
      <Path d="M160 60 v16" {...line} />
      <Path d="M147 68 l8 -1.6 M147 72 l8 -1.6 M165 67 l8 1.6 M165 71 l8 1.6" stroke="#a48cc9" strokeWidth={1.2} strokeLinecap="round" />

      {/* parent (left, leaning in) */}
      <Path d="M86 120 q-4 -40 18 -50 q20 -6 30 10 l6 30 z" fill="#7b5bb3" {...line} />
      <Path d="M128 82 q10 -2 22 -6" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <Path d="M128 82 q10 -2 22 -6" fill="none" stroke="#7b5bb3" strokeWidth={3.4} strokeLinecap="round" />
      <Circle cx="151" cy="75.5" r="3.4" fill={SKIN_A} {...line} />
      <Rect x="107" y="58" width="8" height="10" rx="3" fill={SKIN_A} />
      <Circle cx="112" cy="46" r="14" fill={SKIN_A} {...line} />
      <Path d="M97 48 q-4 -20 14 -18 q16 -2 16 14 q-6 -8 -16 -8 q-8 2 -10 12 q-2 10 -4 14 q-4 -6 0 -14z" fill={HAIR_A} {...line} />
      <Circle cx="96" cy="34" r="6" fill={HAIR_A} {...line} />
      <Eyes x={113} y={47} gap={7} />
      <Path d="M114 54 q3 2.4 6 0" fill="none" {...line} />
      <Circle cx="123" cy="51" r="2.2" fill="#f0a3a0" opacity={0.55} />

      {/* child (right, pointing at book, proud) */}
      <Path d="M186 120 q-2 -32 14 -38 q16 -4 22 10 l2 28z" fill="#f2b45c" {...line} />
      <Path d="M196 88 q-10 -4 -20 -12" fill="none" stroke={INK} strokeWidth={5.4} strokeLinecap="round" />
      <Path d="M196 88 q-10 -4 -20 -12" fill="none" stroke="#f2b45c" strokeWidth={2.8} strokeLinecap="round" />
      <Circle cx="174.5" cy="74.5" r="3" fill={SKIN_B} {...line} />
      <Rect x="200" y="72" width="7" height="8" rx="3" fill={SKIN_B} />
      <Circle cx="204" cy="62" r="12" fill={SKIN_B} {...line} />
      <Path d="M192 60 q0 -14 13 -13 q12 0 11 12 q-4 -5 -9 -6 l-3 4 l-2 -4 q-6 1 -10 7z" fill={HAIR_B} {...line} />
      <Eyes x={199} y={63} gap={7} happy={false} />
      <Path d="M200 68 q3.4 3.4 7 0" fill="#fffaf3" {...line} />
      <Circle cx="196" cy="67" r="2" fill="#e88a80" opacity={0.5} />
      {/* encouragement sparkle */}
      <Path d="M158 40 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill="#f6d27a" {...line} strokeWidth={1.2} />
      <Path d="M178 30 q4 -6 10 -2" fill="none" stroke="#a48cc9" strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

function PlayScene() {
  return (
    <G>
      <Rect width="320" height="120" rx="16" fill="#f6f0f7" />
      <Circle cx="58" cy="34" r="36" fill="#efe3f4" />
      {/* rug */}
      <Ellipse cx="165" cy="108" rx="140" ry="14" fill="#e3d6f2" />
      <Ellipse cx="165" cy="108" rx="112" ry="9" fill="none" stroke="#c9b3e6" strokeWidth={1.4} strokeDasharray="3 4" />
      {/* bunting */}
      <Path d="M16 14 q150 22 288 0" fill="none" stroke="#c9b3e6" strokeWidth={1.2} />
      {[40, 80, 120, 160, 200, 240, 280].map((x, i) => (
        <Path key={x} d={`M${x - 6} ${15 + Math.sin((x / 320) * Math.PI) * 9} l6 9 l6 -9z`} fill={['#cdb6e6', '#f6d27a', '#9fd3bd', '#f2a99e'][i % 4]} />
      ))}

      {/* tower of blocks, mid-build */}
      <Rect x="148" y="86" width="26" height="18" rx="3" fill="#9fd3bd" {...line} />
      <Rect x="152" y="68" width="20" height="18" rx="3" fill="#cdb6e6" {...line} />
      <Rect x="155" y="52" width="16" height="16" rx="3" fill="#f6d27a" {...line} transform="rotate(-6 163 60)" />
      <Path d="M188 102 l10 -3 3 10 -10 3z" fill="#f2a99e" {...line} />
      <Circle cx="124" cy="104" r="5" fill="#f6d27a" {...line} />

      {/* parent kneeling left, hand steadying tower */}
      <Path d="M70 108 q-6 -36 18 -46 q20 -6 28 12 l4 34z" fill="#5f9e8a" {...line} />
      <Path d="M110 78 q20 2 38 -6" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <Path d="M110 78 q20 2 38 -6" fill="none" stroke="#5f9e8a" strokeWidth={3.4} strokeLinecap="round" />
      <Circle cx="150" cy="72" r="3.4" fill={SKIN_B} {...line} />
      <Rect x="92" y="52" width="8" height="10" rx="3" fill={SKIN_B} />
      <Circle cx="97" cy="40" r="14" fill={SKIN_B} {...line} />
      <Path d="M83 40 q-2 -18 15 -16 q14 0 13 14 q-6 -7 -14 -8 q-8 0 -14 10z" fill={HAIR_B} {...line} />
      <Path d="M86 50 q4 8 11 8 q8 0 11 -8 q-2 12 -11 12 q-9 0 -11 -12z" fill={HAIR_B} opacity={0.9} />
      <Eyes x={96} y={40} gap={8} />
      <Path d="M97 47 q4 3 8 0" fill="none" {...line} />
      <Circle cx="108" cy="44" r="2.2" fill="#e88a80" opacity={0.5} />

      {/* child right, arms up placing block, delighted */}
      <Path d="M200 108 q-2 -28 14 -34 q16 -4 22 10 l2 24z" fill="#8b6bc4" {...line} />
      <Path d="M210 82 q-12 -8 -32 -24" fill="none" stroke={INK} strokeWidth={5.4} strokeLinecap="round" />
      <Path d="M210 82 q-12 -8 -32 -24" fill="none" stroke="#8b6bc4" strokeWidth={2.8} strokeLinecap="round" />
      <Rect x="168" y="38" width="15" height="14" rx="3" fill="#f2a99e" {...line} transform="rotate(10 175 45)" />
      <Circle cx="178" cy="56" r="3" fill={SKIN_A} {...line} />
      <Path d="M232 82 q10 -10 14 -22" fill="none" stroke={INK} strokeWidth={5.4} strokeLinecap="round" />
      <Path d="M232 82 q10 -10 14 -22" fill="none" stroke="#8b6bc4" strokeWidth={2.8} strokeLinecap="round" />
      <Circle cx="246" cy="58" r="3" fill={SKIN_A} {...line} />
      <Rect x="214" y="64" width="7" height="8" rx="3" fill={SKIN_A} />
      <Circle cx="218" cy="54" r="12" fill={SKIN_A} {...line} />
      <Path d="M206 54 q-2 -14 12 -14 q13 0 12 13 q-5 -6 -12 -7 q-8 1 -12 8z" fill="#c07a3e" {...line} />
      <Circle cx="231" cy="46" r="4.4" fill="#c07a3e" {...line} />
      <Circle cx="205" cy="46" r="4.4" fill="#c07a3e" {...line} />
      <Eyes x={214} y={55} gap={8} />
      <Path d="M214 60 q4 4.4 8 0z" fill="#e88a80" {...line} strokeWidth={1.2} />
      <Circle cx="210" cy="59" r="2" fill="#e88a80" opacity={0.5} />
      {/* joy marks */}
      <Path d="M256 40 l4 -4 M262 48 h6 M254 32 l1 -6" stroke="#a48cc9" strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

export const ScreenTimeScene: React.FC<{ scene: 'practice' | 'play' }> = ({ scene }) => (
  <Svg width="100%" height="100%" viewBox="0 0 320 120">
    <Rect width="320" height="120" rx="16" fill="#f4f0f8" />
    {scene === 'practice' ? <PracticeScene /> : <PlayScene />}
  </Svg>
);
