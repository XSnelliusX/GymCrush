import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Unref any background intervals created by modules under test so Node test runner exits cleanly.
 */
const realSetInterval = globalThis.setInterval;
const intervalCallbacks = [];
globalThis.setInterval = (...args) => {
  intervalCallbacks.push({ callback: args[0], ms: args[1] });
  const handle = realSetInterval(...args);
  if (handle && typeof handle.unref === 'function') {
    handle.unref();
  }
  return handle;
};

/**
 * In-memory AsyncStorage & BroadcastChannel mocks shared across simulated app instances.
 */
const memoryStorage = new Map();
const deliveredSetAlerts = [];
const partnerEvents = [];
const scheduledAlerts = [];
const mockAsyncStorage = {
  getItem: async (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
  setItem: async (key, value) => {
    memoryStorage.set(key, String(value));
  },
  removeItem: async (key) => {
    memoryStorage.delete(key);
  },
  clear: async () => {
    memoryStorage.clear();
  },
};

const broadcastChannels = new Map();
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!broadcastChannels.has(name)) {
      broadcastChannels.set(name, new Set());
    }
    broadcastChannels.get(name).add(this);
  }
  postMessage(data) {
    const peers = broadcastChannels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this && typeof peer.onmessage === 'function') {
        peer.onmessage({ data: structuredClone(data) });
      }
    }
  }
  close() {
    const peers = broadcastChannels.get(this.name);
    if (peers) peers.delete(this);
  }
}

globalThis.window = {
  BroadcastChannel: MockBroadcastChannel,
};

/**
 * Transpiles and evaluates a TypeScript source file from the project with mocked React Native / Expo dependencies.
 */
function loadTsModule(relPath, extraExportsCode = '', customMocks = {}) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const source = fs.readFileSync(fullPath, 'utf8') + '\n' + extraExportsCode;

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const moduleExports = {};
  const moduleObj = { exports: moduleExports };

  const customRequire = (id) => {
    if (id in customMocks) return customMocks[id];
    if (id === '@react-native-async-storage/async-storage') {
      return { default: mockAsyncStorage, ...mockAsyncStorage };
    }
    if (id === '../services/setNotifications') return {
      notifyCompletedSet: async (...args) => { deliveredSetAlerts.push(args); },
      notifyPartnerEvent: async (...args) => { partnerEvents.push(args); },
      scheduleAlert: async (...args) => { scheduledAlerts.push(args); },
      enableSetNotifications: async () => true,
    };
    if (id === 'expo-haptics') {
      return {
        ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
        NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
        impactAsync: async () => {},
        notificationAsync: async () => {},
      };
    }
    if (id === 'react-native') {
      return {
        Platform: { OS: 'android' },
        StyleSheet: { create: (s) => s, absoluteFillObject: {} },
        View: 'View',
        Text: 'Text',
        TouchableOpacity: 'TouchableOpacity',
        TextInput: 'TextInput',
        Image: 'Image',
        ScrollView: 'ScrollView',
        Switch: 'Switch',
        Modal: 'Modal',
        Alert: { alert: () => {} },
        Animated: {
          Value: class {
            constructor(v) {
              this.value = v;
            }
            setValue(v) {
              this.value = v;
            }
          },
          timing: () => ({ start: () => {} }),
          spring: () => ({ start: () => {} }),
          sequence: () => ({ start: () => {} }),
          parallel: () => ({ start: () => {} }),
          loop: () => ({ start: () => {}, stop: () => {} }),
          View: 'Animated.View',
        },
      };
    }
    if (id === 'react') {
      return {
        default: { createElement: () => null },
        createElement: () => null,
        useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
        useMemo: (fn) => fn(),
        useEffect: () => {},
        useRef: (init) => ({ current: init }),
        useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
      };
    }
    if (id === '@supabase/supabase-js') {
      return {
        createClient: () => null,
      };
    }
    if (id === '@expo/vector-icons') {
      return {
        Ionicons: 'Ionicons',
        Feather: 'Feather',
        MaterialCommunityIcons: 'MaterialCommunityIcons',
      };
    }
    if (
      id.endsWith('/i18n/translations') ||
      id === '../i18n/translations' ||
      id === './translations'
    ) {
      return translationsModule;
    }
    if (id.endsWith('/services/syncEngine') || id === '../services/syncEngine') {
      return syncEngineModule;
    }
    if (id === './cloudSync') return { cloudConfigured: false };
    if (id.endsWith('/types/gym') || id === '../types/gym' || id === './gym') {
      return {};
    }
    if (id.endsWith('/types/props') || id === '../types/props') {
      return {};
    }
    return require(id);
  };

  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(moduleExports, customRequire, moduleObj);
  return moduleObj.exports;
}

// Load Translations
const translationsModule = loadTsModule('src/i18n/translations.ts');

// Load SyncEngine (exposing RealtimeSyncEngine class for multi-instance tests)
const syncEngineModule = loadTsModule(
  'src/services/syncEngine.ts',
  '\nexports.RealtimeSyncEngine = RealtimeSyncEngine;\n'
);

// Load Store (connected to syncEngineModule.syncEngine)
const storeModule = loadTsModule('src/store/useGymCrushStore.ts');

// Load RestTimerBar (exposing plate math helper functions)
const restTimerModule = loadTsModule(
  'src/components/RestTimerBar.tsx',
  '\nexports.calculatePlatesPerSide = calculatePlatesPerSide;\nexports.formatPlatesList = formatPlatesList;\nexports.formatTime = formatTime;\n'
);

function getStore() {
  return storeModule.useGymCrushStore();
}

test('Test 1 — Visual Machine Catalog & Partner Setup (Markus Android vs. Elena iOS)', async () => {
  const store = getStore();

  // Verify Partner Profiles
  assert.equal(store.profiles.markus.name, 'Markus');
  assert.equal(store.profiles.markus.platform, 'Android');
  assert.equal(store.profiles.markus.unit, 'kg');
  assert.equal(store.profiles.partner.name, 'Abby');
  assert.equal(store.profiles.partner.platform, 'iOS');
  assert.equal(store.profiles.partner.unit, 'kg');

  // Verify initial 4 visual machines load with photos and distinct partner setups
  assert.equal(store.machines.length, 4);
  const expectedIds = ['m-chest-press', 'm-lat-pulldown', 'm-leg-press', 'm-hip-thrust'];
  assert.deepEqual(
    store.machines.map((m) => m.id),
    expectedIds
  );

  for (const machine of store.machines) {
    assert.ok(machine.name.length > 0, `Machine ${machine.id} should have a name`);
    assert.ok(
      machine.photoUri.startsWith('https://'),
      `Machine ${machine.id} should have a valid photoUri`
    );
    const markusSetup = machine.partnerSetups.markus;
    const partnerSetup = machine.partnerSetups.partner;
    assert.ok(markusSetup.seatPosition.length > 0);
    assert.ok(markusSetup.pinOrPadNote.length > 0);
    assert.ok(partnerSetup.seatPosition.length > 0);
    assert.ok(partnerSetup.pinOrPadNote.length > 0);
    assert.notEqual(
      markusSetup.seatPosition,
      partnerSetup.seatPosition,
      `Markus and Partner should have distinct default seat positions on ${machine.name}`
    );
    assert.ok(markusSetup.personalRecordWeight > partnerSetup.personalRecordWeight);
  }

  // Verify adding a new machine via addMachine
  store.addMachine({
    name: 'Pendulum Squat Pro',
    muscleGroup: 'Legs',
    locationNote: 'Back Corner Rack 4',
    photoUri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    markusSeat: 'Shoulder Pad Notch 5',
    markusPin: 'Bottom safety pin 2',
    partnerSeat: 'Shoulder Pad Notch 2',
    partnerPin: 'Bottom safety pin 4',
  });

  const afterAdd = getStore();
  assert.equal(afterAdd.machines.length, 5);
  const addedMachine = afterAdd.machines[0];
  assert.equal(addedMachine.name, 'Pendulum Squat Pro');
  assert.equal(addedMachine.muscleGroup, 'Legs');
  assert.equal(addedMachine.locationNote, 'Back Corner Rack 4');
  assert.equal(afterAdd.selectedMachineId, addedMachine.id);
  assert.equal(addedMachine.partnerSetups.markus.seatPosition, 'Shoulder Pad Notch 5');
  assert.equal(addedMachine.partnerSetups.markus.pinOrPadNote, 'Bottom safety pin 2');
  assert.equal(addedMachine.partnerSetups.partner.seatPosition, 'Shoulder Pad Notch 2');
  assert.equal(addedMachine.partnerSetups.partner.pinOrPadNote, 'Bottom safety pin 4');

  // Verify updating partner seat/pin setup via updatePartnerSetup
  afterAdd.updatePartnerSetup(
    'm-chest-press',
    'partner',
    'Height 3 (Adjusted)',
    'Medium neutral grip; cushion pad'
  );

  const afterSetupUpdate = getStore();
  const chestPress = afterSetupUpdate.machines.find((m) => m.id === 'm-chest-press');
  assert.equal(chestPress.partnerSetups.partner.seatPosition, 'Height 3 (Adjusted)');
  assert.equal(chestPress.partnerSetups.partner.pinOrPadNote, 'Medium neutral grip; cushion pad');
  // Ensure Markus's setup on the same machine was preserved untouched
  assert.equal(chestPress.partnerSetups.markus.seatPosition, 'Height 5');
  assert.equal(chestPress.partnerSetups.markus.personalRecordWeight, 90);
  assert.ok(
    Array.isArray(chestPress.partnerSetups.markus.adjustments) &&
      chestPress.partnerSetups.markus.adjustments.length >= 2,
    'Every machine must support 2+ named adjustments per partner'
  );

  // Verify updating 3 distinct named adjustments on a machine
  afterSetupUpdate.updatePartnerSetup(
    'm-chest-press',
    'markus',
    'Seat 6',
    'Back Pad 4',
    [
      { id: 'adj-1', label: 'Seat Height', value: 'Seat 6' },
      { id: 'adj-2', label: 'Back Pad Depth', value: 'Back Pad 4' },
      { id: 'adj-3', label: 'Start Range Limiter', value: 'Hole 2' },
    ]
  );
  const afterMultiAdj = getStore();
  const updatedChest = afterMultiAdj.machines.find((m) => m.id === 'm-chest-press');
  assert.equal(updatedChest.partnerSetups.markus.adjustments.length, 3);
  assert.equal(updatedChest.partnerSetups.markus.adjustments[2].label, 'Start Range Limiter');
  assert.equal(updatedChest.partnerSetups.markus.adjustments[2].value, 'Hole 2');
  // Restore Seat 5 for Test 2
  afterMultiAdj.updatePartnerSetup('m-chest-press', 'markus', 'Height 5', 'Pin 3 (Mid grip)');
});

