import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/theme';

/**
 * Signature element: two concentric weekly-goal rings, one per partner, in their own colors.
 * Outer ring = first ring in `rings`. Progress is clamped to 0..1.
 */
export function DuoRings({ rings, size = 160, stroke = 16, gap = 4, children, accessibilityLabel }: {
  rings: { progress: number; color: string }[]; size?: number; stroke?: number; gap?: number;
  children?: React.ReactNode; accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {rings.map((ring, i) => {
          const r = size / 2 - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(1, ring.progress));
          return (
            <React.Fragment key={i}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
              {p > 0 && (
                <Circle
                  cx={size / 2} cy={size / 2} r={r} stroke={ring.color} strokeWidth={stroke} fill="none"
                  strokeLinecap="round" strokeDasharray={`${c * p} ${c}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {children}
    </View>
  );
}
