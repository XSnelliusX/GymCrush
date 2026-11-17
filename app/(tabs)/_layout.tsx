import React from 'react';
import { Platform } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import { useGymCrushStore } from '../../src/store/useGymCrushStore';
import { useTheme } from '../../src/theme/theme';
import { useCopy } from '../../src/i18n/useCopy';
import { Tabs } from 'expo-router/js-tabs';
import { WorkoutMiniBar, usesTabAccessory } from '../../src/components/WorkoutMiniBar';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { Icon } from '../../src/ui/primitives';

export default function TabsLayout() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const tint = colors.partners[store.activeUser].color;

  if (Platform.OS === 'android') {
    const tabs = [
      { name: 'today', title: c('Today', '今天'), ios: 'flame', md: 'local_fire_department' },
      { name: 'machines', title: c('Machines', '器材'), ios: 'dumbbell', md: 'fitness_center' },
      { name: 'history', title: c('History', '紀錄'), ios: 'chart.bar', md: 'bar_chart' },
      { name: 'couple', title: c('Couple', '我們'), ios: 'person.2', md: 'group' },
    ] as const;
    return (
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
        {tabs.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{ title: t.title, tabBarIcon: ({ color, size }) => <Icon name={{ ios: t.ios, android: t.md }} size={size} color={color as string} /> }}
          />
        ))}
      </Tabs>
    );
  }

  return (
    <NativeTabs
      tintColor={tint}
      iconColor={{ default: colors.textSecondary, selected: tint }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.text } }}
      indicatorColor={colors.partners[store.activeUser].subtle}
      // Apple pairs minimizing with an attached accessory; without a workout bar keep navigation visible.
      minimizeBehavior={store.isSessionActive ? 'onScrollDown' : 'never'}
      labelVisibilityMode="labeled"
    >
      {usesTabAccessory && store.isSessionActive && (
        <NativeTabs.BottomAccessory>
          <WorkoutMiniBar />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
        <NativeTabs.Trigger.Label>{c('Today', '今天')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="machines">
        <NativeTabs.Trigger.Icon sf="dumbbell" md="fitness_center" />
        <NativeTabs.Trigger.Label>{c('Machines', '器材')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
        <NativeTabs.Trigger.Label>{c('History', '紀錄')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="couple">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>{c('Couple', '我們')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