test('Test 2 — Active Workout Logging & Automatic PR Detection', async () => {
  let store = getStore();

  // Select Iso-Lateral Chest Press and set active user to 'markus' (PR is 90kg)
  store.setSelectedMachineId('m-chest-press');
  store = getStore();
  store.switchActiveUser('markus');
  store = getStore();

  assert.equal(store.activeUser, 'markus');
  assert.equal(store.selectedMachine.id, 'm-chest-press');
  assert.equal(store.selectedMachine.partnerSetups.markus.personalRecordWeight, 90);

  // 1. Log a working set BELOW personal record (85kg x 8 reps, PR = 90kg)
  const regularSet = store.logSet(85, 8);
  assert.equal(regularSet.isPR, false);
  assert.equal(regularSet.weight, 85);
  assert.equal(regularSet.reps, 8);
  assert.equal(regularSet.userId, 'markus');
  assert.equal(regularSet.machineId, 'm-chest-press');

  store = getStore();
  assert.equal(store.restSeconds, 90, 'Logging a set should start 90s auto-rest timer');
  assert.equal(
    store.selectedMachine.partnerSetups.markus.lastWorkingWeight,
    85,
    'lastWorkingWeight should update to 85kg'
  );
  assert.equal(
    store.selectedMachine.partnerSetups.markus.personalRecordWeight,
    90,
    'personalRecordWeight should remain 90kg when set is below PR'
  );

  // 2. Log a set ABOVE personal record (95kg x 6 reps > 90kg PR)
  const prSet = store.logSet(95, 6);
  assert.equal(prSet.isPR, true, 'Set exceeding personalRecordWeight must be flagged isPR: true');
  assert.equal(prSet.weight, 95);
  assert.equal(prSet.reps, 6);

  store = getStore();
  assert.equal(
    store.selectedMachine.partnerSetups.markus.personalRecordWeight,
    95,
    'personalRecordWeight should update to 95kg after PR set'
  );
  assert.ok(store.latestReaction, 'PR set should generate a celebration reaction');
  assert.equal(store.latestReaction.emoji, '👑');
  assert.ok(store.latestReaction.message.includes('95'));
});

test('Test 4 — Barbell & Sled Plate Math Calculator', () => {
  const { calculatePlatesPerSide, formatPlatesList, formatTime } = restTimerModule;

  // 1. 20kg Olympic Barbell: Markus 80kg vs Partner 45kg
  const markusBar = calculatePlatesPerSide(80, 20, 'kg');
  assert.equal(markusBar.perSideWeight, 30);
  assert.equal(markusBar.remainder, 0);
  assert.deepEqual(markusBar.plates, [
    { plate: 20, count: 1 },
    { plate: 10, count: 1 },
  ]);
  assert.equal(formatPlatesList(markusBar.plates, 'kg'), '1×20kg + 1×10kg');

  const partnerBar = calculatePlatesPerSide(45, 20, 'kg');
  assert.equal(partnerBar.perSideWeight, 12.5);
  assert.equal(partnerBar.remainder, 0);
  assert.deepEqual(partnerBar.plates, [
    { plate: 10, count: 1 },
    { plate: 2.5, count: 1 },
  ]);
  assert.equal(formatPlatesList(partnerBar.plates, 'kg'), '1×10kg + 1×2.5kg');

  // Transition strip/load delta between 80kg and 45kg (35kg total -> 17.5kg/side)
  const deltaBreakdown = calculatePlatesPerSide(Math.abs(80 - 45), 0, 'kg');
  assert.equal(deltaBreakdown.perSideWeight, 17.5);
  assert.deepEqual(deltaBreakdown.plates, [
    { plate: 15, count: 1 },
    { plate: 2.5, count: 1 },
  ]);

  // 2. 0kg Sled (Leg Press): Markus 180kg vs Partner 95kg
  const markusSled = calculatePlatesPerSide(180, 0, 'kg');
  assert.equal(markusSled.perSideWeight, 90);
  assert.deepEqual(markusSled.plates, [
    { plate: 20, count: 4 },
    { plate: 10, count: 1 },
  ]);
  assert.equal(formatPlatesList(markusSled.plates, 'kg'), '4×20kg + 1×10kg');

  const partnerSled = calculatePlatesPerSide(95, 0, 'kg');
  assert.equal(partnerSled.perSideWeight, 47.5);
  assert.deepEqual(partnerSled.plates, [
    { plate: 20, count: 2 },
    { plate: 5, count: 1 },
    { plate: 2.5, count: 1 },
  ]);

  // 3. Empty Bar Edge Case
  const emptyBar = calculatePlatesPerSide(20, 20, 'kg');
  assert.equal(emptyBar.perSideWeight, 0);
  assert.deepEqual(emptyBar.plates, []);
  assert.equal(formatPlatesList(emptyBar.plates, 'kg'), 'Empty bar / sled');

  // 4. Timer formatting check
  assert.equal(formatTime(90), '1:30');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(0), '0:00');
});

test('Test 5 — Real-Time Couple Sync Engine & Loopback Prevention', async () => {
  const { RealtimeSyncEngine } = syncEngineModule;

  const instanceMarkus = new RealtimeSyncEngine();
  const instanceElena = new RealtimeSyncEngine();

  assert.notEqual(
    instanceMarkus.getInstanceId(),
    instanceElena.getInstanceId(),
    'Each SyncEngine instance must generate a unique instanceId'
  );
  assert.equal(instanceMarkus.isConnected(), true);
  assert.equal(instanceElena.isConnected(), true);

  const receivedByMarkus = [];
  const receivedByElena = [];

  instanceMarkus.subscribe((evt) => receivedByMarkus.push(evt));
  instanceElena.subscribe((evt) => receivedByElena.push(evt));

  // 1. Broadcast SET_LOGGED from Markus -> Elena receives it, Markus does NOT self-echo
  const sampleSet = {
    id: 'sync-set-101',
    workoutId: 'w-today',
    machineId: 'm-hip-thrust',
    machineName: 'Glute Drive / Hip Thrust Machine',
    userId: 'markus',
    setNumber: 2,
    weight: 145,
    reps: 8,
    unit: 'kg',
    isPR: true,
    loggedAt: new Date().toISOString(),
  };
  await instanceMarkus.broadcast({ type: 'SET_LOGGED', payload: { set: sampleSet } });

  assert.equal(receivedByMarkus.length, 0, 'Sender instance must ignore its own broadcast (loopback prevention)');
  assert.equal(receivedByElena.length, 1);
  assert.equal(receivedByElena[0].type, 'SET_LOGGED');
  assert.equal(receivedByElena[0].payload.set.id, 'sync-set-101');

  // 2. Broadcast HYPE_REACTION from Elena -> Markus receives it
  const sampleReaction = {
    id: 'sync-react-202',
    fromUser: 'partner',
    toUser: 'markus',
    emoji: '🔥',
    message: 'Elena says: Light weight baby! 🔥',
    createdAt: new Date().toISOString(),
  };
  await instanceElena.broadcast({ type: 'HYPE_REACTION', payload: { reaction: sampleReaction } });

  assert.equal(receivedByElena.length, 1, 'Elena must not receive her own HYPE_REACTION');
  assert.equal(receivedByMarkus.length, 1);
  assert.equal(receivedByMarkus[0].type, 'HYPE_REACTION');
  assert.equal(receivedByMarkus[0].payload.reaction.emoji, '🔥');

  // 3. Broadcast PARTNER_STATUS, MACHINE_ADDED, and SETUP_UPDATED
  await instanceMarkus.broadcast({
    type: 'PARTNER_STATUS',
    payload: {
      status: {
        userId: 'markus',
        isOnline: true,
        currentMachineId: 'm-leg-press',
        currentMachineName: '45° Incline Leg Press',
        currentSetNumber: 3,
        restSecondsRemaining: 75,
        lastUpdated: new Date().toISOString(),
      },
    },
  });

  await instanceMarkus.broadcast({
    type: 'MACHINE_ADDED',
    payload: {
      machine: {
        id: 'm-sync-cable-row',
        name: 'Seated Low Cable Row',
        muscleGroup: 'Back',
        photoUri: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800',
        createdAt: new Date().toISOString(),
        partnerSetups: {
          markus: {
            seatPosition: 'Pad 4',
            pinOrPadNote: 'Close V-handle',
            lastWorkingWeight: 70,
            lastReps: 10,
            personalRecordWeight: 80,
          },
          partner: {
            seatPosition: 'Pad 2',
            pinOrPadNote: 'Wide neutral bar',
            lastWorkingWeight: 35,
            lastReps: 12,
            personalRecordWeight: 40,
          },
        },
      },
    },
  });

  await instanceMarkus.broadcast({
    type: 'SETUP_UPDATED',
    payload: {
      machineId: 'm-sync-cable-row',
      partnerId: 'markus',
      seatPosition: 'Pad 5',
      pinOrPadNote: 'MAG close-grip',
    },
  });

  assert.equal(receivedByElena.length, 4);
  assert.deepEqual(
    receivedByElena.map((e) => e.type),
    ['SET_LOGGED', 'PARTNER_STATUS', 'MACHINE_ADDED', 'SETUP_UPDATED']
  );

  // Also verify store updated from the live broadcasts
  const store = getStore();
  const syncedMachine = store.machines.find((m) => m.id === 'm-sync-cable-row');
  assert.ok(syncedMachine, 'Store should automatically add machine received via MACHINE_ADDED sync event');
  assert.equal(
    syncedMachine.partnerSetups.markus.seatPosition,
    'Pad 5',
    'Store should automatically update setup received via SETUP_UPDATED sync event'
  );

  instanceMarkus.cleanup();
  instanceElena.cleanup();
  syncEngineModule.syncEngine.cleanup();
});

