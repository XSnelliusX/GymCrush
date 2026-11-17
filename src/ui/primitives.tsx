import React from 'react';
import {
  AccessibilityRole,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { PartnerId } from '../types/gym';
import { gutter, radius, space, touch, TypeVariant, useTheme } from '../theme/theme';

// ---------- Haptics ----------
export const haptics = {
  selection: () => { Haptics.selectionAsync().catch(() => {}); },
  impact: (style: 'light' | 'medium' | 'heavy' = 'light') => {
    const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
    Haptics.impactAsync(map[style]).catch(() => {});
  },
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};

// ---------- Icon ----------
/** SF Symbol on iOS, Material Symbol on Android. Always pass both names. */
export type IconName = { ios: Extract<SymbolViewProps['name'], string>; android: NonNullable<Exclude<SymbolViewProps['name'], string>['android']> };

export function Icon({ name, size = 22, color, weight = 'semibold', style }: { name: IconName; size?: number; color?: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android }}
      size={size}
      tintColor={color ?? colors.text}
      weight={Platform.OS === 'ios' ? weight : undefined}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// ---------- Text ----------
type Tone = 'primary' | 'secondary' | 'tertiary';
export function AppText({ variant = 'body', tone = 'primary', color, style, ...rest }: TextProps & { variant?: TypeVariant; tone?: Tone; color?: string }) {
  const { colors, type } = useTheme();
  const toneColor = tone === 'secondary' ? colors.textSecondary : tone === 'tertiary' ? colors.textTertiary : colors.text;
  return <Text maxFontSizeMultiplier={2} {...rest} style={[type[variant], { color: color ?? toneColor }, style]} />;
}

// ---------- Pressable base ----------
function usePressStyle(): { pressedStyle: (pressed: boolean) => ViewStyle } {
  return { pressedStyle: (pressed) => (pressed ? { opacity: 0.6 } : {}) };
}

// ---------- Button ----------
export type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'destructive';
export function Button({
  title, onPress, variant = 'filled', size = 'regular', icon, tint, disabled, loading, style, accessibilityHint, haptic = true,
}: {
  title: string; onPress: () => void; variant?: ButtonVariant; size?: 'small' | 'regular' | 'large';
  icon?: IconName; tint?: { color: string; onColor: string; subtle: string }; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityHint?: string; haptic?: boolean;
}) {
  const { colors, type } = useTheme();
  const t = tint ?? { color: colors.text, onColor: colors.bg, subtle: colors.fill };
  const bg = variant === 'filled' ? t.color : variant === 'tinted' ? t.subtle : variant === 'destructive' ? colors.dangerSubtle : 'transparent';
  const fg = variant === 'filled' ? t.onColor : variant === 'tinted' ? t.color : variant === 'destructive' ? colors.danger : t.color;
  const height = size === 'large' ? touch.large : size === 'small' ? 36 : touch.min + 4;
  const press = usePressStyle();
  return (
    <View style={[styles.btnClip, { borderRadius: radius.pill, opacity: disabled ? 0.4 : 1 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        accessibilityHint={accessibilityHint}
        disabled={disabled || loading}
        onPress={() => { if (haptic) haptics.impact('light'); onPress(); }}
       
        hitSlop={size === 'small' ? 6 : 0}
        style={({ pressed }) => [styles.btn, { backgroundColor: bg, minHeight: height, paddingHorizontal: size === 'small' ? space.md : space.xl }, press.pressedStyle(pressed)]}
      >
        {loading ? <ActivityIndicator color={fg} /> : (
          <>
            {icon && <Icon name={icon} size={size === 'small' ? 15 : 18} color={fg} />}
            <Text maxFontSizeMultiplier={1.6} style={[size === 'small' ? type.subhead : type.headline, { color: fg, fontWeight: '600' }]} numberOfLines={1}>{title}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ---------- IconButton ----------
export function IconButton({
  icon, label, onPress, variant = 'plain', color, size = touch.min, iconSize = 20, disabled, style,
}: {
  icon: IconName; label: string; onPress: () => void; variant?: 'plain' | 'filled' | 'tinted';
  color?: { color: string; onColor: string; subtle: string }; size?: number; iconSize?: number; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const c = color ?? { color: colors.text, onColor: colors.bg, subtle: colors.fill };
  const bg = variant === 'filled' ? c.color : variant === 'tinted' ? c.subtle : 'transparent';
  const fg = variant === 'filled' ? c.onColor : c.color;
  const press = usePressStyle();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', opacity: disabled ? 0.4 : 1 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => { haptics.selection(); onPress(); }}
       
        style={({ pressed }) => [styles.center, { flex: 1, backgroundColor: bg }, press.pressedStyle(pressed)]}
      >
        <Icon name={icon} size={iconSize} color={fg} />
      </Pressable>
    </View>
  );
}

// ---------- Card ----------
export function Card({ children, style, padded = true, onPress, accessibilityLabel, accessibilityRole }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; onPress?: () => void; accessibilityLabel?: string; accessibilityRole?: AccessibilityRole;
}) {
  const { colors } = useTheme();
  const press = usePressStyle();
  const base = [styles.card, { backgroundColor: colors.surface }, padded && { padding: space.lg }];
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <View style={[styles.card, style]}>
      <Pressable accessibilityRole={accessibilityRole ?? 'button'} accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, press.pressedStyle(pressed)]}>
        {children}
      </Pressable>
    </View>
  );
}

// ---------- List section & row (iOS inset grouped / Material list on a card) ----------
export function ListSection({ header, footer, children, style }: { header?: string; footer?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginBottom: space.xxl }, style]}>
      {header && <AppText variant="footnote" tone="secondary" accessibilityRole="header" style={styles.sectionHeader}>{header}</AppText>}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) => (
          <View key={i}>
            {row}
            {i < rows.length - 1 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.lg }} />}
          </View>
        ))}
      </View>
      {footer && <AppText variant="footnote" tone="secondary" style={styles.sectionFooter}>{footer}</AppText>}
    </View>
  );
}

