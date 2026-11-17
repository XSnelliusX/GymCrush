import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TabScreen } from '../../../src/components/TabScreen';
import { MachineTile } from '../../../src/features/machines/MachineTile';
import { machineLocation, MUSCLE_GROUPS } from '../../../src/features/machines/machineUtils';
import { MUSCLE_LABELS } from '../../../src/i18n/translations';
import { useCopy } from '../../../src/i18n/useCopy';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { gutter, space } from '../../../src/theme/theme';
import { MuscleGroup } from '../../../src/types/gym';
import { Chip, EmptyState, IconButton, ScreenScroll } from '../../../src/ui/primitives';

// "lat" should find "Lat Pulldown", not "platform".
function matchesWordStart(text: string, q: string) {
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true;
  return false;
}

export default function MachinesScreen() {
  const router = useRouter();
  const c = useCopy();
  const { machines, activeUser, profiles, language } = useGymCrushStore();
  const labels = MUSCLE_LABELS[language];
  const [filter, setFilter] = useState<'All' | MuscleGroup>('All');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines.filter((m) => {
      if (filter !== 'All' && m.muscleGroup !== filter) return false;
      if (!q) return true;
      return [m.name, m.nameZh, m.muscleGroup, labels[m.muscleGroup], machineLocation(m, language), m.locationNote]
        .some((s) => !!s && matchesWordStart(s.toLowerCase(), q));
    });
  }, [machines, filter, query, labels, language]);

  const addMachine = () => router.push('/new-machine');
  // Pair tiles into rows so the grid stays a plain ScrollView (ScreenScroll) with flex columns.
  const rows: (typeof visible)[] = [];
  for (let i = 0; i < visible.length; i += 2) rows.push(visible.slice(i, i + 2));

  return (
    <TabScreen>
      <Stack.Screen
        options={{
          title: c('Machines', '器材'),
          headerSearchBarOptions: {
            placeholder: c('Search machines', '搜尋器材'),
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            hideWhenScrolling: false,
          },
          headerRight: () => (
            <IconButton
              icon={{ ios: 'plus', android: 'add' }}
              label={c('Add machine', '新增器材')}
              onPress={addMachine}
            />
          ),
        }}
      />
      <ScreenScroll>
        {machines.length === 0 ? (
          <EmptyState
            icon={{ ios: 'camera', android: 'photo_camera' }}
            title={c('Add your first machine', '新增你的第一台器材')}
            body={c(
              'Snap a photo of a machine and save both partners’ seat and pin settings, so neither of you has to remember them.',
              '拍下器材照片，並儲存你們兩人的座椅與插銷設定，再也不用死記。',
            )}
            action={{ title: c('Add machine', '新增器材'), onPress: addMachine }}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -gutter, marginBottom: space.lg }}
              contentContainerStyle={{ gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.xs }}
            >
              {(['All', ...MUSCLE_GROUPS] as const).map((g) => (
                <Chip key={g} label={labels[g]} selected={filter === g} onPress={() => setFilter(g)} />
              ))}
            </ScrollView>
            {visible.length === 0 ? (
              <EmptyState
                icon={{ ios: 'magnifyingglass', android: 'search' }}
                title={c('No machines found', '找不到器材')}
                body={query.trim()
                  ? c(`Nothing matches “${query.trim()}”. Try another name or muscle group.`, `沒有符合「${query.trim()}」的器材，換個名稱或肌群試試。`)
                  : c('No machines in this muscle group yet.', '這個肌群還沒有器材。')}
                action={{ title: c('Add machine', '新增器材'), onPress: addMachine }}
              />
            ) : (
              <View style={{ gap: space.xxl }}>
                {rows.map((row) => (
                  <View key={row[0].id} style={{ flexDirection: 'row', gap: space.md }}>
                    {row.map((m) => (
                      <View key={m.id} style={{ flex: 1 }}>
                        <MachineTile
                          machine={m}
                          activeUser={activeUser}
                          activeName={profiles[activeUser].name}
                          language={language}
                          onPress={() => router.push(`/machines/${m.id}`)}
                        />
                      </View>
                    ))}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScreenScroll>
    </TabScreen>
  );
}