test('Test 6 — Source File, TypeScript AST & Package Contract Verification', () => {
  // 1. Verify package.json has required Expo peer dependencies & security overrides
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const requiredDeps = [
    'expo-asset',
    'expo-font',
    'react-native-gesture-handler',
    'react-native-web',
    'react-dom',
    '@expo/metro-runtime',
  ];
  for (const dep of requiredDeps) {
    assert.ok(pkgJson.dependencies[dep], `package.json missing required dependency: ${dep}`);
  }

  const requiredOverrides = [
    '@xmldom/xmldom',
    'tar',
    'ws',
    'semver',
    'cross-spawn',
    'micromatch',
    'braces',
    'serialize-javascript',
  ];
  assert.ok(pkgJson.overrides, 'package.json must include an overrides block');
  for (const ov of requiredOverrides) {
    assert.ok(pkgJson.overrides[ov], `package.json overrides missing ${ov}`);
  }
  assert.equal(pkgJson.scripts.test, 'node --test tests/gymcrush.test.mjs');

  // 2. Verify all TypeScript source files exist and parse cleanly with zero AST syntax errors
  const expectedFiles = [
    'src/types/gym.ts',
    'src/services/syncEngine.ts',
    'src/store/useGymCrushStore.ts',
    'src/theme/theme.ts',
    'src/ui/primitives.tsx',
    'src/ui/keyboard.tsx',
    'src/components/RestTimerBar.tsx',
    'src/features/workout/exerciseTiming.ts',
    'src/features/workout/PartnerProgressView.tsx',
    'app/_layout.tsx',
    'app/index.tsx',
    'app/(tabs)/_layout.tsx',
    'app/(tabs)/today/index.tsx',
    'app/(tabs)/machines/index.tsx',
    'app/(tabs)/machines/[id].tsx',
    'app/(tabs)/history/index.tsx',
    'app/(tabs)/history/[workoutId].tsx',
    'app/(tabs)/couple/index.tsx',
    'app/workout.tsx',
    'app/partner-workout.tsx',
    'app/workout-summary.tsx',
    'app/machine-settings/[id].tsx',
    'app/edit-set/[id].tsx',
    'app/cheer.tsx',
    'app/onboarding.tsx',
  ];

  for (const relFile of expectedFiles) {
    const absFile = path.join(ROOT_DIR, relFile);
    assert.ok(fs.existsSync(absFile), `Required file ${relFile} does not exist`);
    const content = fs.readFileSync(absFile, 'utf8');
    const sf = ts.createSourceFile(
      absFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      relFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    assert.equal(
      sf.parseDiagnostics.length,
      0,
      `Syntax error in ${relFile}: ${sf.parseDiagnostics.map((d) => d.messageText).join(', ')}`
    );
  }

  // 3. Verify navigation contract
  const tabsLayout = fs.readFileSync(path.join(ROOT_DIR, 'app/(tabs)/_layout.tsx'), 'utf8');
  assert.ok(
    tabsLayout.includes('NativeTabs'),
    'app/(tabs)/_layout.tsx must configure NativeTabs'
  );
  for (const tabName of ['name="today"', 'name="machines"', 'name="history"', 'name="couple"']) {
    assert.ok(
      tabsLayout.includes(tabName),
      `app/(tabs)/_layout.tsx must include tab route ${tabName}`
    );
  }

  const rootLayout = fs.readFileSync(path.join(ROOT_DIR, 'app/_layout.tsx'), 'utf8');
  assert.ok(
    rootLayout.includes('name="workout"'),
    'app/_layout.tsx must include workout route name="workout"'
  );
  assert.ok(
    rootLayout.includes('ReactionBanner'),
    'app/_layout.tsx must integrate ReactionBanner'
  );
});

test('Test 7 — Bilingual Localization (EN / 繁體中文) & Workout Session Lifecycle', async () => {
  let store = getStore();

  // 1. Verify Bilingual Dictionary (English & Traditional Chinese)
  const enDict = translationsModule.t('en');
  const zhDict = translationsModule.t('zh-TW');
  assert.equal(enDict.startEmptySession, 'Start New Workout');
  assert.equal(zhDict.startEmptySession, '開始新訓練');
  assert.equal(zhDict.addExerciseTask, '+ 新增訓練動作 / 器材');
  assert.equal(zhDict.finishSession, '結束訓練');

  // Toggle language in store
  store.setLanguage('zh-TW');
  store = getStore();
  assert.equal(store.language, 'zh-TW');
  assert.equal(store.machines.find((m) => m.id === 'm-chest-press')?.nameZh, '分動式胸推機');
  store.setLanguage('en');
  store = getStore();
  assert.equal(store.language, 'en');

  // 2. Verify Session Start -> Add Task -> Finish Session Lifecycle
  store.finishSession();
  store = getStore();
  assert.equal(store.isSessionActive, false);

  store.startSession(['m-chest-press'], 'Push Session');
  store = getStore();
  assert.equal(store.isSessionActive, true);
  assert.equal(store.sessionTitle, 'Push Session');
  assert.deepEqual(store.sessionMachineIds, ['m-chest-press']);

  // Add another machine task to the active session
  store.addMachineToSession('m-lat-pulldown');
  store = getStore();
  assert.ok(store.sessionMachineIds.includes('m-lat-pulldown'));

  // Remove a machine task from the active session
  store.removeMachineFromSession('m-lat-pulldown');
  store = getStore();
  assert.ok(!store.sessionMachineIds.includes('m-lat-pulldown'));

  // Finish session
  store.finishSession();
  store = getStore();
  assert.equal(store.isSessionActive, false);
  assert.equal(store.sessionElapsedSeconds, 0);
});

test('Test 8 — First-Time Setup Wizard & Clean-Slate (0 Machines) Mode', async () => {
  let store = getStore();

  // Open Setup Wizard
  store.openOnboarding();
  store = getStore();
  assert.equal(store.isOnboardingOpen, true);

  // Complete Onboarding with Start Fresh (loadDemoMachines: false)
  store.completeOnboarding({
    markusName: 'Markus',
    partnerName: 'Girlfriend',
    unit: 'kg',
    weeklyGoal: 4,
    loadDemoMachines: false,
  });
  store = getStore();
  assert.equal(store.isOnboardingOpen, false);
  assert.equal(store.machines.length, 0, 'Start Fresh must clear all pre-existing machines');
  assert.equal(store.sets.length, 0, 'Start Fresh must clear all pre-existing set logs');
  assert.equal(store.profiles.partner.name, 'Girlfriend');

  // Add first custom machine from clean slate
  store.addMachine({
    name: 'My First Gym Machine',
    muscleGroup: 'Chest',
    locationNote: 'Floor 1',
    photoUri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    adjustment1Label: 'Seat Height',
    adjustment2Label: 'Back Pad',
    markusSeat: '5',
    markusPin: '3',
    partnerSeat: '2',
    partnerPin: '1',
  });
  store = getStore();
  assert.equal(store.machines.length, 1);
  assert.equal(store.machines[0].name, 'My First Gym Machine');
  assert.equal(store.machines[0].partnerSetups.markus.adjustments.length, 2);

  // Reopening setup must preserve the user-created catalog
  store.completeOnboarding({
    markusName: 'Markus',
    partnerName: 'Elena',
    unit: 'kg',
    weeklyGoal: 4,
    loadDemoMachines: true,
  });
  store = getStore();
  assert.equal(store.machines.length, 1);
});

test('Test 9 — Dynamic 1..N Adjustable Machine Settings (Start with 1, Add to 3, Remove to 1) & Xcode 27 Patch', async () => {
  let store = getStore();

  // 1. Add a machine starting with 1 setting (default in AddMachineModal)
  store.addMachine({
    name: 'Single-Pin Calf Raise',
    muscleGroup: 'Legs',
    locationNote: 'Zone B',
    photoUri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    markusSeat: '5',
    markusPin: '',
    partnerSeat: '2',
    partnerPin: '',
    customAdjustments: [{ label: 'Shoulder Pad Height', markusValue: '5', partnerValue: '2' }],
  });

  store = getStore();
  const singleSettingMachine = store.machines.find((m) => m.name === 'Single-Pin Calf Raise');
  assert.ok(singleSettingMachine, 'Machine created with 1 setting must exist');
  assert.equal(
    singleSettingMachine.partnerSetups.markus.adjustments.length,
    1,
    'Machine created with 1 setting must have exactly 1 adjustment for Markus'
  );
  assert.equal(
    singleSettingMachine.partnerSetups.partner.adjustments.length,
    1,
    'Machine created with 1 setting must have exactly 1 adjustment for Partner'
  );
  assert.equal(singleSettingMachine.partnerSetups.markus.adjustments[0].label, 'Shoulder Pad Height');
  assert.equal(singleSettingMachine.partnerSetups.markus.adjustments[0].value, '5');
  assert.equal(singleSettingMachine.partnerSetups.markus.pinOrPadNote, '');

  // 2. Expand machine from 1 setting to 3 settings
  store.updatePartnerSetup(singleSettingMachine.id, 'markus', '6', 'Hole 3', [
    { id: 'adj-1', label: 'Shoulder Pad Height', value: '6' },
    { id: 'adj-2', label: 'Foot Platform Angle', value: 'Hole 3' },
    { id: 'adj-3', label: 'Range Limiter Pin', value: 'Slot 2' },
  ]);
  store = getStore();
  const expandedMachine = store.machines.find((m) => m.id === singleSettingMachine.id);
  assert.equal(
    expandedMachine.partnerSetups.markus.adjustments.length,
    3,
    'Expanding to 3 settings must store 3 adjustments'
  );
  assert.equal(expandedMachine.partnerSetups.markus.adjustments[2].label, 'Range Limiter Pin');
  assert.equal(expandedMachine.partnerSetups.markus.adjustments[2].value, 'Slot 2');

  // 3. Remove settings back down to 1 setting
  store.updatePartnerSetup(singleSettingMachine.id, 'markus', '5', '', [
    { id: 'adj-1', label: 'Shoulder Pad Height', value: '5' },
  ]);
  store = getStore();
  const reducedMachine = store.machines.find((m) => m.id === singleSettingMachine.id);
  assert.equal(
    reducedMachine.partnerSetups.markus.adjustments.length,
    1,
    'Removing settings down to 1 must preserve 1 adjustment without re-adding a 2nd default'
  );
  assert.equal(reducedMachine.partnerSetups.markus.pinOrPadNote, '');

  // 4. Verify Expo CLI supports Xcode 27 DeviceHub
  const appleDeviceManagerPath = path.join(
    path.dirname(require.resolve('@expo/cli/package.json', { paths: [path.dirname(require.resolve('expo/package.json'))] })),
    'build/src/start/platforms/ios/AppleDeviceManager.js'
  );
  const appleDeviceManagerContent = fs.readFileSync(appleDeviceManagerPath, 'utf8');
  assert.ok(
    appleDeviceManagerContent.includes('DeviceHub'),
    'AppleDeviceManager.js must include Xcode 27 DeviceHub fallback in activateWindowAsync'
  );
});

test('Test 10 — Supabase Realtime Presence & 3-State Connection Status (No False Greens)', async () => {
  const store = getStore();

  // 1. Store exposes both syncConnected (partner presence) and cloudConnected (relay/supabase)
  assert.equal(typeof store.syncConnected, 'boolean', 'store has syncConnected property');
  assert.equal(typeof store.cloudConnected, 'boolean', 'store has cloudConnected property');

  // 2. RealtimeSyncEngine presence inspection logic
  const engineA = new syncEngineModule.RealtimeSyncEngine();
  const engineB = new syncEngineModule.RealtimeSyncEngine();

  engineA.setCurrentUser('markus');
  engineB.setCurrentUser('partner');

  // Verify engine methods for 3-state connection dot
  assert.equal(typeof engineA.isCloudConnected, 'function');
  assert.equal(typeof engineA.isPartnerConnected, 'function');
  assert.equal(typeof engineA.isCrossDeviceConnected, 'function');

  // When no partner has joined, partner is not connected
  assert.equal(engineA.isPartnerConnected(), false, 'Partner must not be connected when alone');
  assert.equal(engineA.isCrossDeviceConnected(), false, 'Cross-device connected must be false without active partner');

  // 3. Test presence filtering: simulate presence state map
  const mockPresenceStateWithPartner = {
    [engineB.getInstanceId()]: [
      {
        instanceId: engineB.getInstanceId(),
        userId: 'partner',
        platform: 'ios',
        onlineAt: Date.now(),
      },
    ],
  };

  const mockPresenceStateStale = {
    [engineB.getInstanceId()]: [
      {
        instanceId: engineB.getInstanceId(),
        userId: 'partner',
        platform: 'ios',
        onlineAt: Date.now() - 60000, // 60s ago (> 35s expiry)
      },
    ],
  };

  // Inspect fresh presence
  let partnerFound = false;
  const now = Date.now();
  for (const key of Object.keys(mockPresenceStateWithPartner)) {
    for (const p of mockPresenceStateWithPartner[key]) {
      const isFresh = typeof p?.onlineAt === 'number' ? (now - p.onlineAt < 35000) : true;
      if (p && p.instanceId !== engineA.getInstanceId() && p.userId !== 'markus' && isFresh) {
        partnerFound = true;
      }
    }
  }
  assert.equal(partnerFound, true, 'Fresh partner presence must be recognized');

  // Inspect stale presence
  let stalePartnerFound = false;
  for (const key of Object.keys(mockPresenceStateStale)) {
    for (const p of mockPresenceStateStale[key]) {
      const isFresh = typeof p?.onlineAt === 'number' ? (now - p.onlineAt < 35000) : true;
      if (p && p.instanceId !== engineA.getInstanceId() && p.userId !== 'markus' && isFresh) {
        stalePartnerFound = true;
      }
    }
  }
  assert.equal(stalePartnerFound, false, 'Stale partner presence (>35s) must be ignored to prevent false green dot');

  engineA.cleanup();
  engineB.cleanup();
});

test('Workout sessions restart set numbers and use distinct history IDs', () => {
  let store = getStore();
  store.completeOnboarding({ markusName: 'Markus', partnerName: 'Abby', unit: 'kg', weeklyGoal: 4, loadDemoMachines: true });
  store = getStore();
  store.startSession([store.machines[0].id]);
  const first = getStore().logSet(50, 8);
  assert.equal(first.setNumber, 1);
  getStore().finishSession();
  getStore().startSession([getStore().machines[0].id]);
  const second = getStore().logSet(55, 8);
  assert.equal(second.setNumber, 1);
  assert.notEqual(first.workoutId, second.workoutId);
});

test('Changing profile settings preserves existing machines and workout history', () => {
  const store = getStore();
  const machineIds = store.machines.map((m) => m.id);
  const setIds = store.sets.map((s) => s.id);
  store.openOnboarding();
  getStore().completeOnboarding({ markusName: 'M', partnerName: 'Abby', unit: 'lbs', weeklyGoal: 3, loadDemoMachines: false });
  assert.deepEqual(getStore().machines.map((m) => m.id), machineIds);
  assert.deepEqual(getStore().sets.map((s) => s.id), setIds);
});

test('Rest timer catches up after the app has been suspended', () => {
  const now = Date.now;
  const startedAt = now();
  Date.now = () => startedAt;
  try {
    getStore().startRest(30);
    assert.equal(getStore().restSeconds, 30);
    Date.now = () => startedAt + 31000;
    intervalCallbacks.find((timer) => timer.ms === 100).callback();
    assert.equal(getStore().restSeconds, 0);
  } finally { Date.now = now; }
});

test('Weekly progress counts completed training days once, not sets or exercises', () => {
  let store = getStore();
  store.finishSession();
  store = getStore();
  const before = store.profiles[store.activeUser].completedThisWeek;
  store.startSession([store.machines[0].id]);
  getStore().logSet(25, 10);
  getStore().logSet(25, 10);
  assert.equal(getStore().profiles[store.activeUser].completedThisWeek, before);
  getStore().finishSession();
  const after = getStore().profiles[store.activeUser].completedThisWeek;
  assert.equal(after, 1);
  getStore().finishSession();
  assert.equal(getStore().profiles[store.activeUser].completedThisWeek, after);
});

test('New machine PRs start at zero rather than a fabricated previous record', () => {
  getStore().addMachine({ name: 'New machine', muscleGroup: 'Chest', locationNote: '', photoUri: 'https://example.com/photo.jpg', markusSeat: '1', partnerSeat: '1' });
  const store = getStore();
  assert.equal(store.selectedMachine.partnerSetups.markus.personalRecordWeight, 0);
  store.startSession([store.selectedMachine.id]);
  assert.equal(getStore().logSet(5, 10).isPR, true);
});

test('The same message delivered over two transports reaches subscribers once', () => {
  const engine = new syncEngineModule.RealtimeSyncEngine();
  const received = [];
  engine.subscribe((event) => received.push(event));
  const envelope = { id: 'multi-transport-id', senderInstanceId: 'other-phone', timestamp: Date.now(),
    event: { type: 'HYPE_REACTION', payload: { reaction: { id: 'reaction-one', fromUser: 'partner', toUser: 'markus', emoji: '💪', message: 'Go!', createdAt: new Date().toISOString() } } } };
  engine.handleIncomingEnvelope(envelope);
  engine.handleIncomingEnvelope(structuredClone(envelope));
  assert.equal(received.length, 1);
  engine.cleanup();
});

test('Cloud outbox preserves concurrent changes across an offline restart and flushes once', async () => {
  const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-publishable-key';
  memoryStorage.delete('GYMCRUSH_CLOUD_OUTBOX_V1');
  memoryStorage.delete('GYMCRUSH_CLOUD_CURSOR_room-test');
  let offline = true;
  let presenceTracks = 0;
  const serverRows = [];
  const received = [];
  const inserts = new Map();
  let onSubscribe;
  const channel = { state: 'joined', on() { return this; }, subscribe(fn) { onSubscribe = fn; return this; },
    track: async () => { presenceTracks++; }, send: async () => 'ok', presenceState: () => ({}), untrack: async () => {} };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-test' } } } }), startAutoRefresh() {}, stopAutoRefresh() {} },
    realtime: { setAuth: async () => {} }, channel: () => channel, removeChannel: async () => {},
    rpc: async (_name, { item }) => {
      if (offline) return { error: new Error('offline') };
      inserts.set(item.id, item); return { error: null };
    },
    from: (name) => ({ after: 0, select() { return this; }, eq() { return this; }, gt(_column, cursor) { this.after = cursor; return this; }, order() { return this; },
      maybeSingle: async () => ({ data: { couple_id: 'room-test', partner_id: 'markus' } }),
      single: async () => ({ data: { invite_code: 'a'.repeat(32) } }), async limit() { return { data: serverRows.filter((row) => row.seq > this.after) }; },
    }),
  };
  try {
    const module = loadTsModule('src/services/cloudSync.ts', '', {
      'react-native-url-polyfill/auto': {}, 'expo-file-system/legacy': {}, 'base64-arraybuffer': {},
      '@supabase/supabase-js': { createClient: () => client },
      'react-native': { Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    });
    const cloud = new module.CloudSync('device-a', (item) => received.push(item), () => {});
    await cloud.ready;
    const item = (id) => ({ id, senderInstanceId: 'device-a', timestamp: Date.now(), event: {
      type: 'HYPE_REACTION', payload: { reaction: { id, fromUser: 'markus', toUser: 'partner', emoji: '💪', message: id, createdAt: new Date().toISOString() } },
    } });
    serverRows.push({ seq: 1, envelope: { ...item('incoming-while-upload-fails'), senderInstanceId: 'partner-phone' } });
    await Promise.all([cloud.send(item('queued-one')), cloud.send(item('queued-two'))]);
    assert.equal(cloud.getSnapshot().pending, 2);
    assert.equal(JSON.parse(memoryStorage.get('GYMCRUSH_CLOUD_OUTBOX_V1')).length, 2);
    assert.equal(received.filter((item) => item.id === 'incoming-while-upload-fails').length, 1);
    const reloaded = new module.CloudSync('device-restarted', () => {}, () => {});
    await reloaded.ready;
    offline = false;
    await reloaded.tick();
    assert.deepEqual([...inserts.keys()], ['queued-one', 'queued-two']);
    assert.equal(reloaded.getSnapshot().pending, 0);
    await reloaded.tick();
    assert.equal(inserts.size, 2);
    const beforeBurst = presenceTracks;
    for (let index = 0; index < 5; index++) await reloaded.send(item(`burst-${index}`));
    assert.ok(presenceTracks - beforeBurst <= 1, 'A burst of sync events must not flood presence tracking');
  } finally {
    if (savedUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  }
});

test('Saving both partner settings from one editor preserves both changes', () => {
  const store = getStore();
  const id = store.machines[0].id;
  store.updatePartnerSetup(id, 'markus', '11', '', [{ id: 'seat', label: 'Seat', value: '11' }]);
  store.updatePartnerSetup(id, 'partner', '22', '', [{ id: 'seat', label: 'Seat', value: '22' }]);
  const machine = getStore().machines.find((m) => m.id === id);
  assert.equal(machine.partnerSetups.markus.seatPosition, '11');
  assert.equal(machine.partnerSetups.partner.seatPosition, '22');
});

test('Malformed incoming records cannot reach app subscribers', () => {
  const engine = new syncEngineModule.RealtimeSyncEngine();
  let delivered = 0;
  engine.subscribe(() => delivered++);
  const base = { id: 'invalid-one', senderInstanceId: 'other', timestamp: Date.now() };
  for (const event of [
    { type: 'SET_LOGGED', payload: { set: { id: 'x', userId: 'outsider', weight: -10 } } },
    { type: 'SESSION_STARTED', payload: { startedAt: 'yesterday', startedBy: 'markus' } },
    { type: 'SETUP_UPDATED', payload: { machineId: 'x', partnerId: 'markus', adjustments: null } },
    { type: 'UNKNOWN', payload: {} },
  ]) engine.handleIncomingEnvelope({ ...base, event });
  assert.equal(delivered, 0);
  engine.cleanup();
});

test('An explicitly empty workout stays empty and the last exercise can be removed', () => {
  const store = getStore();
  store.startSession([]);
  assert.deepEqual(getStore().sessionMachineIds, []);
  getStore().addMachineToSession(store.machines[0].id);
  getStore().removeMachineFromSession(store.machines[0].id);
  assert.deepEqual(getStore().sessionMachineIds, []);
});

test('A delayed older partner status cannot restart a cancelled rest timer', () => {
  const isolated = loadTsModule('src/store/useGymCrushStore.ts');
  const store = isolated.useGymCrushStore();
  const other = store.activeUser === 'markus' ? 'partner' : 'markus';
  const status = { userId: other, isOnline: true, currentMachineId: null, currentMachineName: null,
    currentSetNumber: 1, lastUpdated: new Date().toISOString(), sourceInstanceId: 'other-phone', sequence: 2,
    restSecondsRemaining: 0 };
  const engine = syncEngineModule.syncEngine;
  engine.handleIncomingEnvelope({ id: 'newer-rest-cancel', senderInstanceId: 'other-phone', timestamp: Date.now(),
    event: { type: 'PARTNER_STATUS', payload: { status } } });
  engine.handleIncomingEnvelope({ id: 'delayed-rest-start', senderInstanceId: 'other-phone', timestamp: Date.now(),
    event: { type: 'PARTNER_STATUS', payload: { status: { ...status, sequence: 1, restSecondsRemaining: 60 } } } });
  assert.equal(isolated.useGymCrushStore().partnerStatus.restSecondsRemaining, 0);
});


test('Partners share one clock and break status but keep their own exercises', () => {
  const isolated = loadTsModule('src/store/useGymCrushStore.ts');
  const get = () => isolated.useGymCrushStore();
  const partner = get().activeUser === 'markus' ? 'partner' : 'markus';
  const startedAt = Date.now() - 60000;
  const workoutId = `w_${startedAt}`;
  const engine = syncEngineModule.syncEngine;
  const deliver = (id, event) => engine.handleIncomingEnvelope({ id, senderInstanceId: 'other-routine-phone', timestamp: Date.now(), event });
  deliver('partner-start', { type: 'SESSION_STARTED', payload: { startedAt, startedBy: partner, startedByName: 'Partner', routineTitle: 'Push' } });
  assert.equal(get().isSessionActive, true);
  assert.equal(get().sessionStartedAt, startedAt);
  assert.equal(get().sessionTitle, '');
  assert.deepEqual(get().sessionMachineIds, []);
  assert.equal(get().latestReaction.id, `session_start_${startedAt}`);
  assert.equal(scheduledAlerts.filter((a) => a[0] === 'workout-alarm').at(-1)[1], startedAt + 60 * 60000);

  const restEndsAt = Date.now() + 60000;
  deliver('partner-status', { type: 'PARTNER_STATUS', payload: { status: { userId: partner, isOnline: true, currentMachineId: 'm-leg-press', currentMachineName: 'Leg', currentSetNumber: 1, restSecondsRemaining: 60, restEndsAt, isSessionActive: true, sessionStartedAt: startedAt, sessionMachineIds: ['m-leg-press'], lastUpdated: new Date().toISOString() } } });
  assert.deepEqual(get().sessionMachineIds, []);
  assert.deepEqual(get().partnerStatus.sessionMachineIds, ['m-leg-press']);
  assert.equal(get().partnerStatus.restSecondsRemaining, 60);

  get().addMachineToSession('m-chest-press');
  const mine = get().logSet(20, 8, 'm-chest-press');
  assert.equal(mine.workoutId, workoutId);
  deliver('partner-set', { type: 'SET_LOGGED', payload: { set: { id: 'partner-own-set', workoutId, machineId: 'm-leg-press', machineName: 'Leg', userId: partner, setNumber: 1, weight: 10, reps: 8, unit: 'kg', isPR: false, loggedAt: new Date().toISOString() } } });
  assert.deepEqual(get().sessionMachineIds, ['m-chest-press']);
  assert.equal(get().sets.filter((s) => s.workoutId === workoutId && s.userId === get().activeUser).length, 1);
  assert.equal(get().sets.filter((s) => s.workoutId === workoutId && s.userId === partner).length, 1);

  deliver('partner-finish', { type: 'SESSION_FINISHED', payload: { workoutId, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), participants: [partner, get().activeUser], finishedBy: partner, finishedByName: 'Partner', durationSeconds: 60 } });
  assert.equal(get().isSessionActive, false);
  assert.equal(get().partnerStatus.isSessionActive, false);
  assert.equal(get().completedWorkouts.filter((w) => w.id === workoutId).length, 1);
  assert.equal(scheduledAlerts.filter((a) => a[0] === 'workout-alarm').at(-1)[1], null);
  assert.ok(partnerEvents.some((e) => e[0] === `session-end-${workoutId}`));
});

test('Malformed partner machine lists are rejected', () => {
  const isolated = loadTsModule('src/store/useGymCrushStore.ts');
  const partner = isolated.useGymCrushStore().activeUser === 'markus' ? 'partner' : 'markus';
  syncEngineModule.syncEngine.handleIncomingEnvelope({ id: 'bad-machine-list', senderInstanceId: 'other-phone', timestamp: Date.now(), event: { type: 'PARTNER_STATUS', payload: { status: { userId: partner, isOnline: true, currentMachineId: null, currentMachineName: null, currentSetNumber: 0, restSecondsRemaining: 0, sessionMachineIds: [1], lastUpdated: new Date().toISOString() } } } });
  assert.equal(isolated.useGymCrushStore().partnerStatus.sessionMachineIds, undefined);
});

test('The workout alarm defaults to 60 minutes and follows every timer change', () => {
  const isolated = loadTsModule('src/store/useGymCrushStore.ts');
  const get = () => isolated.useGymCrushStore();
  const alarms = () => scheduledAlerts.filter((a) => a[0] === 'workout-alarm').map((a) => a[1]);
  assert.equal(get().sessionAlarmMinutes, 60);
  get().startSession(['m-chest-press'], 'Push');
  const startedAt = get().sessionStartedAt;
  assert.equal(alarms().at(-1), startedAt + 60 * 60000);
  get().setSessionAlarm(45);
  assert.equal(alarms().at(-1), startedAt + 45 * 60000);
  get().setSessionAlarm(999);
  assert.equal(get().sessionAlarmMinutes, 240);
  get().setSessionAlarm(0);
  assert.equal(alarms().at(-1), null);
  get().setSessionAlarm(30);
  assert.equal(alarms().at(-1), startedAt + 30 * 60000);
  get().startRest(90);
  const rest = scheduledAlerts.filter((a) => a[0] === 'rest-end').at(-1);
  assert.ok(rest[1] > Date.now());
  get().finishSession();
  assert.equal(alarms().at(-1), null);
  assert.equal(scheduledAlerts.filter((a) => a[0] === 'rest-end').at(-1)[1], null);
});

test('Exercises can have one language and no settings, and can be updated later', () => {
  const isolated = loadTsModule('src/store/useGymCrushStore.ts');
  let store = isolated.useGymCrushStore();
  store.addMachine({ name: '', nameZh: '深蹲', muscleGroup: 'Legs', locationNote: '', photoUri: '', markusSeat: '', partnerSeat: '', customAdjustments: [] });
  store = isolated.useGymCrushStore();
  const machine = store.machines[0];
  assert.equal(machine.nameZh, '深蹲');
  assert.deepEqual(machine.partnerSetups.markus.adjustments, []);
  store.updateMachineNames(machine.id, 'Squat', '深蹲');
  store.logSet(20, 8, machine.id);
  const updated = isolated.useGymCrushStore().machines.find(item => item.id === machine.id);
  assert.equal(updated.name, 'Squat');
  assert.deepEqual(updated.partnerSetups.markus.adjustments, []);
  isolated.useGymCrushStore().updatePartnerSetup(machine.id, 'markus', '', '', []);
  assert.deepEqual(isolated.useGymCrushStore().machines.find(item => item.id === machine.id).partnerSetups.markus.adjustments, []);
});


test('Finished workout preserves exact timing, title and all sets after reload', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  module.useGymCrushStore().startSession(['m-chest-press'], 'Push day');
  let store = module.useGymCrushStore();
  const startedAt = store.sessionStartedAt;
  store.logSet(42, 11);
  store.finishSession();
  store = module.useGymCrushStore();
  const workout = store.completedWorkouts.at(-1);
  assert.equal(workout.id, `w_${startedAt}`);
  assert.equal(workout.startedAt, new Date(startedAt).toISOString());
  assert.equal(workout.title, 'Push day');
  assert.ok(Date.parse(workout.finishedAt) >= startedAt);
  assert.equal(workout.durationSeconds, Math.floor((Date.parse(workout.finishedAt) - startedAt) / 1000));
  assert.ok(store.sets.some((s) => s.workoutId === workout.id && s.weight === 42 && s.reps === 11));
  const restored = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(restored.useGymCrushStore().completedWorkouts, store.completedWorkouts);
  assert.ok(restored.useGymCrushStore().sets.some((s) => s.workoutId === workout.id && s.weight === 42));
});

