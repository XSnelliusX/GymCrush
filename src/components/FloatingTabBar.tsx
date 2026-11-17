import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useGymCrushStore } from '../store/useGymCrushStore';
import { gutter, radius, space, useTheme } from '../theme/theme';
import { AppText, haptics } from '../ui/primitives';
import { WorkoutMiniBar } from './WorkoutMiniBar';

const BAR_HEIGHT = 64;

/** Android stand-in for the iOS 26 floating tab bar; also hosts the workout mini bar above it. */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const store = useGymCrushStore();
  const user = colors.partners[store.activeUser];
  const bottom = insets.bottom + space.sm;

  return (
    <>
      <WorkoutMiniBar floating bottom={bottom + BAR_HEIGHT + space.sm} />
      <View
        accessibilityRole="tablist"
        style={[styles.bar, { bottom, backgroundColor: colors.surfaceRaised, borderColor: colors.separator }]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const onPress = () => {
            haptics.selection();
            // Emitting lets the nested stack pop to top when the focused tab is pressed again.
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.item, focused && { backgroundColor: user.subtle }, pressed && { opacity: 0.6 }]}
            >
              {options.tabBarIcon?.({ focused, color: focused ? user.color : colors.textSecondary, size: 24 })}
              <AppText
                numberOfLines={1}
                color={focused ? colors.text : colors.textSecondary}
                style={styles.label}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: gutter, right: gutter, height: BAR_HEIGHT, flexDirection: 'row', padding: 4,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.pill },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
});
