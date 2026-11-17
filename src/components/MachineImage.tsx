import React, { useEffect, useState } from 'react';
import { AppState, Image, ImageProps } from 'react-native';
import { syncEngine } from '../services/syncEngine';
import { useTheme } from '../theme/theme';

export function MachineImage(props: ImageProps) {
  const { colors } = useTheme();
  const source = props.source as { uri?: string };
  const uri = source?.uri || '';
  const [resolved, setResolved] = useState(uri.startsWith('supabase:') ? '' : uri);
  useEffect(() => {
    let active = true;
    const resolve = async () => {
      try {
        const result = await syncEngine.cloud?.resolvePhoto(uri) || uri;
        if (active) setResolved(result.startsWith('supabase:') ? '' : result);
      } catch { /* Leave the placeholder while offline; retry on returning to the app. */ }
    };
    setResolved(uri.startsWith('supabase:') ? '' : uri);
    void resolve();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void resolve(); });
    const timer = setInterval(() => void resolve(), 3600000);
    return () => { active = false; subscription.remove(); clearInterval(timer); };
  }, [uri]);
  // Neutral well shows while the photo resolves or when there is none.
  return <Image resizeMode="cover" {...props} style={[{ backgroundColor: colors.fill }, props.style]} source={resolved ? { uri: resolved } : undefined} />;
}
