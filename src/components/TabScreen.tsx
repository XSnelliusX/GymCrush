import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { WorkoutMiniBar, usesTabAccessory } from './WorkoutMiniBar';

/** Wrap every tab root screen. On iOS < 26 it floats the active-workout bar above the tab bar. */
export function TabScreen({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  // iOS large titles track the scroll view only when it is the screen's direct child, so no wrapper there.
  if (usesTabAccessory || Platform.OS === 'android') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {children}
      <WorkoutMiniBar floating />
    </View>
  );
}
