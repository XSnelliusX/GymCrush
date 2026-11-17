import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useGymCrushStore } from '../store/useGymCrushStore';
import { gutter, radius, space, useTheme } from '../theme/theme';
import { AppText, Avatar, Icon } from '../ui/primitives';
import { useCopy } from '../i18n/useCopy';
import { formatTime } from './RestTimerBar';
import { otherPartner } from '../features/workout/workoutHelpers';

/** iOS 26+ hosts the bar in the tab bar's bottom accessory (minimizes inline on scroll). iOS < 26 screens render <WorkoutMiniBar floating />; Android's FloatingTabBar does. */
export const usesTabAccessory = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

export function WorkoutMiniBar({ floating, bottom }: { floating?: boolean; bottom?: number }) {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const placement = usesTabAccessory && !floating ? NativeTabs.BottomAccessory.usePlacement() : 'regular';
  if (!store.isSessionActive) return null;

  const user = colors.partners[store.activeUser];
  const resting = store.restSeconds > 0;
  const machine = store.sessionMachineIds.includes(store.selectedMachineId ?? '') ? store.machines.find((m) => m.id === store.selectedMachineId) : undefined;
  const machineName = machine ? (store.language === 'zh-TW' && machine.nameZh ? machine.nameZh : machine.name) : store.sessionTitle || c('Workout', '訓練');
  const partner = otherPartner(store.activeUser);
  const partnerBreak = store.partnerStatus.restSecondsRemaining;
  const status = resting ? `${c('Rest', '休息')} ${formatTime(store.restSeconds)}` : formatTime(store.sessionElapsedSeconds, true);
  const label = [c('Workout in progress', '訓練進行中'), machineName, status, partnerBreak > 0 ? c(`${store.profiles[partner].name} on a break ${formatTime(partnerBreak)}`, `${store.profiles[partner].name} 休息中 ${formatTime(partnerBreak)}`) : null].filter(Boolean).join(', ');

  return (
    <View style={floating ? [styles.floatWrap, bottom !== undefined && { bottom }] : styles.fill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={c('Opens the workout', '開啟訓練畫面')}
        // Global router: the iOS tab accessory renders outside the tab navigator's context.
        onPress={() => router.push('/workout')}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.6 }, floating && { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }]}
      >
        <View style={[styles.dot, { backgroundColor: resting ? colors.gold : user.color }]} />
        {placement === 'inline' ? (
          <AppText variant="number" numberOfLines={1}>{status}</AppText>
        ) : (
          <>
            <AppText variant="subhead" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{machineName}</AppText>
            {partnerBreak > 0 && (
              <>
                <Avatar partnerId={partner} name={store.profiles[partner].name} size={20} />
                <AppText variant="number" color={colors.gold}>{formatTime(partnerBreak)}</AppText>
              </>
            )}
            <AppText variant="number" color={resting ? colors.gold : colors.textSecondary}>{status}</AppText>
            <Icon name={{ ios: 'chevron.up', android: 'expand_less' }} size={16} color={colors.textSecondary} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  floatWrap: { position: 'absolute', left: gutter, right: gutter, bottom: space.md },
  bar: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