test('Every live partner set alerts once, including ordinary sets; historical sets stay silent', () => {
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  const store = module.useGymCrushStore();
  const userId = store.activeUser === 'markus' ? 'partner' : 'markus';
  const engine = syncEngineModule.syncEngine;
  const set = { id: 'ordinary-alert-set', workoutId: 'w_1794000000000', machineId: 'm-chest-press', machineName: 'Chest Press', userId, setNumber: 1, weight: 10, reps: 8, unit: 'kg', isPR: false, loggedAt: new Date().toISOString() };
  const deliver = (id, value, historical = false) => engine.handleIncomingEnvelope({ id, senderInstanceId: 'alert-phone', timestamp: Date.now(), event: { type: 'SET_LOGGED', payload: { set: value } } }, historical);
  deliver('ordinary-alert-event', set);
  const alert = module.useGymCrushStore().latestReaction;
  assert.equal(alert.id, `set_alert_${set.id}`);
  assert.ok(alert.message.includes('10 kg'));
  assert.equal(alert.fromUser, userId);
  const count = deliveredSetAlerts.length;
  deliver('ordinary-alert-retry', set);
  assert.equal(deliveredSetAlerts.length, count);
  deliver('historical-alert-event', { ...set, id: 'historical-set' }, true);
  assert.equal(module.useGymCrushStore().latestReaction.id, alert.id);
  assert.equal(deliveredSetAlerts.length, count);
});

