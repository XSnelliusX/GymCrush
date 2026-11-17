import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useGymCrushStore } from '../store/useGymCrushStore';
import { gutter, radius, space, useTheme } from '../theme/theme';
import { AppText, Avatar, haptics } from '../ui/primitives';

/** The app's single presenter for incoming cheers and PR alerts (the store expires them). */
export function ReactionBanner({ inSheet }: { inSheet?: boolean }) {
  const store = useGymCrushStore();
  // Your own routine sets already show in the set table; only your PRs earn a banner.
  const own = store.latestReaction?.id.startsWith('set_self_') && store.latestReaction.emoji !== '👑';
  const reaction = own ? null : store.latestReaction;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (!reaction) { Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(); return; }
    if (!inSheet) haptics.success(); // the root banner already fired; iOS modals need their own visible copy
    if (!inSheet) AccessibilityInfo.announceForAccessibility(`${store.profiles[reaction.fromUser]?.name ?? ''}: ${reaction.emoji} ${reaction.message}`);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) y.setValue(0);
      else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction?.id]);

  if (!reaction) return null;
  const from = store.profiles[reaction.fromUser];
  const opensPartner = /^(set_alert_|session_start_)/.test(reaction.id);
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: inSheet ? space.sm : insets.top + space.sm, transform: [{ translateY: y }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={opensPartner ? 'Opens their workout' : 'Dismiss'}
        onPress={() => { store.dismissReaction(); if (opensPartner) router.navigate('/partner-workout'); }}
        style={[styles.banner, { backgroundColor: colors.surfaceRaised, borderColor: colors.separator }]}
      >
        <Avatar partnerId={reaction.fromUser} name={from?.name ?? ''} size={36} />
        <AppText style={{ fontSize: 28, lineHeight: 34 }}>{reaction.emoji}</AppText>
        <AppText variant="subhead" numberOfLines={2} style={{ flex: 1, fontWeight: '600' }}>{reaction.message || from?.name}</AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: gutter, right: gutter, zIndex: 100 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
});