export function ListRow({
  title, subtitle, value, icon, iconColor, onPress, accessory, destructive, disabled, accessibilityHint,
}: {
  title: string; subtitle?: string; value?: string; icon?: IconName; iconColor?: string; onPress?: () => void;
  accessory?: 'chevron' | 'none' | React.ReactNode; destructive?: boolean; disabled?: boolean; accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const showChevron = accessory === 'chevron' || (accessory === undefined && !!onPress);
  const content = (
    <>
      {icon && <Icon name={icon} size={20} color={iconColor ?? (destructive ? colors.danger : colors.textSecondary)} />}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color={destructive ? colors.danger : undefined}>{title}</AppText>
        {subtitle && <AppText variant="footnote" tone="secondary">{subtitle}</AppText>}
      </View>
      {value !== undefined && <AppText tone="secondary" numberOfLines={1} style={{ maxWidth: '45%' }}>{value}</AppText>}
      {React.isValidElement(accessory) && accessory}
      {showChevron && <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={colors.textTertiary} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
     
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }, disabled && { opacity: 0.4 }]}
    >
      {content}
    </Pressable>
  );
}

// ---------- Segmented control (iOS segmented control / M3 segmented buttons) ----------
export function SegmentedControl<T extends string>({
  options, value, onChange, accessibilityLabel, style,
}: {
  options: { value: T; label: string; tint?: { color: string; onColor: string } }[];
  value: T; onChange: (v: T) => void; accessibilityLabel: string; style?: StyleProp<ViewStyle>;
}) {
  const { colors, type } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.segment, { backgroundColor: colors.fill }, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        const bg = selected ? (o.tint?.color ?? colors.surfaceRaised) : 'transparent';
        const fg = selected ? (o.tint?.onColor ?? colors.text) : colors.textSecondary;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => { if (!selected) { haptics.selection(); onChange(o.value); } }}
            style={[styles.segmentItem, { backgroundColor: bg }, selected && !o.tint && styles.segmentShadow]}
          >
            <Text maxFontSizeMultiplier={1.6} numberOfLines={1} style={[type.subhead, { color: fg, fontWeight: selected ? '600' : '500' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Chip (filter) ----------
export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const { colors, type } = useTheme();
  const press = usePressStyle();
  return (
    <View style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        onPress={() => { haptics.selection(); onPress(); }}
       
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => [styles.chip, { backgroundColor: selected ? colors.text : colors.fill }, press.pressedStyle(pressed)]}
      >
        {icon && <Icon name={icon} size={14} color={selected ? colors.bg : colors.text} />}
        <Text maxFontSizeMultiplier={1.6} style={[type.subhead, { color: selected ? colors.bg : colors.text, fontWeight: '500' }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ partnerId, name, size = 36, online }: { partnerId: PartnerId; name: string; size?: number; online?: boolean }) {
  const { colors } = useTheme();
  const p = colors.partners[partnerId];
  return (
    <View accessible accessibilityLabel={name} style={{ width: size, height: size }}>
      <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.color }]}>
        <Text allowFontScaling={false} style={{ color: p.onColor, fontWeight: '700', fontSize: size * 0.42 }}>{(name.trim()[0] || '?').toUpperCase()}</Text>
      </View>
      {online !== undefined && (
        <View style={{ position: 'absolute', right: -1, bottom: -1, width: size * 0.32, height: size * 0.32, borderRadius: size, borderWidth: 2, borderColor: colors.surface, backgroundColor: online ? colors.success : colors.textTertiary }} />
      )}
    </View>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: { title: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.center, { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.fill }]}>
        <Icon name={icon} size={28} color={colors.textSecondary} />
      </View>
      <AppText variant="title3" style={{ textAlign: 'center' }}>{title}</AppText>
      {body && <AppText tone="secondary" style={{ textAlign: 'center' }}>{body}</AppText>}
      {action && <Button title={action.title} onPress={action.onPress} style={{ marginTop: space.sm }} />}
    </View>
  );
}