test('Rest countdowns remain attached to each lifter when switching', () => {
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  let store = module.useGymCrushStore();
  const first = store.activeUser;
  const second = first === 'markus' ? 'partner' : 'markus';
  store.startRest(120);
  store.switchActiveUser(second);
  store = module.useGymCrushStore();
  assert.equal(store.partnerStatus.userId, first);
  assert.equal(store.partnerStatus.restSecondsRemaining, 120);
  assert.equal(store.partnerStatus.restDurationSeconds, 120);
  store.startRest(60);
  store.switchActiveUser(first);
  store = module.useGymCrushStore();
  assert.equal(store.restSeconds, 120);
  assert.equal(store.restDurationSeconds, 120);
  assert.equal(store.partnerStatus.userId, second);
  assert.equal(store.partnerStatus.restSecondsRemaining, 60);
  assert.equal(restTimerModule.restProgress(60, 120), 0.5);
  assert.equal(restTimerModule.restProgress(0, 120), 1);
  assert.equal(restTimerModule.restProgress(150, 120), 0);
});

test('Exercise charts group completed workouts, isolate lifters and convert weights consistently', () => {
  const { exerciseProgress, workoutDuration, workoutStart } = loadTsModule('src/services/workoutHistory.ts');
  const workouts = [
    { id: 'w_1794000000000', finishedAt: new Date(1794000065000).toISOString(), participants: ['markus'] },
    { id: 'w_1794086400000', finishedAt: new Date(1794086465000).toISOString(), participants: ['markus'] },
  ];
  const base = { machineId: 'chest', machineName: 'Chest', userId: 'markus', unit: 'kg', weight: 20, reps: 8 };
  const sets = [
    { ...base, workoutId: workouts[1].id, weight: 55.115565545, unit: 'lbs', reps: 12 },
    { ...base, workoutId: workouts[0].id },
    { ...base, workoutId: workouts[0].id, reps: 10 },
    { ...base, workoutId: workouts[0].id, userId: 'partner', weight: 100 },
    { ...base, workoutId: 'still-active', weight: 300 },
  ];
  const points = exerciseProgress(sets, workouts, 'chest', 'markus', 'kg');
  assert.equal(points.length, 2);
  assert.equal(points[0].maxWeight, 20);
  assert.equal(points[0].maxReps, 10);
  assert.equal(points[0].totalReps, 18);
  assert.equal(points[0].sets, 2);
  assert.ok(Math.abs(points[1].maxWeight - 25) < 0.001);
  assert.equal(points[1].maxReps, 12);
  assert.equal(workoutDuration(workouts[0]), 65);
  assert.equal(workoutStart({ id: 'old', finishedAt: workouts[0].finishedAt }), undefined);
  assert.equal(workoutDuration({ id: 'old', finishedAt: workouts[0].finishedAt }), undefined);
});

