import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { useTheme } from '../theme/theme';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type NativeStackNavigationOptions = Exclude<ComponentProps<typeof Stack.Screen>['options'], Function | undefined>;

const isLiquidGlassOS = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

/** Header for every tab stack: iOS large title over transparent (Liquid Glass) bar; Android Material top app bar. */
export function useTabStackOptions(): NativeStackNavigationOptions {
  const { colors } = useTheme();
  return {
    headerLargeTitleEnabled: Platform.OS === 'ios',
    headerTransparent: isLiquidGlassOS,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerStyle: isLiquidGlassOS ? undefined : { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.bg },
  };
}

/** Bottom sheet presentation. iOS: native form sheet with grabber. Android: modal bottom sheet. Sheets render their own SheetHeader. */
export function sheetOptions(detents: NativeStackNavigationOptions['sheetAllowedDetents'] = 'fitToContents'): NativeStackNavigationOptions {
  return {
    presentation: 'formSheet',
    headerShown: false,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    sheetExpandsWhenScrolledToEdge: true,
  };
}