// ---------- Sheet header (form sheets have no native header on Android) ----------
export function SheetHeader({ title, onClose, closeLabel, action }: {
  title: string; onClose: () => void; closeLabel: string;
  action?: { label: string; onPress: () => void; disabled?: boolean; tint?: { color: string; onColor: string; subtle: string } };
}) {
  return (
    <View style={styles.sheetHeader}>
      <IconButton icon={{ ios: 'xmark', android: 'close' }} label={closeLabel} onPress={onClose} variant="tinted" size={touch.min} iconSize={16} />
      <AppText variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{title}</AppText>
      {action ? (
        <Button title={action.label} onPress={action.onPress} disabled={action.disabled} size="small" tint={action.tint} />
      ) : <View style={{ width: touch.min }} />}
    </View>
  );
}

// ---------- Text field ----------
/** Labeled input well. Label is visible (not placeholder-only); `error` is announced and shown under the field. */
export function TextField({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={[{ gap: space.xs }, style]}>
      <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.text}
        maxFontSizeMultiplier={2}
        {...rest}
        style={[type.body, { color: colors.text, backgroundColor: colors.fill, borderRadius: radius.md, minHeight: touch.min + 4, paddingHorizontal: space.lg, paddingVertical: space.sm }, error ? { borderWidth: 1.5, borderColor: colors.danger } : null]}
      />
      {error ? <AppText variant="footnote" color={colors.danger} accessibilityLiveRegion="polite" style={{ paddingHorizontal: space.xs }}>{error}</AppText> : null}
    </View>
  );
}

// ---------- Screen scroll ----------
/** Use for every tab screen: lets the native large title collapse and keeps content clear of the tab bar. */
export function ScreenScroll({ padded = true, contentContainerStyle, children, ...rest }: React.ComponentProps<typeof ScrollView> & { padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[padded && { paddingHorizontal: gutter }, { paddingTop: space.sm, paddingBottom: Platform.OS === 'android' ? 190 : 120 }, contentContainerStyle]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  btnClip: { overflow: 'hidden' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  card: { borderRadius: radius.card, overflow: 'hidden' },
  sectionHeader: { paddingHorizontal: space.lg, paddingBottom: space.sm, fontWeight: '600' },
  sectionFooter: { paddingHorizontal: space.lg, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.min + 8, paddingHorizontal: space.lg, paddingVertical: space.sm },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, minHeight: touch.min - 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space.md },
  segmentShadow: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.lg, borderRadius: radius.pill },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
});