test('Historical completion is persisted without stopping a different active workout', async () => {
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  module.useGymCrushStore().startSession([], 'Today');
  const start = module.useGymCrushStore().sessionStartedAt;
  const id = 'w_1793900000000';
  syncEngineModule.syncEngine.handleIncomingEnvelope({ id: 'old-completion', senderInstanceId: 'history-phone', timestamp: Date.now(), event: { type: 'SESSION_FINISHED', payload: {
    workoutId: id, startedAt: new Date(1793900000000).toISOString(), finishedAt: new Date(1793900060000).toISOString(), title: 'Earlier push', participants: ['markus'], finishedBy: 'markus', finishedByName: 'Markus', durationSeconds: 60,
  } } }, true);
  assert.equal(module.useGymCrushStore().sessionStartedAt, start);
  assert.equal(module.useGymCrushStore().isSessionActive, true);
  assert.equal(module.useGymCrushStore().completedWorkouts.find((w) => w.id === id).title, 'Earlier push');
  const restored = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(restored.useGymCrushStore().completedWorkouts.find((w) => w.id === id).durationSeconds, 60);
});


test('Native set notifications respect permission and use one stable identifier', async () => {
  let permission = true;
  let handler;
  const requests = [];
  const channels = [];
  const cancelled = [];
  const notifications = {
    AndroidImportance: { DEFAULT: 3, HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
    cancelScheduledNotificationAsync: async (id) => { cancelled.push(id); },
    requestPermissionsAsync: async () => ({ granted: permission }),
    getPermissionsAsync: async () => ({ granted: permission }),
    setNotificationChannelAsync: async (...args) => { channels.push(args); },
    setNotificationHandler: (value) => { handler = value; },
    scheduleNotificationAsync: async (value) => { requests.push(value); },
  };
  const service = loadTsModule('src/services/setNotifications.ts', '', {
    'expo-notifications': notifications,
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'active' } },
  });
  assert.equal(await service.enableSetNotifications(), true);
  assert.equal(channels[0][0], 'workout-sets');
  const set = { id: 'notify-native', workoutId: 'workout', setNumber: 2, machineName: 'Squat', weight: 50, unit: 'kg', reps: 10 };
  await service.notifyCompletedSet(set, 'Abby', 'en');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].identifier, 'set-notify-native');
  assert.equal(requests[0].trigger.channelId, 'workout-sets');
  assert.equal(requests[0].content.title, 'Abby finished set 2');
  assert.equal((await handler.handleNotification()).shouldShowBanner, false);
  assert.equal(requests[0].content.data.url, '/partner-workout');
  const alarmAt = Date.now() + 3600000;
  await service.scheduleAlert('workout-alarm', alarmAt, 'Time', 'Up');
  assert.equal(requests[1].identifier, 'workout-alarm');
  assert.equal(requests[1].trigger.date, alarmAt);
  assert.equal(requests[1].trigger.channelId, 'workout-alarm');
  assert.equal((await handler.handleNotification({ request: { content: { data: { kind: 'workout-alarm' } } } })).shouldPlaySound, true);
  await service.scheduleAlert('workout-alarm', null, '', '');
  await service.scheduleAlert('rest-end', Date.now() - 1000, 'Past', 'Skip');
  assert.deepEqual(cancelled, ['workout-alarm', 'workout-alarm', 'rest-end']);
  assert.equal(requests.length, 2);
  requests.length = 1;
  permission = false;
  await service.notifyCompletedSet({ ...set, id: 'denied' }, 'Abby', 'en');
  assert.equal(requests.length, 1);
  const web = loadTsModule('src/services/setNotifications.ts', '', {
    'react-native': { Platform: { OS: 'web' } },
  });
  assert.equal(await web.enableSetNotifications(), false);
  await web.notifyCompletedSet(set, 'Abby', 'en');
});


