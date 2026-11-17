import { Platform, TextStyle, useColorScheme } from 'react-native';
import { PartnerId } from '../types/gym';

/**
 * GymCrush design tokens. See docs/DESIGN.md for the rules.
 * One color means one thing: each partner owns a hue (Markus blue, partner orange),
 * gold means PR, green means a completed set, red means destructive. Everything else is neutral.
 * Contrast (WCAG) of every text color against `surface` is >= 5.0:1 in both schemes.
 */
const dark = {
  bg: '#0B0B0E',
  surface: '#18181C',
  surfaceRaised: '#232329',
  fill: '#2E2E35', // input wells, stepper buttons, inactive segments
  separator: '#34343C',
  text: '#F5F5F7',
  textSecondary: '#A3A3AD',
  textTertiary: '#8A8A94',
  gold: '#FFD54A',
  goldSubtle: '#3A3218',
  success: '#3DDC6A',
  successSubtle: '#163A22',
  danger: '#FF6B61',
  dangerSubtle: '#3D1D1B',
  scrim: 'rgba(0,0,0,0.55)',
  partners: {
    markus: { color: '#4FB3FF', onColor: '#00213D', subtle: '#14293B' },
    partner: { color: '#FF8A5B', onColor: '#2E0F00', subtle: '#3A2219' },
  } as Record<PartnerId, { color: string; onColor: string; subtle: string }>,
};

const light: typeof dark = {
  bg: '#F2F2F6',
  surface: '#FFFFFF',
  surfaceRaised: '#F7F7FA',
  fill: '#E9E9EE',
  separator: '#DCDCE2',
  text: '#111114',
  textSecondary: '#5B5B66',
  textTertiary: '#6E6E78',
  gold: '#8A6200',
  goldSubtle: '#FFF3CC',
  success: '#1A7F37',
  successSubtle: '#DDF3E3',
  danger: '#C4281C',
  dangerSubtle: '#FBE3E1',
  scrim: 'rgba(0,0,0,0.35)',
  partners: {
    markus: { color: '#0A6CC0', onColor: '#FFFFFF', subtle: '#E1EFFB' },
    partner: { color: '#BF3F0A', onColor: '#FFFFFF', subtle: '#FCE9E0' },
  },
};

export type ThemeColors = typeof dark;

// iOS gets SF Pro Rounded for numerals (timers, weights, streaks); Android keeps Roboto.
const numeralFamily = Platform.select({ ios: 'ui-rounded', default: undefined });
const num: TextStyle = { fontFamily: numeralFamily, fontVariant: ['tabular-nums'] };

/** Text styles mirror iOS Dynamic Type sizes; they also sit on Material 3's body/title roles. Never go below caption (12). */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  // Numerals
  display: { ...num, fontSize: 56, lineHeight: 60, fontWeight: '700' },
  timer: { ...num, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  metric: { ...num, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  number: { ...num, fontSize: 17, lineHeight: 22, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
/** Screen side gutter. */
export const gutter = 16;
export const radius = { sm: 8, md: 12, lg: 16, card: 20, sheet: 28, pill: 999 } as const;
/** Minimum hit target: 44pt iOS, 48dp Android. Gym-floor controls use `touch.large`. */
export const touch = { min: Platform.OS === 'android' ? 48 : 44, large: 56 } as const;

export function useTheme() {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = scheme === 'light' ? light : dark;
  return { scheme, colors, type, space, radius, touch, gutter } as const;
}

export type Theme = ReturnType<typeof useTheme>;
