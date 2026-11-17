import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useGymCrushStore } from '../../store/useGymCrushStore';
import { useCopy } from '../../i18n/useCopy';
import { gutter, radius, space, useTheme } from '../../theme/theme';
import { AppText, Avatar, Button } from '../../ui/primitives';
import { DuoRings } from '../../ui/DuoRings';
import { calculatePlatesPerSide, formatTime, PlateCount, restProgress } from '../../components/RestTimerBar';
import { otherPartner } from './workoutHelpers';

// The only glass surface in the app (docs/DESIGN.md).
const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** Floating rest panel pinned above the home indicator. Renders nothing when not resting. */
export function RestPanel({ onHeight }: { onHeight: (h: number) => void }) {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const [platesOpen, setPlatesOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const resting = store.restSeconds > 0;

  useEffect(() => {
    if (!resting) { enter.setValue(0); onHeight(0); return; }
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) enter.setValue(1);
      else Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting]);

  if (!resting) return null;

  const me = store.activeUser;
  const partner = otherPartner(me);
  const user = colors.partners[me];
  const unit = store.profiles[me].unit;
  const remaining = store.restSeconds;
  const progress = restProgress(remaining, store.restDurationSeconds);
  const partnerRest = store.partnerStatus.restSecondsRemaining || 0;
  const machine = store.selectedMachine;
  const myWeight = machine?.partnerSetups?.[me]?.lastWorkingWeight ?? 0;
  const plates = calculatePlatesPerSide(myWeight, unit === 'kg' ? 20 : 45, unit);
  const platesText = (list: PlateCount[]) => list.length ? list.map((p) => `${p.count}×${p.plate}`).join(' + ') + ` ${unit}` : c('Empty bar', '空槓');

  const adjust = (d: number) => store.startRest(Math.max(1, remaining + d));

  const body = (
    <View style={styles.body}>
      <View style={styles.top}>
        <DuoRings
          rings={[{ progress, color: user.color }]} size={56} stroke={6}
          accessibilityLabel={c(`Rest ${Math.round(progress * 100)}% done`, `休息已完成 ${Math.round(progress * 100)}%`)}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="footnote" tone="secondary">{c(`${store.profiles[me].name} resting`, `${store.profiles[me].name} 休息中`)}</AppText>
          <AppText variant="timer" accessibilityRole="timer" accessibilityLabel={c(`${formatTime(remaining)} rest remaining`, `剩餘休息 ${formatTime(remaining)}`)}>{formatTime(remaining)}</AppText>
        </View>
        {partnerRest > 0 && (
          <View style={styles.partnerRest} accessible accessibilityLabel={c(`${store.profiles[partner].name} resting ${formatTime(partnerRest)}`, `${store.profiles[partner].name} 休息 ${formatTime(partnerRest)}`)}>
            <Avatar partnerId={partner} name={store.profiles[partner].name} size={24} />
            <AppText variant="number" tone="secondary">{formatTime(partnerRest)}</AppText>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <Button title="−15s" variant="tinted" size="large" style={styles.ctrl} onPress={() => adjust(-15)} accessibilityHint={c('Shortens rest by 15 seconds', '休息減少 15 秒')} />
        <Button title="+15s" variant="tinted" size="large" style={styles.ctrl} onPress={() => adjust(15)} accessibilityHint={c('Adds 15 seconds of rest', '休息增加 15 秒')} />
        <Button title={c('Skip', '跳過')} variant="tinted" tint={user} size="large" style={styles.ctrl} onPress={store.cancelRest} />
      </View>
      {myWeight > 0 && (
        <View>
          <Button
            title={c('Plate calculator', '槓片計算')}
            variant="plain"
            size="small"
            icon={platesOpen ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }}
            onPress={() => setPlatesOpen((o) => !o)}
            style={{ alignSelf: 'flex-start' }}
            accessibilityHint={platesOpen ? c('Hides plates', '隱藏槓片') : c('Shows plates per side', '顯示每側槓片')}
          />
          {platesOpen && (
            <View style={{ gap: space.xs, paddingHorizontal: space.md }}>
              <AppText variant="subhead">
                {c(`${myWeight} ${unit} per side: `, `${myWeight} ${unit} 每側：`)}
                <AppText variant="subhead" style={{ fontWeight: '600' }}>{platesText(plates.plates)}</AppText>
              </AppText>
              <AppText variant="footnote" tone="secondary">
                {c(`Bar ${unit === 'kg' ? 20 : 45} ${unit}`, `槓 ${unit === 'kg' ? 20 : 45} ${unit}`)}{plates.remainder > 0 ? c(` · ${plates.remainder} ${unit} left over`, ` · 剩 ${plates.remainder} ${unit}`) : ''}
              </AppText>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height + space.md)}
      style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md), opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
    >
      {useGlass ? (
        <GlassView glassEffectStyle="regular" style={[styles.panel, { overflow: 'hidden' }]}>{body}</GlassView>
      ) : (
        <View style={[styles.panel, styles.shadow, { backgroundColor: colors.surfaceRaised, borderColor: colors.separator }]}>{body}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: gutter / 2, right: gutter / 2 },
  panel: { borderRadius: radius.sheet },
  shadow: { borderWidth: StyleSheet.hairlineWidth, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  body: { padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  partnerRest: { alignItems: 'center', gap: space.xs },
  controls: { flexDirection: 'row', gap: space.sm },
  ctrl: { flex: 1 },
});