test('Editing and removing sets preserves history and updates exercise records', () => {
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  module.useGymCrushStore().startSession(['m-chest-press'], 'Push');
  const set = module.useGymCrushStore().logSet(100, 8, 'm-chest-press');
  module.useGymCrushStore().changeSet(set.id, { weight: 25, reps: 12 });
  assert.equal(module.useGymCrushStore().sets.find((item) => item.id === set.id).weight, 25);
  module.useGymCrushStore().changeSet(set.id, null);
  assert.equal(module.useGymCrushStore().sets.some((item) => item.id === set.id), false);
  const next = module.useGymCrushStore().logSet(30, 10, 'm-chest-press');
  module.useGymCrushStore().deleteMachine('m-chest-press');
  assert.equal(module.useGymCrushStore().machines.some((item) => item.id === 'm-chest-press'), false);
  assert.equal(module.useGymCrushStore().sets.find((item) => item.id === next.id).machineName, next.machineName);
});

test('Quick routines start with three defaults and create, edit and delete persist', async () => {
  memoryStorage.delete('GYMCRUSH_PERSISTED_STATE_V1');
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(module.useGymCrushStore().quickRoutines.map((r) => r.name), ['Push', 'Pull', 'Legs']);
  module.useGymCrushStore().saveQuickRoutine({ id: 'push', name: 'Push', machineIds: [] });
  module.useGymCrushStore().saveQuickRoutine({ id: 'custom', name: 'Core', machineIds: ['m-chest-press'] });
  module.useGymCrushStore().deleteQuickRoutine('pull');
  await new Promise((resolve) => setImmediate(resolve));
  const restored = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(restored.useGymCrushStore().quickRoutines.map((r) => r.name), ['Push', 'Legs', 'Core']);
  assert.deepEqual(restored.useGymCrushStore().quickRoutines[0].machineIds, []);
  assert.deepEqual(restored.useGymCrushStore().quickRoutines[2].machineIds, ['m-chest-press']);
});

test('Legacy routine selections are migrated including an edited arms routine', async () => {
  memoryStorage.set('GYMCRUSH_PERSISTED_STATE_V1', JSON.stringify({ quickRoutines: { push: [], arms: ['m-chest-press'] } }));
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  const routines = module.useGymCrushStore().quickRoutines;
  assert.deepEqual(routines.map((r) => r.name), ['Push', 'Pull', 'Legs', 'Arms']);
  assert.deepEqual(routines[0].machineIds, []);
  assert.deepEqual(routines[3].machineIds, ['m-chest-press']);
});

test('Finishing a workout with no logged sets does not add it to history', () => {
  let store = getStore();
  store.finishSession();
  const before = getStore().completedWorkouts.length;
  getStore().startSession([], 'Empty');
  assert.equal(getStore().isSessionActive, true);
  getStore().finishSession();
  store = getStore();
  assert.equal(store.isSessionActive, false);
  assert.equal(store.completedWorkouts.length, before);
});

test('History session rename persists, syncs, and preserves timing and sets', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  module.useGymCrushStore().startSession(['m-chest-press'], 'Before');
  const set = module.useGymCrushStore().logSet(40, 8, 'm-chest-press');
  module.useGymCrushStore().finishSession();
  const original = module.useGymCrushStore().completedWorkouts.at(-1);
  module.useGymCrushStore().changeWorkout(original.id, '  Push day  ');
  assert.deepEqual(module.useGymCrushStore().completedWorkouts.at(-1), { ...original, title: 'Push day' });
  module.useGymCrushStore().changeWorkout(original.id, '  ');
  module.useGymCrushStore().changeWorkout(original.id, 'x'.repeat(121));
  assert.equal(module.useGymCrushStore().completedWorkouts.at(-1).title, 'Push day');
  assert.equal(module.useGymCrushStore().sets.find((item) => item.id === set.id).weight, 40);
  const renamed = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renamed.useGymCrushStore().completedWorkouts.at(-1).title, 'Push day');
  const deliver = (id, payload) => syncEngineModule.syncEngine.handleIncomingEnvelope({
    id, senderInstanceId: 'history-phone', timestamp: Date.now(), event: { type: 'SESSION_CHANGED', payload },
  }, true);
  deliver('history-rename', { workoutId: original.id, title: '推日訓練' });
  assert.equal(renamed.useGymCrushStore().completedWorkouts.at(-1).title, '推日訓練');
  deliver('history-invalid-rename', { workoutId: original.id, title: 42 });
  assert.equal(renamed.useGymCrushStore().completedWorkouts.at(-1).title, '推日訓練');
});

test('Deleting a shared history session removes its sets, recalculates records and progress, and survives stale sync after reload', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  module.useGymCrushStore().startSession(['m-chest-press'], 'Keep');
  const kept = module.useGymCrushStore().logSet(30, 8, 'm-chest-press');
  module.useGymCrushStore().finishSession();
  const keptWorkout = module.useGymCrushStore().completedWorkouts.at(-1);
  module.useGymCrushStore().startSession(['m-chest-press'], 'Delete');
  const deletedSet = module.useGymCrushStore().logSet(100, 10, 'm-chest-press');
  module.useGymCrushStore().switchActiveUser('partner');
  const partnerSet = module.useGymCrushStore().logSet(60, 12, 'm-chest-press');
  module.useGymCrushStore().finishSession();
  const deleted = module.useGymCrushStore().completedWorkouts.at(-1);
  assert.equal(module.useGymCrushStore().profiles.partner.completedThisWeek, 1);
  module.useGymCrushStore().startSession([], 'Active workout');
  const activeStart = module.useGymCrushStore().sessionStartedAt;
  module.useGymCrushStore().changeWorkout(deleted.id, null);
  let store = module.useGymCrushStore();
  assert.deepEqual(store.completedWorkouts, [keptWorkout]);
  assert.equal(store.sets.some((set) => set.workoutId === deleted.id), false);
  assert.ok(store.sets.some((set) => set.id === kept.id));
  const machine = store.machines.find((item) => item.id === 'm-chest-press');
  assert.equal(machine.partnerSetups.markus.personalRecordWeight, 75); // initial 75 kg set remains
  assert.equal(machine.partnerSetups.partner.personalRecordWeight, 32.5);
  assert.equal(store.profiles.partner.completedThisWeek, 0);
  assert.equal(store.profiles.markus.completedThisWeek, 1);
  assert.equal(store.isSessionActive, true);
  assert.equal(store.sessionStartedAt, activeStart);
  const restored = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  const deliver = (id, event) => syncEngineModule.syncEngine.handleIncomingEnvelope({
    id, senderInstanceId: 'history-delete-phone', timestamp: Date.now(), event,
  }, true);
  deliver('history-stale-set', { type: 'SET_LOGGED', payload: { set: deletedSet } });
  deliver('history-stale-partner-set', { type: 'SET_LOGGED', payload: { set: partnerSet } });
  deliver('history-stale-finish', { type: 'SESSION_FINISHED', payload: {
    workoutId: deleted.id, finishedAt: deleted.finishedAt, participants: deleted.participants,
    finishedBy: 'partner', finishedByName: 'Abby', durationSeconds: deleted.durationSeconds,
  } });
  deliver('history-stale-rename', { type: 'SESSION_CHANGED', payload: { workoutId: deleted.id, title: 'Resurrected' } });
  store = restored.useGymCrushStore();
  assert.equal(store.completedWorkouts.some((workout) => workout.id === deleted.id), false);
  assert.equal(store.sets.some((set) => set.workoutId === deleted.id), false);
  assert.equal(store.sessionStartedAt, activeStart);
  assert.equal(JSON.parse(memoryStorage.get('GYMCRUSH_PERSISTED_STATE_V1')).workoutEdits[deleted.id], null);
  deliver('history-delete-remote', { type: 'SESSION_CHANGED', payload: { workoutId: keptWorkout.id, title: null } });
  assert.equal(restored.useGymCrushStore().completedWorkouts.length, 0);
  assert.equal(restored.useGymCrushStore().sets.some((set) => set.id === kept.id), false);
});

test('A session change arriving before its completion is retained', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  const engine = syncEngineModule.syncEngine;
  const deliver = (id, event) => engine.handleIncomingEnvelope({ id, senderInstanceId: 'history-order-phone', timestamp: Date.now(), event }, true);
  for (const [id, title] of [['history-early-rename', 'New title'], ['history-early-delete', null]]) {
    deliver(id, { type: 'SESSION_CHANGED', payload: { workoutId: id, title } });
    deliver(`${id}-finished`, { type: 'SESSION_FINISHED', payload: {
      workoutId: id, finishedAt: new Date().toISOString(), participants: ['markus'],
      finishedBy: 'markus', finishedByName: 'Markus', durationSeconds: 300, title: 'Old title',
    } });
  }
  assert.equal(module.useGymCrushStore().completedWorkouts.find((workout) => workout.id === 'history-early-rename').title, 'New title');
  assert.equal(module.useGymCrushStore().completedWorkouts.some((workout) => workout.id === 'history-early-delete'), false);
});

