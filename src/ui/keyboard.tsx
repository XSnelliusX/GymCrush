import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  EmitterSubscription,
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

export interface KeyboardState {
  keyboardVisible: boolean;
  keyboardHeight: number;
}

/** Tracks live virtual keyboard visibility and height across iOS and Android. */
export function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ keyboardVisible: false, keyboardHeight: 0 });

  useEffect(() => {
    if (!Keyboard?.addListener) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs: EmitterSubscription[] = [];

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height ?? 0;
      setState({ keyboardVisible: h > 0, keyboardHeight: h });
    };
    const onHide = () => {
      setState({ keyboardVisible: false, keyboardHeight: 0 });
    };

    subs.push(Keyboard.addListener(showEvent, onShow));
    subs.push(Keyboard.addListener(hideEvent, onHide));
    if (Platform.OS === 'ios') {
      subs.push(Keyboard.addListener('keyboardDidHide', onHide));
    }

    return () => {
      for (const s of subs) s?.remove?.();
    };
  }, []);

  return state;
}

type FocusNode = React.ComponentRef<typeof View> | React.ComponentRef<typeof TextInput>;
type FocusTarget = { node: FocusNode; extraOffset: number };
type KeyboardFocusCtx = {
  scrollToInput: (node: FocusNode | null, extraOffset?: number) => void;
};

const KeyboardFocusContext = createContext<KeyboardFocusCtx | null>(null);

export function useKeyboardFocus() {
  return useContext(KeyboardFocusContext);
}

/**
 * ScrollView that keeps focused inputs visible above the soft keyboard on both iOS and Android
 * without shrinking layouts permanently when the keyboard is closed.
 */
export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  onScroll,
  extraBottomPadding = 24,
  scrollRef,
  ...rest
}: ScrollViewProps & {
  extraBottomPadding?: number;
  scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
}) {
  const internalRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const activeRef = scrollRef ?? internalRef;
  const scrollYRef = useRef(0);
  const focusedRef = useRef<FocusTarget | null>(null);
  const kbHeightRef = useRef(0);
  const { keyboardVisible, keyboardHeight } = useKeyboardState();

  const performScroll = useCallback((target: FocusTarget | null, kbHeight: number) => {
    if (!target || kbHeight <= 0 || !activeRef.current) return;
    const node = target.node as any;
    if (typeof node?.measureInWindow !== 'function') return;

    node.measureInWindow((_x: number, y: number, _w: number, height: number) => {
      if (!Number.isFinite(y) || !Number.isFinite(height)) return;
      const winHeight = Dimensions.get('window').height;
      const keyboardTop = winHeight - kbHeight;
      const bottomEdge = y + height + target.extraOffset;

      if (bottomEdge > keyboardTop) {
        const delta = bottomEdge - keyboardTop;
        activeRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + delta), animated: true });
      } else if (y < 72) {
        const delta = 72 - y;
        activeRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current - delta), animated: true });
      }
    });
  }, [activeRef]);

  useEffect(() => {
    kbHeightRef.current = keyboardHeight;
    if (keyboardVisible && keyboardHeight > 0 && focusedRef.current) {
      const timer = setTimeout(() => {
        performScroll(focusedRef.current, keyboardHeight);
      }, Platform.OS === 'android' ? 80 : 30);
      return () => clearTimeout(timer);
    }
    if (!keyboardVisible) {
      focusedRef.current = null;
    }
  }, [keyboardVisible, keyboardHeight, performScroll]);

  const scrollToInput = useCallback((node: FocusNode | null, extraOffset = 48) => {
    if (!node) {
      focusedRef.current = null;
      return;
    }
    const target = { node, extraOffset };
    focusedRef.current = target;
    if (kbHeightRef.current > 0) {
      setTimeout(() => {
        performScroll(target, kbHeightRef.current);
      }, Platform.OS === 'android' ? 90 : 40);
    }
  }, [performScroll]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  }, [onScroll]);

  const flatStyle = StyleSheet.flatten(contentContainerStyle);
  const baseBottom = typeof flatStyle?.paddingBottom === 'number' ? flatStyle.paddingBottom : 0;
  // On iOS, automaticallyAdjustKeyboardInsets handles full-screen ScrollViews; in sheets and on Android we add explicit clearance only while the keyboard is open.
  const dynamicBottom = keyboardVisible && keyboardHeight > 0
    ? baseBottom + keyboardHeight + extraBottomPadding
    : baseBottom;

  return (
    <KeyboardFocusContext.Provider value={{ scrollToInput }}>
      <ScrollView
        ref={activeRef}
        automaticallyAdjustKeyboardInsets={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        contentContainerStyle={[contentContainerStyle, keyboardVisible ? { paddingBottom: dynamicBottom } : null]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardFocusContext.Provider>
  );
}
