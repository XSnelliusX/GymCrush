import React from 'react';
import { Pressable, Platform, View } from 'react-native';
import { MachineImage } from '../../components/MachineImage';
import { MUSCLE_LABELS } from '../../i18n/translations';
import { radius, space, useTheme } from '../../theme/theme';
import { GymMachine, Language, PartnerId } from '../../types/gym';
import { AppText } from '../../ui/primitives';
import { machineName, resolveAdjustments, settingsSummary } from './machineUtils';

/** Grid tile: 4:3 photo, name, muscle, and the active user's settings in their partner hue. */
export function MachineTile({ machine, activeUser, activeName, language, onPress }: {
  machine: GymMachine; activeUser: PartnerId; activeName: string; language: Language; onPress: () => void;
}) {
  const { colors } = useTheme();
  const p = colors.partners[activeUser];
  const name = machineName(machine, language);
  const muscle = MUSCLE_LABELS[language][machine.muscleGroup];
  const summary = settingsSummary(resolveAdjustments(machine, activeUser, language));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${muscle}. ${activeName}: ${summary}`}
      onPress={onPress}
      android_ripple={{ color: colors.separator, foreground: true }}
      style={({ pressed }) => [{ gap: space.xs }, Platform.OS === 'ios' && pressed && { opacity: 0.6 }]}
    >
      <MachineImage source={{ uri: machine.photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg }} />
      <AppText variant="headline" numberOfLines={2} style={{ marginTop: space.xs }}>{name}</AppText>
      <AppText variant="footnote" tone="secondary" numberOfLines={1}>{muscle}</AppText>
      {!!summary && (
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: p.subtle, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xxs }}>
          <AppText variant="caption" color={p.color} numberOfLines={2}>
            {/* Initial keeps the hue from being the only cue for whose settings these are. */}
            <AppText variant="caption" color={p.color} style={{ fontWeight: '700' }}>{(activeName.trim()[0] || '?').toUpperCase()}  </AppText>
            {summary}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