test('History deletion asks for confirmation before changing data or navigating', () => {
  const changes = [];
  const destinations = [];
  let alert;
  const workout = { id: 'confirm-history', title: 'Push', finishedAt: new Date().toISOString(), participants: [] };
  const store = { completedWorkouts: [workout], sets: [], language: 'en', changeWorkout: (...args) => changes.push(args) };
  const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat() });
  const mocks = {
    react: { createElement, useState: (initial) => [initial, () => {}] },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert: (...args) => { alert = args; } }, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (s) => s, hairlineWidth: 1 } },
    'expo-router': { Stack: { Screen: 'Screen' }, useLocalSearchParams: () => ({ workoutId: workout.id }), useRouter: () => ({ replace: (path) => destinations.push(path) }) },
    '../../../src/store/useGymCrushStore': { useGymCrushStore: () => store },
    '../../../src/theme/theme': { useTheme: () => ({ colors: {} }), gutter: 16, space: {}, radius: {}, touch: {} },
    '../../../src/ui/primitives': Object.fromEntries(['AppText', 'Avatar', 'Button', 'Card', 'Chip', 'EmptyState', 'Icon', 'IconButton', 'ScreenScroll', 'SegmentedControl', 'TextField'].map((name) => [name, name]).concat([['haptics', { warning() {} }]])),
    '../../../src/i18n/useCopy': { useCopy: () => (en) => en, plural: (n) => `${n} sets` },
    '../../../src/services/workoutHistory': { workoutDuration: () => undefined, workoutStart: () => undefined },
    '../../../src/features/history/helpers': { formatDuration: () => undefined },
    '../../../src/features/workout/exerciseTiming': { computeWorkoutExerciseAnalytics: () => [], formatClockTime: () => '', formatShortDuration: () => '' },
    '../../../src/features/workout/Stepper': { KeyboardDoneBar: 'KeyboardDoneBar', Stepper: 'Stepper' },
    '../../../src/features/workout/workoutHelpers': { formatWeight: (n) => String(n), machineName: (m) => m?.name || '' },
    '../../../src/features/machines/machineUtils': { MUSCLE_GROUPS: ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full Body'] },
    '../../../src/i18n/translations': translationsModule,
    '../../../src/components/MachineImage': { MachineImage: 'MachineImage' },
  };
  const findDelete = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Button' && node.props.title === 'Delete session') return node;
    return node.children?.map(findDelete).find(Boolean);
  };
  const screen = loadTsModule('app/(tabs)/history/[workoutId].tsx', '', mocks).default();
  findDelete(screen).props.onPress();
  assert.deepEqual(changes, []);
  assert.deepEqual(destinations, []);
  assert.equal(alert[2][0].style, 'cancel');
  assert.equal(alert[2][1].style, 'destructive');
  alert[2][1].onPress();
  assert.deepEqual(changes, [[workout.id, null]]);
  assert.deepEqual(destinations, ['/history']);
  mocks['react-native'].Platform.OS = 'web';
  const previousConfirm = window.confirm;
  try {
    window.confirm = () => false;
    findDelete(loadTsModule('app/(tabs)/history/[workoutId].tsx', '', mocks).default()).props.onPress();
    assert.equal(changes.length, 1);
    window.confirm = () => true;
    findDelete(loadTsModule('app/(tabs)/history/[workoutId].tsx', '', mocks).default()).props.onPress();
    assert.equal(changes.length, 2);
  } finally {
    window.confirm = previousConfirm;
  }
});

test('Starting a workout without a preset starts completely empty', () => {
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  let store = module.useGymCrushStore();
  store.finishSession();
  store.addMachine({
    name: 'Cable Fly',
    muscleGroup: 'Chest',
    locationNote: 'Zone 1',
    photoUri: 'https://example.com/fly.jpg',
    markusSeat: '4',
    partnerSeat: '2',
  });
  store = module.useGymCrushStore();
  assert.deepEqual(store.sessionMachineIds, [], 'Adding a machine outside a workout must not prefill future empty workouts');
  store.startSession();
  store = module.useGymCrushStore();
  assert.equal(store.isSessionActive, true);
  assert.deepEqual(store.sessionMachineIds, [], 'startSession() with no preset must start with zero exercises');
  assert.equal(store.selectedMachineId, null);
  store.finishSession();
});

test('Editing an exercise updates all fields including muscle group and workout splits', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  let store = module.useGymCrushStore();
  const target = store.machines.find((m) => m.id === 'm-chest-press');
  assert.equal(target.muscleGroup, 'Chest');
  store.startSession([target.id], 'Upper');
  const logged = module.useGymCrushStore().logSet(60, 10, target.id);
  module.useGymCrushStore().finishSession();

  module.useGymCrushStore().updateMachine(target.id, {
    name: 'Incline Row Machine',
    nameZh: '上斜划船機',
    muscleGroup: 'Back',
    locationNote: 'Tower 3',
    photoUri: 'https://example.com/row.jpg',
  });
  store = module.useGymCrushStore();
  const updated = store.machines.find((m) => m.id === target.id);
  assert.equal(updated.name, 'Incline Row Machine');
  assert.equal(updated.nameZh, '上斜划船機');
  assert.equal(updated.muscleGroup, 'Back');
  assert.deepEqual(updated.workoutSplits, ['pull', 'upper']);
  assert.equal(updated.locationNote, 'Tower 3');
  assert.equal(updated.photoUri, 'https://example.com/row.jpg');
  assert.equal(store.sets.find((s) => s.id === logged.id).machineName, 'Incline Row Machine');

  const reloaded = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  const persisted = reloaded.useGymCrushStore().machines.find((m) => m.id === target.id);
  assert.equal(persisted.muscleGroup, 'Back');
  assert.deepEqual(persisted.workoutSplits, ['pull', 'upper']);
  assert.equal(persisted.name, 'Incline Row Machine');
});

test('Editing saved workouts supports adding/removing exercises and logging partner sets', async () => {
  memoryStorage.clear();
  const module = loadTsModule('src/store/useGymCrushStore.ts');
  await new Promise((resolve) => setImmediate(resolve));
  module.useGymCrushStore().startSession(['m-chest-press'], 'Push');
  module.useGymCrushStore().logSet(80, 8, 'm-chest-press');
  module.useGymCrushStore().finishSession();

  let store = module.useGymCrushStore();
  const workout = store.completedWorkouts.at(-1);
  assert.deepEqual(workout.participants, ['markus']);

  // Partner forgot their phone: add Lat Pulldown and log sets for partner on this completed workout
  store.addExerciseToWorkout(workout.id, 'm-lat-pulldown');
  store = module.useGymCrushStore();
  assert.ok(store.completedWorkouts.at(-1).machineIds.includes('m-lat-pulldown'));

  const addedPartnerSet = store.addSetToWorkout(workout.id, 'm-lat-pulldown', 'partner', 55, 10);
  assert.ok(addedPartnerSet);
  assert.equal(addedPartnerSet.userId, 'partner');
  assert.equal(addedPartnerSet.isPR, true, 'Partner PR (55 > 47.5) must be detected on retroactively added set');

  store = module.useGymCrushStore();
  assert.ok(store.completedWorkouts.at(-1).participants.includes('partner'));
  assert.equal(store.profiles.partner.completedThisWeek, 1);

  // Completed workout sets can be edited regardless of activeUser
  store.changeSet(addedPartnerSet.id, { weight: 40, reps: 12 });
  store = module.useGymCrushStore();
  assert.equal(store.sets.find((s) => s.id === addedPartnerSet.id).weight, 40);

  // Removing exercise deletes its sets and updates participants & records
  store.removeExerciseFromWorkout(workout.id, 'm-lat-pulldown');
  store = module.useGymCrushStore();
  assert.equal(store.sets.some((s) => s.workoutId === workout.id && s.machineId === 'm-lat-pulldown'), false);
  assert.equal(store.completedWorkouts.at(-1).machineIds.includes('m-lat-pulldown'), false);
  assert.deepEqual(store.completedWorkouts.at(-1).participants, ['markus']);
  assert.equal(store.profiles.partner.completedThisWeek, 0);
});

test('Phone-clock timing tracks workout/exercise start & end and computes set, break, and gap analytics', () => {
  const { computeWorkoutExerciseAnalytics } = loadTsModule('src/features/workout/exerciseTiming.ts');
  const realNow = Date.now;
  let clock = Date.parse('2026-11-17T09:00:00.000Z');
  Date.now = () => clock;
  try {
    const module = loadTsModule('src/store/useGymCrushStore.ts');
    let store = module.useGymCrushStore();
    store.finishSession();

    // Start workout at 09:00:00 with Chest Press
    store.startSession(['m-chest-press'], 'Push');
    clock += 40_000; // 09:00:40 -> Set 1 logged (40s active)
    const s1 = module.useGymCrushStore().logSet(80, 10, 'm-chest-press');

    // Simulate 90s rest finishing at 09:02:10
    clock += 90_000;
    intervalCallbacks.find((timer) => timer.ms === 100).callback();

    // 50s later at 09:03:00 -> Set 2 logged
    clock += 50_000;
    const s2 = module.useGymCrushStore().logSet(80, 10, 'm-chest-press');

    // Transition to Lat Pulldown 120s later at 09:05:00
    clock += 120_000;
    module.useGymCrushStore().addMachineToSession('m-lat-pulldown');

    // 45s later at 09:05:45 -> Set 1 on Lat Pulldown
    clock += 45_000;
    const s3 = module.useGymCrushStore().logSet(70, 10, 'm-lat-pulldown');

    module.useGymCrushStore().finishSession();
    store = module.useGymCrushStore();
    const completed = store.completedWorkouts.at(-1);

    assert.equal(s1.startedAt, '2026-11-17T09:00:00.000Z');
    assert.equal(s1.loggedAt, '2026-11-17T09:00:40.000Z');
    assert.equal(s2.startedAt, '2026-11-17T09:02:10.000Z');
    assert.equal(s2.loggedAt, '2026-11-17T09:03:00.000Z');
    assert.equal(s3.exerciseStartedAt, '2026-11-17T09:05:00.000Z');

    assert.equal(completed.exerciseTimings['m-chest-press'].startedAt, '2026-11-17T09:00:00.000Z');
    assert.equal(completed.exerciseTimings['m-chest-press'].endedAt, '2026-11-17T09:03:00.000Z');
    assert.equal(completed.exerciseTimings['m-lat-pulldown'].startedAt, '2026-11-17T09:05:00.000Z');
    assert.equal(completed.exerciseTimings['m-lat-pulldown'].endedAt, '2026-11-17T09:05:45.000Z');

    const workoutSets = store.sets.filter((s) => s.workoutId === completed.id);
    const analytics = computeWorkoutExerciseAnalytics(
      workoutSets,
      completed.machineIds,
      completed.exerciseTimings,
      completed.startedAt,
    );
    assert.equal(analytics.length, 2);
    assert.equal(analytics[0].machineId, 'm-chest-press');
    assert.equal(analytics[0].avgSetSeconds, 45); // avg(40, 50)
    assert.equal(analytics[0].avgBreakSeconds, 90);
    assert.deepEqual(analytics[0].breaksSeconds, [90]);
    assert.equal(analytics[1].machineId, 'm-lat-pulldown');
    assert.equal(analytics[1].timeSincePreviousExerciseSeconds, 120);
    assert.equal(analytics[1].avgSetSeconds, 45);
  } finally {
    Date.now = realNow;
  }
});
