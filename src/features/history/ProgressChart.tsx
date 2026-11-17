import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText } from '../../ui/primitives';
import { space, useTheme } from '../../theme/theme';

export interface ChartPoint { t: number; v: number }

const H = 160;
const PAD = 16;

/** Minimal line chart: partner-colored line + dots, no gridlines. Latest value is labelled. */
export function ProgressChart({ points, color, accessibilityLabel, format }: { points: ChartPoint[]; color: string; accessibilityLabel: string; format: (v: number) => string }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = (t: number) => (t1 === t0 ? w / 2 : PAD + ((t - t0) / (t1 - t0)) * (w - 2 * PAD));
  const y = (v: number) => (hi === lo ? H / 2 : H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD - 16));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <>
          <Svg width={w} height={H}>
            <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === points.length - 1 ? 6 : 4} fill={i === points.length - 1 ? color : colors.surface} stroke={color} strokeWidth={2.5} />
            ))}
          </Svg>
          <AppText variant="metric" numberOfLines={1} adjustsFontSizeToFit style={{ position: 'absolute', top: 0, left: Math.max(0, Math.min(w - 130, x(last.t) - 65)), width: 130, textAlign: 'center', marginTop: -space.xs }} color={color}>
            {format(last.v)}
          </AppText>
        </>
      )}
    </View>
  );
}
