import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import {
  CompletedWorkout,
  CoupleStreakState,
  ExerciseTiming,
  GymMachine,
  HypeEmoji,
  HypeReaction,
  Language,
  MachineAdjustment,
  MachinePartnerSetup,
  MuscleGroup,
  PartnerId,
  PartnerLiveStatus,
  PartnerProfile,
  QuickRoutine,
  WorkoutSetLog,
  WorkoutSplit,
  WorkoutSplitId,
} from '../types/gym';
import { enableSetNotifications, notifyCompletedSet, notifyPartnerEvent, scheduleAlert } from '../services/setNotifications';
import { syncEngine, SyncEvent } from '../services/syncEngine';

const STORAGE_KEY = 'GYMCRUSH_PERSISTED_STATE_V1';

export const WORKOUT_SPLITS: WorkoutSplit[] = [
  {
    id: 'all',
    name: 'All Machines',
    subtitle: 'Full gym floor catalog',
    muscleGroups: ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full Body'],
  },
  {
    id: 'push',
    name: 'Push Day',
    subtitle: 'Chest, Shoulders & Triceps',
    muscleGroups: ['Chest', 'Shoulders', 'Arms'],
  },
  {
    id: 'pull',
    name: 'Pull Day',
    subtitle: 'Back, Rear Delts & Biceps',
    muscleGroups: ['Back', 'Arms'],
  },
  {
    id: 'legs',
    name: 'Leg & Glute Day',
    subtitle: 'Quads, Hamstrings & Glute Drive',
    muscleGroups: ['Legs', 'Glutes'],
  },
  {
    id: 'upper',
    name: 'Upper Body',
    subtitle: 'Compound Torso & Arm Split',
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms'],
  },
];

function inferSplitsForMuscle(muscleGroup: MuscleGroup): WorkoutSplitId[] {
  switch (muscleGroup) {
    case 'Chest':
    case 'Shoulders':
      return ['push', 'upper'];
    case 'Back':
      return ['pull', 'upper'];
    case 'Arms':
      return ['push', 'pull', 'upper'];
    case 'Legs':
    case 'Glutes':
      return ['legs'];
    default:
      return ['upper', 'legs'];
  }
}

function buildSynchronizedSetup(
  setup: Partial<MachinePartnerSetup> | undefined,
  defaultLabels: [string, string, ...string[]] = ['Seat Height', 'Pad / Lever'],
  fallbackSeat = 'Standard',
  fallbackPin = 'Standard'
): MachinePartnerSetup {
  const existingAdjustments = Array.isArray(setup?.adjustments) ? setup!.adjustments : [];
  const seatPosition =
    setup?.seatPosition ?? existingAdjustments[0]?.value ?? fallbackSeat;
  const pinOrPadNote =
    setup?.pinOrPadNote ??
    (existingAdjustments.length > 0 ? existingAdjustments[1]?.value ?? '' : fallbackPin);

  const adj0Label = existingAdjustments[0]?.label || defaultLabels[0] || 'Seat Height';
  const adj1Label = existingAdjustments[1]?.label || defaultLabels[1] || 'Pad / Lever';

  let normalizedAdjustments: MachineAdjustment[];
  if (Array.isArray(setup?.adjustments)) {
    normalizedAdjustments = existingAdjustments.map((adj, idx) => ({
      id: adj.id || `adj-${idx + 1}`,
      label:
        adj.label ||
        defaultLabels[idx] ||
        (idx === 0 ? adj0Label : idx === 1 ? adj1Label : `Setting ${idx + 1}`),
      value:
        idx === 0
          ? seatPosition
          : idx === 1 && pinOrPadNote
          ? pinOrPadNote
          : adj.value || '1',
    }));
  } else if (pinOrPadNote === '') {
    normalizedAdjustments = [
      {
        id: 'adj-1',
        label: adj0Label,
        value: seatPosition,
      },
    ];
  } else {
    normalizedAdjustments = [
      {
        id: 'adj-1',
        label: adj0Label,
        value: seatPosition,
      },
      {
        id: 'adj-2',
        label: adj1Label,
        value: pinOrPadNote,
      },
    ];
  }

  return {
    adjustments: normalizedAdjustments,
    seatPosition,
    pinOrPadNote,
    lastWorkingWeight: setup?.lastWorkingWeight ?? 0,
    lastReps: setup?.lastReps ?? 0,
    personalRecordWeight: setup?.personalRecordWeight ?? 0,
  };
}

const INITIAL_PROFILES: Record<PartnerId, PartnerProfile> = {
  markus: {
    id: 'markus',
    name: 'Markus',
    platform: 'Android',
    unit: 'kg',
    avatarEmoji: 'M',
    accentColor: '#FAFAFA',
    weeklyGoal: 4,
    completedThisWeek: 3,
  },
  partner: {
    id: 'partner',
    name: 'Abby',
    platform: 'iOS',
    unit: 'kg',
    avatarEmoji: 'A',
    accentColor: '#D4D4D8',
    weeklyGoal: 4,
    completedThisWeek: 3,
  },
};

const INITIAL_MACHINES: GymMachine[] = [
  {
    id: 'm-chest-press',
    name: 'Iso-Lateral Chest Press',
    nameZh: '分動式胸推機',
    muscleGroup: 'Chest',
    workoutSplits: ['push', 'upper'],
    locationNote: 'Free Weight Zone — Plate Loaded (Dual Arm)',
    locationNoteZh: '自由重量區 — 掛片式',
    adjustmentLabels: ['Seat Height', 'Back Pad / Grip', 'Foot Assist Lever'],
    photoUri:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    partnerSetups: {
      markus: {
        seatPosition: 'Height 5',
        pinOrPadNote: 'Pin 3 (Mid grip)',
        adjustments: [
          { id: 'cp-m-1', label: 'Seat Height', value: 'Height 5' },
          { id: 'cp-m-2', label: 'Back Pad / Grip', value: 'Pin 3 (Mid grip)' },
          { id: 'cp-m-3', label: 'Foot Assist Lever', value: 'Locked Out' },
        ],
        lastWorkingWeight: 80,
        lastReps: 8,
        personalRecordWeight: 90,
      },
      partner: {
        seatPosition: 'Height 2',
        pinOrPadNote: 'Pin 1 (Narrow)',
        adjustments: [
          { id: 'cp-p-1', label: 'Seat Height', value: 'Height 2' },
          { id: 'cp-p-2', label: 'Back Pad / Grip', value: 'Pin 1 (Narrow)' },
          { id: 'cp-p-3', label: 'Foot Assist Lever', value: 'Engaged (Pos 2)' },
        ],
        lastWorkingWeight: 35,
        lastReps: 10,
        personalRecordWeight: 40,
      },
    },
  },
  {
    id: 'm-lat-pulldown',
    name: 'Seated Cable Lat Pulldown',
    nameZh: '坐姿滑輪下拉機',
    muscleGroup: 'Back',
    workoutSplits: ['pull', 'upper'],
    locationNote: 'Tower 2 — Pin-Selected Stack (Upstairs)',
    locationNoteZh: '滑輪訓練區 — 4號塔',
    adjustmentLabels: ['Thigh Pad Roller', 'Cable Attachment', 'Seat Cushion'],
    photoUri:
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    partnerSetups: {
      markus: {
        seatPosition: 'Thigh Pad 4',
        pinOrPadNote: 'Wide Mag Grip',
        adjustments: [
          { id: 'lp-m-1', label: 'Thigh Pad Roller', value: 'Thigh Pad 4' },
          { id: 'lp-m-2', label: 'Cable Attachment', value: 'Wide Mag Grip' },
          { id: 'lp-m-3', label: 'Seat Cushion', value: 'Standard Flat' },
        ],
        lastWorkingWeight: 75,
        lastReps: 10,
        personalRecordWeight: 82.5,
      },
      partner: {
        seatPosition: 'Thigh Pad 2',
        pinOrPadNote: 'Medium Neutral Bar',
        adjustments: [
          { id: 'lp-p-1', label: 'Thigh Pad Roller', value: 'Thigh Pad 2' },
          { id: 'lp-p-2', label: 'Cable Attachment', value: 'Medium Neutral Bar' },
          { id: 'lp-p-3', label: 'Seat Cushion', value: 'Booster Pad On' },
        ],
        lastWorkingWeight: 42.5,
        lastReps: 12,
        personalRecordWeight: 47.5,
      },
    },
  },
  {
    id: 'm-leg-press',
    name: '45° Incline Leg Press',
    nameZh: '45度斜板腿推機',
    muscleGroup: 'Legs',
    workoutSplits: ['legs'],
    locationNote: 'Leg Compound Pit — Plate Loaded',
    locationNoteZh: '下肢訓練區',
    adjustmentLabels: ['Backrest Angle', 'Safety Stopper', 'Foot Stance'],
    photoUri:
      'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=800&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    partnerSetups: {
      markus: {
        seatPosition: 'Sled Angle 3',
        pinOrPadNote: 'Safety Catch Low',
        adjustments: [
          { id: 'lg-m-1', label: 'Backrest Angle', value: 'Sled Angle 3' },
          { id: 'lg-m-2', label: 'Safety Stopper', value: 'Safety Catch Low' },
          { id: 'lg-m-3', label: 'Foot Stance', value: 'Mid Platform Wide' },
        ],
        lastWorkingWeight: 180,
        lastReps: 8,
        personalRecordWeight: 210,
      },
      partner: {
        seatPosition: 'Sled Angle 1',
        pinOrPadNote: 'Safety Catch High',
        adjustments: [
          { id: 'lg-p-1', label: 'Backrest Angle', value: 'Sled Angle 1' },
          { id: 'lg-p-2', label: 'Safety Stopper', value: 'Safety Catch High' },
          { id: 'lg-p-3', label: 'Foot Stance', value: 'High & Narrow (Glutes)' },
        ],
        lastWorkingWeight: 95,
        lastReps: 12,
        personalRecordWeight: 105,
      },
    },
  },
  {
    id: 'm-hip-thrust',
    name: 'Glute Drive / Hip Thrust Machine',
    nameZh: '臀推訓練機',
    muscleGroup: 'Glutes',
    workoutSplits: ['legs'],
    locationNote: 'Glute & Posterior Zone — Plate Loaded',
    locationNoteZh: '臀腿專區',
    adjustmentLabels: ['Footplate Position', 'Pelvic Belt', 'Back Roller Pad'],
    photoUri:
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    partnerSetups: {
      markus: {
        seatPosition: 'Pad Notch 6',
        pinOrPadNote: 'Belt Tight',
        adjustments: [
          { id: 'ht-m-1', label: 'Footplate Position', value: 'Pad Notch 6' },
          { id: 'ht-m-2', label: 'Pelvic Belt', value: 'Belt Tight' },
          { id: 'ht-m-3', label: 'Back Roller Pad', value: 'Setting 4' },
        ],
        lastWorkingWeight: 120,
        lastReps: 10,
        personalRecordWeight: 140,
      },
      partner: {
        seatPosition: 'Pad Notch 3',
        pinOrPadNote: 'Velcro Pad Extra',
        adjustments: [
          { id: 'ht-p-1', label: 'Footplate Position', value: 'Pad Notch 3' },
          { id: 'ht-p-2', label: 'Pelvic Belt', value: 'Velcro Pad Extra' },
          { id: 'ht-p-3', label: 'Back Roller Pad', value: 'Setting 2' },
        ],
        lastWorkingWeight: 85,
        lastReps: 12,
        personalRecordWeight: 100,
      },
    },
  },
];

function normalizeMachine(machine: GymMachine): GymMachine {
  const labels: [string, string, ...string[]] =
    machine.adjustmentLabels && machine.adjustmentLabels.length >= 2
      ? machine.adjustmentLabels
      : ['Seat Height', 'Pad / Lever'];

  const initialMatch = INITIAL_MACHINES.find((m) => m.id === machine.id);

  return {
    ...machine,
    nameZh: machine.nameZh || initialMatch?.nameZh,
    locationNoteZh: machine.locationNoteZh || initialMatch?.locationNoteZh,
    workoutSplits:
      machine.workoutSplits && machine.workoutSplits.length > 0
        ? machine.workoutSplits
        : inferSplitsForMuscle(machine.muscleGroup),
    adjustmentLabels: labels,
    partnerSetups: {
      markus: buildSynchronizedSetup(machine.partnerSetups?.markus, labels, 'Height 5', 'Pin 3'),
      partner: buildSynchronizedSetup(machine.partnerSetups?.partner, labels, 'Height 2', 'Pin 1'),
    },
  };
}

const INITIAL_SETS: WorkoutSetLog[] = [
  {
    id: 'set-init-1',
    workoutId: 'w-today',
    machineId: 'm-chest-press',
    machineName: 'Iso-Lateral Chest Press',
    userId: 'markus',
    setNumber: 1,
    weight: 75,
    reps: 10,
    unit: 'kg',
    isPR: false,
    loggedAt: new Date(Date.now() - 480000).toISOString(),
  },
  {
    id: 'set-init-2',
    workoutId: 'w-today',
    machineId: 'm-chest-press',
    machineName: 'Iso-Lateral Chest Press',
    userId: 'partner',
    setNumber: 1,
    weight: 32.5,
    reps: 12,
    unit: 'kg',
    isPR: false,
    loggedAt: new Date(Date.now() - 240000).toISOString(),
  },
];

interface StoreState {
  activeUser: PartnerId;
  language: Language;
  isSessionActive: boolean;
  sessionStartedAt: number | null;
  sessionElapsedSeconds: number;
  sessionTitle: string;
  sessionMachineIds: string[];
  sessionExerciseTimings: Record<string, ExerciseTiming>;
  currentSetStartedAt: number | null;
  profiles: Record<PartnerId, PartnerProfile>;
  machines: GymMachine[];
  sets: WorkoutSetLog[];
  partnerStatus: PartnerLiveStatus;
  streak: CoupleStreakState;
  latestReaction: HypeReaction | null;
  restSeconds: number;
  sessionAlarmMinutes: number;
  selectedMachineId: string | null;
  activeSplit: WorkoutSplitId;
  syncConnected: boolean;
  cloudConnected: boolean;
  isOnboardingOpen: boolean;
  hasCompletedOnboarding: boolean;
  restEndsAt: number | null;
  restDurationSeconds: number;
  completedWorkouts: CompletedWorkout[];
  workoutEdits: Record<string, string | null>;
  quickRoutines: QuickRoutine[];
}

const defaultQuickRoutines = (): QuickRoutine[] => [
  { id: 'push', name: 'Push', machineIds: null },
  { id: 'pull', name: 'Pull', machineIds: null },
  { id: 'legs', name: 'Legs', machineIds: null },
];

function loadQuickRoutines(value: unknown): QuickRoutine[] {
  if (Array.isArray(value)) return value.filter((item): item is QuickRoutine =>
    item && typeof item.id === 'string' && typeof item.name === 'string' &&
    (item.machineIds === null || (Array.isArray(item.machineIds) && item.machineIds.every((id: unknown) => typeof id === 'string'))));
  const defaults = defaultQuickRoutines();
  if (!value || typeof value !== 'object') return defaults;
  const legacy = value as Record<string, unknown>;
  for (const routine of defaults) if (Array.isArray(legacy[routine.id])) routine.machineIds = (legacy[routine.id] as unknown[]).filter((id): id is string => typeof id === 'string');
  if (Array.isArray(legacy.arms)) defaults.push({ id: 'arms', name: 'Arms', machineIds: legacy.arms.filter((id): id is string => typeof id === 'string') });
  return defaults;
}

const initialActiveUser: PartnerId = Platform.OS === 'ios' ? 'partner' : 'markus';
syncEngine.setCurrentUser(initialActiveUser);

let state: StoreState = {
  activeUser: initialActiveUser,
  language: 'en',
  isSessionActive: false,
  sessionStartedAt: null,
  sessionElapsedSeconds: 0,
  sessionTitle: 'Workout Session',
  sessionMachineIds: [],
  sessionExerciseTimings: {},
  currentSetStartedAt: null,
  profiles: INITIAL_PROFILES,
  machines: INITIAL_MACHINES,
  sets: INITIAL_SETS,
  partnerStatus: {
    userId: initialActiveUser === 'markus' ? 'partner' : 'markus',
    isOnline: false,
    currentMachineId: 'm-chest-press',
    currentMachineName: 'Iso-Lateral Chest Press',
    currentSetNumber: 1,
    restSecondsRemaining: 35,
    lastUpdated: new Date().toISOString(),
  },
  streak: {
    currentStreakWeeks: 0,
    bestStreakWeeks: 0,
    coupleInviteCode: 'CRUSH-8899',
    isPaired: false,
  },
  latestReaction: null,
  restSeconds: 0,
  sessionAlarmMinutes: 60,
  selectedMachineId: 'm-chest-press',
  activeSplit: 'all',
  syncConnected: false,
  cloudConnected: false,
  isOnboardingOpen: false,
  hasCompletedOnboarding: false,
  restEndsAt: null,
  restDurationSeconds: 0,
  completedWorkouts: [],
  workoutEdits: {},
  quickRoutines: defaultQuickRoutines(),
};

const listeners = new Set<() => void>();
let lastSessionStart = 0;
function nextSessionStart() {
  lastSessionStart = Math.max(Date.now(), lastSessionStart + 1);
  return lastSessionStart;
}

function convertSetupUnit(setup: MachinePartnerSetup, from: 'kg' | 'lbs', to: 'kg' | 'lbs') {
  if (from === to) return setup;
  const factor = to === 'lbs' ? 2.2046226218 : 1 / 2.2046226218;
  return { ...setup,
    lastWorkingWeight: Number((setup.lastWorkingWeight * factor).toFixed(2)),
    personalRecordWeight: Number((setup.personalRecordWeight * factor).toFixed(2)) };
}

function weekStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return date;
}

function refreshProgress() {
  const thisWeek = weekStart(new Date());
  const weeks = new Map<number, Record<PartnerId, Set<string>>>();
  for (const workout of state.completedWorkouts) {
    const date = new Date(workout.finishedAt);
    const week = weekStart(date).getTime();
    if (!Number.isFinite(week)) continue;
    const progress = weeks.get(week) || { markus: new Set<string>(), partner: new Set<string>() };
    for (const user of workout.participants) progress[user]?.add(date.toDateString());
    weeks.set(week, progress);
  }
  const current = weeks.get(thisWeek.getTime());
  const qualifies = (date: Date) => {
    const week = weeks.get(date.getTime());
    return Boolean(week && week.markus.size >= state.profiles.markus.weeklyGoal && week.partner.size >= state.profiles.partner.weeklyGoal);
  };
  const cursor = new Date(thisWeek);
  if (!qualifies(cursor)) cursor.setDate(cursor.getDate() - 7);
  let count = 0;
  while (qualifies(cursor)) { count++; cursor.setDate(cursor.getDate() - 7); }
  let best = 0;
  for (const week of weeks.keys()) {
    const candidate = new Date(week);
    let length = 0;
    while (qualifies(candidate)) { length++; candidate.setDate(candidate.getDate() - 7); }
    best = Math.max(best, length);
  }
  state = { ...state, profiles: {
    markus: { ...state.profiles.markus, completedThisWeek: current?.markus.size || 0 },
    partner: { ...state.profiles.partner, completedThisWeek: current?.partner.size || 0 },
  }, streak: { ...state.streak, currentStreakWeeks: count, bestStreakWeeks: best } };
}

function recordCompletedWorkout(payload: {
  workoutId?: string;
  finishedAt?: string;
  participants?: PartnerId[];
  startedAt?: string;
  title?: string;
  durationSeconds?: number;
  machineIds?: string[];
  exerciseTimings?: Record<string, ExerciseTiming>;
}) {
  if (!payload.workoutId || !payload.finishedAt || !payload.participants?.length) return; // nobody logged a set: nothing to keep
  if (state.workoutEdits[payload.workoutId] === null) return;
  const existing = state.completedWorkouts.find((workout) => workout.id === payload.workoutId);
  if (existing) return;
  const start = /^w_\d{13}$/.test(payload.workoutId) ? Number(payload.workoutId.slice(2)) : NaN;
  const startedAt = payload.startedAt || (Number.isFinite(start) ? new Date(start).toISOString() : undefined);
  const durationSeconds = startedAt ? Math.max(0, Math.floor((Date.parse(payload.finishedAt) - Date.parse(startedAt)) / 1000)) : payload.durationSeconds;
  const isCurrent = payload.workoutId === `w_${state.sessionStartedAt}`;
  const workoutSets = state.sets.filter((s) => s.workoutId === payload.workoutId);
  const derivedMachineIds = [...new Set([...(payload.machineIds ?? []), ...workoutSets.map((s) => s.machineId)])];
  const timingsToStore = payload.exerciseTimings ?? (isCurrent ? state.sessionExerciseTimings : undefined);
  const hasTimings = timingsToStore && Object.keys(timingsToStore).length > 0;
  state = { ...state, completedWorkouts: [...state.completedWorkouts, {
    id: payload.workoutId, finishedAt: payload.finishedAt, participants: payload.participants,
    startedAt, durationSeconds, title: state.workoutEdits[payload.workoutId] ?? payload.title ?? (isCurrent ? state.sessionTitle : undefined),
    ...(derivedMachineIds.length ? { machineIds: derivedMachineIds } : {}),
    ...(hasTimings ? { exerciseTimings: timingsToStore } : {}),
  }] };
  refreshProgress();
}

function recalculateSetRecords(sets: WorkoutSetLog[], affected: WorkoutSetLog[]) {
  let machines = state.machines;
  const pairs = new Map(affected.map((set) => [`${set.machineId}:${set.userId}`, set]));
  for (const old of pairs.values()) {
    let best = 0;
    const chronological = sets.filter((set) => set.machineId === old.machineId && set.userId === old.userId).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    const unit = state.profiles[old.userId].unit;
    const flags = new Map<string, boolean>();
    for (const set of chronological) {
      const weight = set.weight * (set.unit === unit ? 1 : unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218);
      flags.set(set.id, weight > best && weight > 0);
      best = Math.max(best, weight);
    }
    sets = sets.map((set) => flags.has(set.id) ? { ...set, isPR: flags.get(set.id)! } : set);
    machines = machines.map((machine) => {
      if (machine.id !== old.machineId) return machine;
      const logs = sets.filter((set) => set.machineId === old.machineId && set.userId === old.userId).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
      const unit = state.profiles[old.userId].unit;
      const weight = (set: WorkoutSetLog) => Number((set.weight * (set.unit === unit ? 1 : unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218)).toFixed(2));
      const setup = machine.partnerSetups[old.userId];
      return { ...machine, partnerSetups: { ...machine.partnerSetups, [old.userId]: { ...setup,
        lastWorkingWeight: logs.length ? weight(logs[0]) : 0, lastReps: logs[0]?.reps || 0,
        personalRecordWeight: Math.max(0, ...logs.map(weight)) } } };
    });
  }
  return { sets, machines };
}

function applySetChange(setId: string, replacement: WorkoutSetLog | null) {
  const old = state.sets.find((set) => set.id === setId);
  if (!old) return;
  const sets = state.sets.flatMap((set) => set.id === setId ? (replacement ? [{ ...set, weight: replacement.weight, reps: replacement.reps }] : []) : [set]);
  const updatedWorkouts = replacement === null && state.completedWorkouts.some((w) => w.id === old.workoutId)
    ? state.completedWorkouts.map((w) => {
        if (w.id !== old.workoutId) return w;
        const remainingForWorkout = sets.filter((s) => s.workoutId === w.id);
        const participants = remainingForWorkout.length
          ? ([...new Set(remainingForWorkout.map((s) => s.userId))] as PartnerId[])
          : w.participants;
        return { ...w, participants };
      })
    : state.completedWorkouts;
  updateState({ ...recalculateSetRecords(sets, [old]), completedWorkouts: updatedWorkouts });
}

function applyWorkoutChange(
  workoutId: string,
  change: string | null | { title?: string | null; machineIds?: string[]; participants?: PartnerId[] },
) {
  // Keep deletions so delayed completions and set uploads cannot restore a removed session.
  if (state.workoutEdits[workoutId] === null) return;
  const title = typeof change === 'object' && change !== null ? change.title : change;
  const machineIds = typeof change === 'object' && change !== null ? change.machineIds : undefined;
  const participants = typeof change === 'object' && change !== null ? change.participants : undefined;

  if (title === null) {
    const removed = state.sets.filter((set) => set.workoutId === workoutId);
    updateState({
      workoutEdits: { ...state.workoutEdits, [workoutId]: null },
      completedWorkouts: state.completedWorkouts.filter((workout) => workout.id !== workoutId),
      ...recalculateSetRecords(state.sets.filter((set) => set.workoutId !== workoutId), removed),
    });
    return;
  }

  updateState({
    ...(title !== undefined ? { workoutEdits: { ...state.workoutEdits, [workoutId]: title } } : {}),
    completedWorkouts: state.completedWorkouts.map((workout) => {
      if (workout.id !== workoutId) return workout;
      return {
        ...workout,
        ...(title !== undefined ? { title } : {}),
        ...(machineIds !== undefined ? { machineIds } : {}),
        ...(participants !== undefined ? { participants } : {}),
      };
    }),
  });
}

function broadcastOwnStatus(extra: Partial<PartnerLiveStatus> = {}) {
  const machine = state.machines.find((m) => m.id === state.selectedMachineId);
  void syncEngine.broadcast({ type: 'PARTNER_STATUS', payload: { status: {
    userId: state.activeUser, isOnline: true, routineTitle: state.sessionTitle,
    currentMachineId: machine?.id || null, currentMachineName: machine?.name || machine?.nameZh || null,
    currentSetNumber: state.sets.filter((set) => set.workoutId === `w_${state.sessionStartedAt}` && set.machineId === machine?.id && set.userId === state.activeUser).length,
    restDurationSeconds: state.restDurationSeconds,
    restSecondsRemaining: state.restSeconds, restEndsAt: state.restEndsAt || undefined,
    isSessionActive: state.isSessionActive, sessionStartedAt: state.sessionStartedAt,
    sessionMachineIds: state.sessionMachineIds,
    exerciseTimings: state.sessionExerciseTimings,
    lastUpdated: new Date().toISOString(),
    ...extra,
  } } });
}

function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success') {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics safe fallback
  }
}

const workoutAlarmAt = () => state.isSessionActive && state.sessionStartedAt && state.sessionAlarmMinutes > 0
  ? state.sessionStartedAt + state.sessionAlarmMinutes * 60000 : null;

// One reconciler instead of a call per action: every path that starts, ends or edits a timer lands here.
let scheduledAlarmAt: number | null = null;
let scheduledRestAt: number | null = null;
function syncScheduledAlerts() {
  const zh = state.language === 'zh-TW';
  const alarmAt = workoutAlarmAt();
  if (alarmAt !== scheduledAlarmAt) {
    scheduledAlarmAt = alarmAt;
    const minutes = state.sessionAlarmMinutes;
    void scheduleAlert('workout-alarm', alarmAt, zh ? `已訓練 ${minutes} 分鐘` : `${minutes} minutes are up`, zh ? '該準備離開健身房了。' : 'Time to wrap up your gym session.');
  }
  if (state.restEndsAt !== scheduledRestAt) {
    scheduledRestAt = state.restEndsAt;
    void scheduleAlert('rest-end', state.restEndsAt, zh ? '休息結束' : 'Rest is over', zh ? '開始下一組吧。' : 'Time for your next set.');
  }
}

// Joining or starting a workout is the moment the prompt makes sense; retry the schedule once it is answered.
function askForAlerts() {
  void enableSetNotifications().then(() => { scheduledAlarmAt = scheduledRestAt = null; syncScheduledAlerts(); }).catch(() => {});
}

function notify() {
  syncScheduledAlerts();
  scheduleReactionExpiry();
  for (const listener of listeners) {
    listener();
  }
}

let reactionTimeout: ReturnType<typeof setTimeout> | null = null;
let scheduledReactionId: string | null = null;
function scheduleReactionExpiry() {
  const reaction = state.latestReaction;
  if (!reaction || reaction.id === scheduledReactionId) return;
  if (reactionTimeout) clearTimeout(reactionTimeout);
  scheduledReactionId = reaction.id;
  reactionTimeout = setTimeout(() => {
    if (state.latestReaction?.id === reaction.id) { state = { ...state, latestReaction: null }; notify(); }
  }, 4500);
  (reactionTimeout as any).unref?.();
}

function updateState(partial: Partial<StoreState>) {
  state = { ...state, ...partial };
  refreshProgress();
  notify();
  persistState();
}

async function persistState() {
  try {
    const toSave = {
      activeUser: state.activeUser,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      completedWorkouts: state.completedWorkouts,
      workoutEdits: state.workoutEdits,
      quickRoutines: state.quickRoutines,
      isSessionActive: state.isSessionActive,
      sessionStartedAt: state.sessionStartedAt,
      sessionTitle: state.sessionTitle,
      sessionMachineIds: state.sessionMachineIds,
      sessionExerciseTimings: state.sessionExerciseTimings,
      currentSetStartedAt: state.currentSetStartedAt,
      selectedMachineId: state.selectedMachineId,
      restEndsAt: state.restEndsAt,
      restDurationSeconds: state.restDurationSeconds,
      language: state.language,
      machines: state.machines,
      sets: state.sets,
      streak: state.streak,
      profiles: state.profiles,
      sessionAlarmMinutes: state.sessionAlarmMinutes,
      activeSplit: state.activeSplit,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn('[Store] Failed to persist state:', err);
  }
}

async function loadPersistedState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (!process.env.NODE_TEST_CONTEXT) {
        state = { ...state, machines: [], sets: [], sessionMachineIds: [], selectedMachineId: null,
          isOnboardingOpen: true, profiles: {
            markus: { ...state.profiles.markus, completedThisWeek: 0 },
            partner: { ...state.profiles.partner, completedThisWeek: 0 },
          }, streak: { ...state.streak, currentStreakWeeks: 0, bestStreakWeeks: 0, isPaired: false } };
        notify();
      }
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const migratedPartnerProfile = parsed.profiles?.partner
        ? {
            ...INITIAL_PROFILES.partner,
            ...parsed.profiles.partner,
            name:
              parsed.profiles.partner.name === 'Elena'
                ? 'Abby'
                : parsed.profiles.partner.name || INITIAL_PROFILES.partner.name,
            avatarEmoji:
              parsed.profiles.partner.name === 'Elena' ||
              parsed.profiles.partner.avatarEmoji === 'E'
                ? 'A'
                : parsed.profiles.partner.avatarEmoji || INITIAL_PROFILES.partner.avatarEmoji,
            accentColor: '#D4D4D8',
          }
        : state.profiles.partner;

      state = {
        ...state,
        activeUser: parsed.activeUser === 'partner' ? 'partner' : parsed.activeUser === 'markus' ? 'markus' : state.activeUser,
        hasCompletedOnboarding: true,
        completedWorkouts: Array.isArray(parsed.completedWorkouts) ? parsed.completedWorkouts : [],
        workoutEdits: parsed.workoutEdits && typeof parsed.workoutEdits === 'object'
          ? Object.fromEntries(Object.entries(parsed.workoutEdits).filter((entry): entry is [string, string | null] => entry[1] === null || typeof entry[1] === 'string')) : {},
        quickRoutines: loadQuickRoutines(parsed.quickRoutines),
        isSessionActive: Boolean(parsed.isSessionActive),
        sessionStartedAt: typeof parsed.sessionStartedAt === 'number' ? parsed.sessionStartedAt : null,
        sessionTitle: typeof parsed.sessionTitle === 'string' ? parsed.sessionTitle : state.sessionTitle,
        sessionMachineIds: Array.isArray(parsed.sessionMachineIds) ? parsed.sessionMachineIds : state.sessionMachineIds,
        sessionExerciseTimings: parsed.sessionExerciseTimings && typeof parsed.sessionExerciseTimings === 'object' ? parsed.sessionExerciseTimings : {},
        currentSetStartedAt: typeof parsed.currentSetStartedAt === 'number' ? parsed.currentSetStartedAt : null,
        selectedMachineId: parsed.selectedMachineId ?? state.selectedMachineId,
        restEndsAt: typeof parsed.restEndsAt === 'number' ? parsed.restEndsAt : null,
        restDurationSeconds: typeof parsed.restDurationSeconds === 'number' ? parsed.restDurationSeconds : 90,
        language:
          parsed.language === 'zh-TW' || parsed.language === 'en'
            ? parsed.language
            : state.language,
        machines: Array.isArray(parsed.machines)
          ? parsed.machines.map(normalizeMachine)
          : state.machines,
        sets: Array.isArray(parsed.sets) ? parsed.sets : state.sets,
        streak: parsed.streak || state.streak,
        profiles: parsed.profiles
          ? {
              markus: { ...INITIAL_PROFILES.markus, ...parsed.profiles.markus, accentColor: '#FAFAFA' },
              partner: migratedPartnerProfile,
            }
          : state.profiles,
        sessionAlarmMinutes: typeof parsed.sessionAlarmMinutes === 'number' ? parsed.sessionAlarmMinutes : state.sessionAlarmMinutes,
        activeSplit: parsed.activeSplit || state.activeSplit,
      };
      refreshProgress();
      tickTimers();
      syncEngine.setCurrentUser(state.activeUser);
      notify();
    }
  } catch (err) {
    console.warn('[Store] Failed to load persisted state:', err);
  }
}

loadPersistedState();

let firedAlarmAt: number | null = null;
function tickTimers() {
  let changed = false;

  if (state.isSessionActive) {
    const nextElapsed =
      typeof state.sessionStartedAt === 'number' && state.sessionStartedAt > 0
        ? Math.max(0, Math.floor((Date.now() - state.sessionStartedAt) / 1000))
        : state.sessionElapsedSeconds + 1;
    if (nextElapsed !== state.sessionElapsedSeconds) {
      state = { ...state, sessionElapsedSeconds: nextElapsed };
      changed = true;
    }
  }

  const alarmAt = workoutAlarmAt();
  if (alarmAt && alarmAt !== firedAlarmAt && Date.now() >= alarmAt) {
    firedAlarmAt = alarmAt;
    // Coming back to the app long after the system alert fired should not ring again.
    if (Date.now() - alarmAt < 5000) {
      triggerHaptic('heavy');
      const minutes = state.sessionAlarmMinutes;
      state = { ...state, latestReaction: {
        id: `alarm_${alarmAt}`, fromUser: state.activeUser, toUser: state.activeUser, emoji: '⏰',
        message: state.language === 'zh-TW' ? `已訓練 ${minutes} 分鐘，該準備離開了。` : `${minutes} minutes are up. Time to wrap up.`,
        createdAt: new Date().toISOString(),
      } };
      changed = true;
    }
  }

  if (state.restSeconds > 0 || state.restEndsAt) {
    const nextRest = state.restEndsAt ? Math.max(0, Math.ceil((state.restEndsAt - Date.now()) / 1000)) : 0;
    if (nextRest === 0) {
      triggerHaptic('success');
    }
    state = {
      ...state,
      restSeconds: nextRest,
      restEndsAt: nextRest > 0 ? state.restEndsAt : null,
      ...(nextRest === 0 ? { currentSetStartedAt: Date.now() } : {}),
    };
    changed = true;
  }

  if (state.partnerStatus.restSecondsRemaining > 0) {
    state = {
      ...state,
      partnerStatus: {
        ...state.partnerStatus,
        restSecondsRemaining: Math.max(0, Math.ceil(((state.partnerStatus.restEndsAt || 0) - Date.now()) / 1000)),
      },
    };
    changed = true;
  }

  if (changed) {
    notify();
  }
}
setInterval(tickTimers, 100);
AppState?.addEventListener?.('change', (status) => { if (status === 'active') { refreshProgress(); tickTimers(); broadcastOwnStatus(); scheduledAlarmAt = scheduledRestAt = null; notify(); } });

syncEngine.cloud?.subscribe(() => {
  const cloud = syncEngine.cloud!.getSnapshot();
  if (cloud.deviceUser && !state.streak.isPaired) {
    updateState({ activeUser: cloud.deviceUser, partnerStatus: { ...state.partnerStatus, userId: cloud.deviceUser === 'markus' ? 'partner' : 'markus', restSecondsRemaining: 0, restEndsAt: undefined }, streak: { ...state.streak, isPaired: true, coupleInviteCode: cloud.inviteCode || '' } });
  }
});

syncEngine.onConnectionChange((isPartnerOnline, status) => {
  const partnerJustJoined = isPartnerOnline && !state.syncConnected;
  const cloud = status?.isCloudConnected ?? false;
  const cloudJustConnected = cloud && !state.cloudConnected;
  const partner = isPartnerOnline;
  if (
    state.syncConnected !== partner ||
    state.cloudConnected !== cloud ||
    state.partnerStatus.isOnline !== partner
  ) {
    state = {
      ...state,
      syncConnected: partner,
      cloudConnected: cloud,
      partnerStatus: {
        ...state.partnerStatus,
        isOnline: partner,
      },
    };
    notify();
    if (partnerJustJoined || cloudJustConnected) broadcastOwnStatus();
  }
});

syncEngine.subscribe((event: SyncEvent, historical = false) => {
  switch (event.type) {
    case 'SESSION_CHANGED': {
      applyWorkoutChange(event.payload.workoutId, {
        ...(event.payload.title !== undefined ? { title: event.payload.title === null ? null : event.payload.title.trim() } : {}),
        ...(event.payload.machineIds !== undefined ? { machineIds: event.payload.machineIds } : {}),
        ...(event.payload.participants !== undefined ? { participants: event.payload.participants } : {}),
      });
      break;
    }
    case 'MACHINE_DELETED': {
      const id = event.payload.machineId;
      updateState({ machines: state.machines.filter((m) => m.id !== id), sessionMachineIds: state.sessionMachineIds.filter((item) => item !== id), selectedMachineId: state.selectedMachineId === id ? null : state.selectedMachineId });
      break;
    }
    case 'SET_CHANGED': {
      applySetChange(event.payload.setId, event.payload.set);
      break;
    }
    case 'SET_LOGGED': {
      const incomingSet = event.payload.set;
      if (state.workoutEdits[incomingSet.workoutId] === null) return;
      if (state.sets.some((s) => s.id === incomingSet.id)) return;

      const nextSets = [incomingSet, ...state.sets];

      const nextMachines = state.machines.map((m) => {
        if (m.id === incomingSet.machineId) {
          const currentSetup = m.partnerSetups?.[incomingSet.userId];
          const unit = state.profiles[incomingSet.userId].unit;
          const weight = Number((incomingSet.weight * (incomingSet.unit === unit ? 1 : unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218)).toFixed(2));
          const newerSetExists = state.sets.some((set) => set.machineId === incomingSet.machineId && set.userId === incomingSet.userId && set.loggedAt > incomingSet.loggedAt);
          const isPR = weight > (currentSetup?.personalRecordWeight || 0);
          const updatedSetup = buildSynchronizedSetup(
            {
              ...currentSetup,
              lastWorkingWeight: newerSetExists ? currentSetup?.lastWorkingWeight : weight,
              lastReps: newerSetExists ? currentSetup?.lastReps : incomingSet.reps,
              personalRecordWeight: isPR
                ? weight
                : currentSetup?.personalRecordWeight || weight,
            },
            m.adjustmentLabels
          );
          return {
            ...m,
            partnerSetups: {
              ...(m.partnerSetups || {}),
              [incomingSet.userId]: updatedSetup,
            },
          };
        }
        return m;
      });

      const isFromPartner = incomingSet.userId !== state.activeUser;
      const completedWorkout = state.completedWorkouts.find((w) => w.id === incomingSet.workoutId);
      const nextPartnerStatus: PartnerLiveStatus = isFromPartner && !historical && !completedWorkout
        ? {
            ...state.partnerStatus,
            userId: incomingSet.userId,
            isOnline: true,
            currentMachineId: incomingSet.machineId,
            currentMachineName: incomingSet.machineName,
            currentSetNumber: incomingSet.setNumber,
            lastSetWeight: incomingSet.weight,
            lastSetReps: incomingSet.reps,
            restSecondsRemaining: Math.max(0, Math.ceil((Date.parse(incomingSet.loggedAt) + 90000 - Date.now()) / 1000)),
            restEndsAt: Date.parse(incomingSet.loggedAt) + 90000,
            restDurationSeconds: 90,
            lastUpdated: new Date().toISOString(),
          }
        : state.partnerStatus;

      const nextProfiles = state.profiles;

      let latestReaction = state.latestReaction;
      if (isFromPartner && !historical && !completedWorkout) {
        const partnerName = state.profiles[incomingSet.userId]?.name || 'Partner';
        latestReaction = {
          id: `set_alert_${incomingSet.id}`,
          fromUser: incomingSet.userId,
          toUser: state.activeUser,
          emoji: incomingSet.isPR ? '👑' : '💪',
          message: state.language === 'zh-TW'
            ? `${partnerName} 完成第 ${incomingSet.setNumber} 組：${incomingSet.machineName} · ${incomingSet.weight} ${incomingSet.unit} × ${incomingSet.reps}${incomingSet.isPR ? ' · 新紀錄！' : ''}`
            : `${partnerName} finished set ${incomingSet.setNumber}: ${incomingSet.machineName} · ${incomingSet.weight} ${incomingSet.unit} × ${incomingSet.reps}${incomingSet.isPR ? ' · New PR!' : ''}`,
          createdAt: new Date().toISOString(),
        };
        triggerHaptic('success');
        void notifyCompletedSet(incomingSet, partnerName, state.language);
      }

      const nextCompletedWorkouts = completedWorkout
        ? state.completedWorkouts.map((w) => {
            if (w.id !== completedWorkout.id) return w;
            const machineIds = [...new Set([...(w.machineIds ?? []), incomingSet.machineId])];
            const participants = [...new Set([...w.participants, incomingSet.userId])] as PartnerId[];
            return { ...w, machineIds, participants };
          })
        : state.completedWorkouts;

      state = {
        ...state,
        sets: nextSets,
        machines: nextMachines,
        completedWorkouts: nextCompletedWorkouts,
        partnerStatus: nextPartnerStatus,
        profiles: nextProfiles,
        latestReaction,
      };
      if (completedWorkout) refreshProgress();
      notify();
      persistState();
      break;
    }

    case 'HYPE_REACTION': {
      const reaction = event.payload.reaction;
      if (historical || reaction.toUser !== state.activeUser || state.latestReaction?.id === reaction.id) return;
      state = {
        ...state,
        latestReaction: reaction,
      };
      triggerHaptic('medium');
      void notifyPartnerEvent(`cheer-${reaction.id}`, state.profiles[reaction.fromUser]?.name || 'Partner', `${reaction.emoji} ${reaction.message}`, '/partner-workout');
      notify();
      break;
    }

    case 'PARTNER_STATUS': {
      const incomingStatus = event.payload.status;
      if (incomingStatus.userId === state.activeUser) return;
      if (incomingStatus.sourceInstanceId && incomingStatus.sourceInstanceId === state.partnerStatus.sourceInstanceId &&
        typeof incomingStatus.sequence === 'number' && typeof state.partnerStatus.sequence === 'number' &&
        incomingStatus.sequence <= state.partnerStatus.sequence) return;
      const shouldSyncTimer = Boolean(incomingStatus.isSessionActive) && typeof incomingStatus.sessionStartedAt === 'number' && !state.isSessionActive
        && state.workoutEdits[`w_${incomingStatus.sessionStartedAt}`] !== null
        && !state.completedWorkouts.some((workout) => workout.id === `w_${incomingStatus.sessionStartedAt}`);
      state = {
        ...state,
        ...(shouldSyncTimer ? {
          isSessionActive: true, sessionStartedAt: incomingStatus.sessionStartedAt!, sessionTitle: '', sessionMachineIds: [],
          sessionElapsedSeconds: Math.max(0, Math.floor((Date.now() - incomingStatus.sessionStartedAt!) / 1000)),
        } : {}),
        partnerStatus: {
          ...state.partnerStatus,
          ...incomingStatus,
          restEndsAt: incomingStatus.restEndsAt || Date.parse(incomingStatus.lastUpdated) + incomingStatus.restSecondsRemaining * 1000,
        },
      };
      notify();
      break;
    }

    case 'SESSION_STARTED': {
      const { startedAt, startedBy, startedByName, routineTitle } = event.payload;
      if (state.workoutEdits[`w_${startedAt}`] === null) break;
      if (state.completedWorkouts.some((workout) => workout.id === `w_${startedAt}`)) break;
      if (historical && state.isSessionActive && state.sessionStartedAt && startedAt < state.sessionStartedAt) break;
      const wasActive = state.isSessionActive && !!state.sessionStartedAt;
      const effectiveStart = wasActive ? Math.min(state.sessionStartedAt!, startedAt) : startedAt;
      const fromPartner = startedBy !== state.activeUser;
      const isNew = fromPartner && !historical && state.sessionStartedAt !== startedAt;
      const message = state.language === 'zh-TW'
        ? `${startedByName} 開始訓練了${routineTitle ? `（${routineTitle}）` : ''}`
        : `${startedByName} started a workout${routineTitle ? ` (${routineTitle})` : ''}`;
      state = {
        ...state,
        isSessionActive: true,
        sessionStartedAt: effectiveStart,
        sessionElapsedSeconds: Math.max(0, Math.floor((Date.now() - effectiveStart) / 1000)),
        // The clock is shared; the exercises are each person's own.
        ...(fromPartner && !wasActive ? { sessionTitle: '', sessionMachineIds: [], sessionExerciseTimings: {}, currentSetStartedAt: Date.now() } : {}),
        ...(fromPartner ? { partnerStatus: {
          ...state.partnerStatus,
          isOnline: true,
          routineTitle: routineTitle || state.partnerStatus.routineTitle,
          isSessionActive: true,
          sessionStartedAt: effectiveStart,
          ...(isNew ? { sessionMachineIds: [], currentMachineId: null, currentMachineName: null, currentSetNumber: 0, restSecondsRemaining: 0, restEndsAt: undefined } : {}),
          lastUpdated: new Date().toISOString(),
        } } : {}),
        latestReaction: isNew ? {
          id: `session_start_${startedAt}`, fromUser: startedBy, toUser: state.activeUser, emoji: '🔥',
          message, createdAt: new Date().toISOString(),
        } : state.latestReaction,
      };
      notify();
      if (isNew) {
        triggerHaptic('medium');
        void notifyPartnerEvent(`session-start-${startedAt}`, startedByName, message, '/partner-workout');
        askForAlerts();
        broadcastOwnStatus(); // so the partner sees this phone joined
      }
      break;
    }

    case 'SESSION_FINISHED': {
      if (event.payload.workoutId && state.workoutEdits[event.payload.workoutId] === null) break;
      recordCompletedWorkout(event.payload);
      const { finishedBy, finishedByName, workoutId } = event.payload;
      const fromPartner = finishedBy !== state.activeUser;
      if (fromPartner && (!workoutId || workoutId === `w_${state.partnerStatus.sessionStartedAt}`)) {
        state = { ...state, partnerStatus: { ...state.partnerStatus, isSessionActive: false, sessionStartedAt: null, restSecondsRemaining: 0, restEndsAt: undefined, lastUpdated: new Date().toISOString() } };
      }
      if (fromPartner && !historical) {
        const message = state.language === 'zh-TW' ? `${finishedByName} 結束了這次訓練` : `${finishedByName} finished the workout`;
        state = { ...state, latestReaction: { id: `session_end_${workoutId || Date.now()}`, fromUser: finishedBy, toUser: state.activeUser, emoji: '🔥', message, createdAt: new Date().toISOString() } };
        void notifyPartnerEvent(`session-end-${workoutId || Date.now()}`, finishedByName, message, workoutId ? `/history/${workoutId}` : '/history');
      }
      if (workoutId && workoutId !== `w_${state.sessionStartedAt}`) { notify(); void persistState(); break; }
      state = {
        ...state,
        isSessionActive: false,
        sessionStartedAt: null,
        sessionElapsedSeconds: 0,
        sessionMachineIds: [],
        sessionExerciseTimings: {},
        currentSetStartedAt: null,
        restSeconds: 0,
        restEndsAt: null,
      };
      notify();
      void persistState();
      break;
    }

    case 'PROFILES_UPDATED': {
      const profiles = event.payload.profiles;
      const machines = state.machines.map((machine) => ({ ...machine, partnerSetups: {
        markus: convertSetupUnit(machine.partnerSetups.markus, state.profiles.markus.unit, profiles.markus.unit),
        partner: convertSetupUnit(machine.partnerSetups.partner, state.profiles.partner.unit, profiles.partner.unit),
      } }));
      state = { ...state, profiles, machines };
      refreshProgress();
      notify();
      void persistState();
      break;
    }

    case 'MACHINE_ADDED': {
      const incomingMachine = normalizeMachine(event.payload.machine);
      for (const user of ['markus', 'partner'] as PartnerId[]) {
        const sets = state.sets.filter((set) => set.machineId === incomingMachine.id && set.userId === user)
          .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
        const unit = state.profiles[user].unit;
        const weight = (set: WorkoutSetLog) => Number((set.weight * (set.unit === unit ? 1 : unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218)).toFixed(2));
        if (sets.length) incomingMachine.partnerSetups[user] = {
          ...incomingMachine.partnerSetups[user],
          lastWorkingWeight: weight(sets[0]), lastReps: sets[0].reps,
          personalRecordWeight: Math.max(incomingMachine.partnerSetups[user].personalRecordWeight, ...sets.map(weight)),
        };
      }
      const exists = state.machines.some((m) => m.id === incomingMachine.id);
      const nextMachines = exists
        ? state.machines.map((m) => (m.id === incomingMachine.id ? incomingMachine : m))
        : [incomingMachine, ...state.machines];
      const nextSets = exists
        ? state.sets.map((s) =>
            s.machineId === incomingMachine.id
              ? { ...s, machineName: incomingMachine.name || incomingMachine.nameZh || s.machineName }
              : s
          )
        : state.sets;
      state = {
        ...state,
        machines: nextMachines,
        sets: nextSets,
      };
      notify();
      persistState();
      break;
    }

    case 'SETUP_UPDATED': {
      const { machineId, partnerId, seatPosition, pinOrPadNote, adjustments } = event.payload;
      const nextMachines = state.machines.map((m) => {
        if (m.id === machineId) {
          const existingSetup = m.partnerSetups?.[partnerId];
          const existingAdjustments = Array.isArray(existingSetup?.adjustments)
            ? existingSetup.adjustments
            : [];
          const labels = m.adjustmentLabels || ['Seat Height', 'Pad / Lever'];
          const nextAdjustments: MachineAdjustment[] =
            Array.isArray(adjustments)
              ? adjustments
              : [
                  {
                    id: existingAdjustments[0]?.id || 'adj-1',
                    label: existingAdjustments[0]?.label || labels[0],
                    value: seatPosition,
                  },
                  {
                    id: existingAdjustments[1]?.id || 'adj-2',
                    label: existingAdjustments[1]?.label || labels[1],
                    value: pinOrPadNote,
                  },
                  ...existingAdjustments.slice(2),
                ];

          return {
            ...m,
            partnerSetups: {
              ...m.partnerSetups,
              [partnerId]: {
                ...existingSetup,
                lastWorkingWeight: existingSetup?.lastWorkingWeight ?? 0,
                lastReps: existingSetup?.lastReps ?? 0,
                personalRecordWeight: existingSetup?.personalRecordWeight ?? 0,
                adjustments: nextAdjustments,
                seatPosition,
                pinOrPadNote,
              },
            },
          };
        }
        return m;
      });
      state = { ...state, machines: nextMachines };
      notify();
      persistState();
      break;
    }
  }
  void persistState();
});

export function useGymCrushStore() {
  const currentState = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => state,
    () => state
  );

  const selectedMachine =
    currentState.machines.find((m) => m.id === currentState.selectedMachineId) ||
    currentState.machines[0] ||
    null;

  const setLanguage = (lang: Language) => {
    triggerHaptic('light');
    updateState({ language: lang });
  };

  const toggleLanguage = () => {
    triggerHaptic('light');
    updateState({
      language: state.language === 'en' ? 'zh-TW' : 'en',
    });
  };

  const startSession = (machineIds?: string[], title?: string) => {
    triggerHaptic('medium');
    const validIds =
      (Array.isArray(machineIds) ? machineIds : [])
        .filter((id) => state.machines.some((m) => m.id === id));
    const firstMachineId =
      validIds[0] || null;
    const nextTitle =
      title || (state.language === 'zh-TW' ? '訓練進行中' : 'Workout Session');

    const wasActive = state.isSessionActive && !!state.sessionStartedAt;
    const startedAt = wasActive
      ? state.sessionStartedAt!
      : nextSessionStart();
    const elapsedSeconds = wasActive
      ? Math.max(0, Math.floor((Date.now() - state.sessionStartedAt!) / 1000))
      : 0;
    const nowIso = new Date().toISOString();
    const baseTimings = wasActive ? { ...state.sessionExerciseTimings } : {};
    if (firstMachineId && !baseTimings[firstMachineId]) {
      baseTimings[firstMachineId] = { machineId: firstMachineId, startedAt: wasActive ? nowIso : new Date(startedAt).toISOString() };
    }

    updateState({
      isSessionActive: true,
      sessionStartedAt: startedAt,
      sessionElapsedSeconds: elapsedSeconds,
      sessionTitle: nextTitle,
      sessionMachineIds: validIds,
      sessionExerciseTimings: baseTimings,
      currentSetStartedAt: wasActive ? (state.currentSetStartedAt ?? Date.now()) : Date.now(),
      selectedMachineId: firstMachineId,
    });

    void syncEngine.broadcast({
      type: 'SESSION_STARTED',
      payload: {
        startedAt,
        startedBy: state.activeUser,
        startedByName: state.profiles[state.activeUser]?.name || 'Partner',
        routineTitle: nextTitle,
      },
    });

    broadcastOwnStatus();
    askForAlerts();
  };

  const finishSession = () => {
    if (!state.isSessionActive || !state.sessionStartedAt) return;
    const workoutId = `w_${state.sessionStartedAt}`;
    const participants = [...new Set(state.sets.filter((set) => set.workoutId === workoutId).map((set) => set.userId))];
    const finishedAt = new Date().toISOString();
    const startedAt = new Date(state.sessionStartedAt).toISOString();
    const title = state.sessionTitle;
    const machineIds = [...state.sessionMachineIds];
    const exerciseTimings = { ...state.sessionExerciseTimings };
    recordCompletedWorkout({ workoutId, finishedAt, participants, startedAt, title, machineIds, exerciseTimings });
    triggerHaptic('success');
    const durationSeconds = Math.max(0, Math.floor((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000));
    const finishedBy = state.activeUser;
    const finishedByName = state.profiles[state.activeUser]?.name || 'Partner';

    updateState({
      isSessionActive: false,
      sessionStartedAt: null,
      sessionElapsedSeconds: 0,
      sessionMachineIds: [],
      sessionExerciseTimings: {},
      currentSetStartedAt: null,
      restSeconds: 0,
      restEndsAt: null,
      partnerStatus: {
        ...state.partnerStatus,
        isSessionActive: false,
        sessionStartedAt: null,
        restSecondsRemaining: 0,
      },
    });

    void syncEngine.broadcast({
      type: 'SESSION_FINISHED',
      payload: {
        finishedBy,
        finishedByName,
        durationSeconds,
        startedAt,
        title,
        workoutId,
        finishedAt,
        participants,
        ...(machineIds.length ? { machineIds } : {}),
        ...(Object.keys(exerciseTimings).length ? { exerciseTimings } : {}),
      },
    });
  };

  const addMachineToSession = (machineId: string) => {
    triggerHaptic('light');
    const exists = state.sessionMachineIds.includes(machineId);
    const nextSessionIds = exists
      ? state.sessionMachineIds
      : [...state.sessionMachineIds, machineId];
    const startedAt = state.sessionStartedAt ?? nextSessionStart();
    const workoutId = `w_${startedAt}`;
    const hasSets = state.sets.some((s) => s.workoutId === workoutId && s.machineId === machineId);
    const nowMs = Date.now();
    const nextTimings = !state.sessionExerciseTimings[machineId] || !hasSets
      ? { ...state.sessionExerciseTimings, [machineId]: { machineId, startedAt: new Date(nowMs).toISOString() } }
      : state.sessionExerciseTimings;

    updateState({
      isSessionActive: true,
      sessionStartedAt: startedAt,
      sessionMachineIds: nextSessionIds,
      sessionExerciseTimings: nextTimings,
      currentSetStartedAt: nowMs,
      selectedMachineId: machineId,
    });

    broadcastOwnStatus();
  };

  const removeMachineFromSession = (machineId: string) => {
    triggerHaptic('light');
    const nextSessionIds = state.sessionMachineIds.filter((id) => id !== machineId);
    const nextSelected =
      state.selectedMachineId === machineId
        ? nextSessionIds[0] || state.machines[0]?.id || null
        : state.selectedMachineId;

    updateState({
      sessionMachineIds: nextSessionIds,
      selectedMachineId: nextSelected,
    });
    broadcastOwnStatus();
  };

  const switchActiveUser = (newUser: PartnerId) => {
    if (newUser === state.activeUser) return;
    triggerHaptic('light');
    // Device presence remains assigned to the paired phone when sharing sets.
    if (!syncEngine.cloud) syncEngine.setCurrentUser(newUser);
    const otherUser: PartnerId = newUser === 'markus' ? 'partner' : 'markus';
    updateState({
      activeUser: newUser,
      restSeconds: state.partnerStatus.restSecondsRemaining,
      restEndsAt: state.partnerStatus.restEndsAt || null,
      restDurationSeconds: state.partnerStatus.restDurationSeconds || 90,
      partnerStatus: {
        ...state.partnerStatus,
        userId: otherUser,
        restSecondsRemaining: state.restSeconds,
        restEndsAt: state.restEndsAt || undefined,
        restDurationSeconds: state.restDurationSeconds,
      },
    });
  };

  const setSelectedMachineId = (machineId: string | null) => {
    if (machineId && state.isSessionActive && state.sessionStartedAt && machineId !== state.selectedMachineId) {
      const workoutId = `w_${state.sessionStartedAt}`;
      const hasSetsForMachine = state.sets.some((s) => s.workoutId === workoutId && s.machineId === machineId);
      const nowMs = Date.now();
      const nextTimings = !state.sessionExerciseTimings[machineId] || !hasSetsForMachine
        ? { ...state.sessionExerciseTimings, [machineId]: { machineId, startedAt: new Date(nowMs).toISOString() } }
        : state.sessionExerciseTimings;
      updateState({ selectedMachineId: machineId, sessionExerciseTimings: nextTimings, currentSetStartedAt: nowMs });
      broadcastOwnStatus();
      return;
    }
    updateState({ selectedMachineId: machineId });
    if (machineId) broadcastOwnStatus();
  };

  const setActiveSplit = (split: WorkoutSplitId) => {
    triggerHaptic('light');
    updateState({ activeSplit: split });
  };

  const startRest = (seconds: number) => {
    const duration = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
    updateState({
      restSeconds: duration,
      restDurationSeconds: duration,
      restEndsAt: duration ? Date.now() + duration * 1000 : null,
      ...(duration === 0 ? { currentSetStartedAt: Date.now() } : {}),
    });
    broadcastOwnStatus();
  };
  const cancelRest = () => startRest(0);

  const setSessionAlarm = (minutes: number) => {
    triggerHaptic('light');
    updateState({ sessionAlarmMinutes: Math.min(240, Math.max(0, Math.round(minutes))) });
  };

  const updatePartnerSetup = (
    machineId: string,
    partnerId: PartnerId,
    seatPosition: string,
    pinOrPadNote: string,
    customAdjustments?: MachineAdjustment[]
  ) => {
    triggerHaptic('light');

    let syncedSeat = seatPosition;
    let syncedPin = pinOrPadNote;
    let syncedAdjustments: MachineAdjustment[] | undefined;

    const nextMachines = state.machines.map((m) => {
      if (m.id === machineId) {
        const existingSetup = m.partnerSetups?.[partnerId];
        const labels = m.adjustmentLabels || ['Seat Height', 'Pad / Lever'];
        const existingAdjustments = Array.isArray(existingSetup?.adjustments)
          ? existingSetup.adjustments
          : [];

        let normalizedAdjustments: MachineAdjustment[];

        if (Array.isArray(customAdjustments)) {
          const filtered = customAdjustments
            .filter((item) => item && (item.label?.trim() || item.value?.trim()))
            .map((item, idx) => ({
              id: item.id || `adj-${idx + 1}`,
              label:
                item.label?.trim() ||
                labels[idx] ||
                (idx === 0
                  ? 'Seat Height'
                  : idx === 1
                  ? 'Pad / Lever'
                  : `Setting ${idx + 1}`),
              value: item.value?.trim() || '1',
            }));

          normalizedAdjustments = filtered;

          syncedSeat = normalizedAdjustments[0]?.value || ''; 
          syncedPin = normalizedAdjustments[1]?.value || '';
        } else {
          normalizedAdjustments = [
            {
              id: existingAdjustments[0]?.id || 'adj-1',
              label: existingAdjustments[0]?.label || labels[0] || 'Seat Height',
              value: seatPosition,
            },
            ...(pinOrPadNote !== ''
              ? [
                  {
                    id: existingAdjustments[1]?.id || 'adj-2',
                    label: existingAdjustments[1]?.label || labels[1] || 'Pad / Lever',
                    value: pinOrPadNote,
                  },
                ]
              : []),
            ...existingAdjustments.slice(2),
          ];
        }

        syncedAdjustments = normalizedAdjustments;

        const updatedLabels: [string, string, ...string[]] = [
          normalizedAdjustments[0]?.label || labels[0] || 'Seat Height',
          normalizedAdjustments[1]?.label || labels[1] || 'Pad / Lever',
          ...normalizedAdjustments.slice(2).map((a) => a.label),
        ];

        return {
          ...m,
          adjustmentLabels: updatedLabels,
          partnerSetups: {
            ...(m.partnerSetups || {}),
            [partnerId]: {
              ...existingSetup,
              adjustments: normalizedAdjustments,
              lastWorkingWeight: existingSetup?.lastWorkingWeight || 0,
              lastReps: existingSetup?.lastReps || 0,
              personalRecordWeight: existingSetup?.personalRecordWeight || 0,
              seatPosition: syncedSeat,
              pinOrPadNote: syncedPin,
            },
          },
        };
      }
      return m;
    });

    updateState({ machines: nextMachines });

    void syncEngine.broadcast({
      type: 'SETUP_UPDATED',
      payload: {
        machineId,
        partnerId,
        seatPosition: syncedSeat,
        pinOrPadNote: syncedPin,
        adjustments: syncedAdjustments,
      },
    });
  };

  const updateMachineNames = (machineId: string, name: string, nameZh: string) => {
    const machine = state.machines.find((item) => item.id === machineId);
    if (!machine || (!name.trim() && !nameZh.trim())) return;
    const updated = { ...machine, name: name.trim(), nameZh: nameZh.trim() || undefined };
    updateState({ machines: state.machines.map((item) => item.id === machineId ? updated : item) });
    void syncEngine.broadcast({ type: 'MACHINE_ADDED', payload: { machine: updated } });
  };

  const updateMachine = (
    machineId: string,
    patch: {
      name?: string;
      nameZh?: string;
      muscleGroup?: MuscleGroup;
      workoutSplits?: WorkoutSplitId[];
      locationNote?: string;
      locationNoteZh?: string;
      photoUri?: string;
    },
  ) => {
    const machine = state.machines.find((item) => item.id === machineId);
    if (!machine) return;
    const nextName = patch.name !== undefined ? patch.name.trim() : machine.name;
    const nextNameZh = patch.nameZh !== undefined ? (patch.nameZh.trim() || undefined) : machine.nameZh;
    if (!nextName && !nextNameZh) return;
    const nextMuscleGroup = patch.muscleGroup ?? machine.muscleGroup;
    const nextSplits = patch.workoutSplits
      ?? (patch.muscleGroup !== undefined && patch.muscleGroup !== machine.muscleGroup
        ? inferSplitsForMuscle(nextMuscleGroup)
        : machine.workoutSplits);
    const nextLocationNote = patch.locationNote !== undefined ? (patch.locationNote.trim() || undefined) : machine.locationNote;
    const nextLocationNoteZh = patch.locationNoteZh !== undefined ? (patch.locationNoteZh.trim() || undefined) : machine.locationNoteZh;
    const nextPhotoUri = patch.photoUri !== undefined && patch.photoUri.trim() ? patch.photoUri.trim() : machine.photoUri;

    const updated: GymMachine = {
      ...machine,
      name: nextName,
      nameZh: nextNameZh,
      muscleGroup: nextMuscleGroup,
      workoutSplits: nextSplits,
      locationNote: nextLocationNote,
      locationNoteZh: nextLocationNoteZh,
      photoUri: nextPhotoUri,
    };

    const nextDisplayName = updated.name || updated.nameZh || 'Workout Machine';
    const nextSets = state.sets.map((s) => (s.machineId === machineId ? { ...s, machineName: nextDisplayName } : s));

    updateState({
      machines: state.machines.map((item) => (item.id === machineId ? updated : item)),
      sets: nextSets,
    });
    void syncEngine.broadcast({ type: 'MACHINE_ADDED', payload: { machine: updated } });
  };

  const addMachine = (newMachineData: {
    name: string;
    nameZh?: string;
    muscleGroup: MuscleGroup;
    locationNote: string;
    photoUri: string;
    adjustment1Label?: string;
    adjustment2Label?: string;
    markusSeat: string;
    markusPin?: string;
    partnerSeat: string;
    partnerPin?: string;
    customAdjustments?: {
      label: string;
      markusValue: string;
      partnerValue: string;
    }[];
  }) => {
    triggerHaptic('success');
    const adj1Label = newMachineData.adjustment1Label?.trim() || 'Seat Height';
    const adj2Label = newMachineData.adjustment2Label?.trim() || 'Pad / Lever';
    const muscleGroup = newMachineData.muscleGroup || 'Full Body';

    let markusAdjustments: MachineAdjustment[];
    let partnerAdjustments: MachineAdjustment[];
    let markusSeat: string;
    let markusPin: string;
    let partnerSeat: string;
    let partnerPin: string;

    if (
      Array.isArray(newMachineData.customAdjustments)
    ) {
      markusAdjustments = newMachineData.customAdjustments.map((item, idx) => ({
        id: `adj-m-${idx + 1}`,
        label:
          item.label?.trim() ||
          (idx === 0
            ? adj1Label
            : idx === 1
            ? adj2Label
            : `Setting ${idx + 1}`),
        value: item.markusValue?.trim() || '1',
      }));
      partnerAdjustments = newMachineData.customAdjustments.map((item, idx) => ({
        id: `adj-p-${idx + 1}`,
        label:
          item.label?.trim() ||
          (idx === 0
            ? adj1Label
            : idx === 1
            ? adj2Label
            : `Setting ${idx + 1}`),
        value: item.partnerValue?.trim() || '1',
      }));
      markusSeat = markusAdjustments[0]?.value || '';
      markusPin = markusAdjustments[1]?.value || '';
      partnerSeat = partnerAdjustments[0]?.value || '';
      partnerPin = partnerAdjustments[1]?.value || '';
    } else {
      markusSeat = newMachineData.markusSeat.trim() || 'Notch 5';
      markusPin = newMachineData.markusPin?.trim() ?? 'Mid Grip';
      partnerSeat = newMachineData.partnerSeat.trim() || 'Notch 2';
      partnerPin = newMachineData.partnerPin?.trim() ?? 'Narrow Grip';

      markusAdjustments = [
        { id: 'adj-m-1', label: adj1Label, value: markusSeat },
        ...(markusPin
          ? [{ id: 'adj-m-2', label: adj2Label, value: markusPin }]
          : []),
      ];
      partnerAdjustments = [
        { id: 'adj-p-1', label: adj1Label, value: partnerSeat },
        ...(partnerPin
          ? [{ id: 'adj-p-2', label: adj2Label, value: partnerPin }]
          : []),
      ];
    }

    const adjustmentLabels: [string, string, ...string[]] = [
      markusAdjustments[0]?.label || adj1Label,
      markusAdjustments[1]?.label || adj2Label,
      ...markusAdjustments.slice(2).map((a) => a.label),
    ];

    const newMachine: GymMachine = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newMachineData.name.trim(),
      nameZh: newMachineData.nameZh?.trim() || undefined,
      muscleGroup,
      workoutSplits: inferSplitsForMuscle(muscleGroup),
      adjustmentLabels,
      locationNote: newMachineData.locationNote.trim() || undefined,
      photoUri:
        newMachineData.photoUri ||
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
      createdAt: new Date().toISOString(),
      partnerSetups: {
        markus: {
          seatPosition: markusSeat,
          pinOrPadNote: markusPin,
          adjustments: markusAdjustments,
          lastWorkingWeight: 0,
          lastReps: 10,
          personalRecordWeight: 0,
        },
        partner: {
          seatPosition: partnerSeat,
          pinOrPadNote: partnerPin,
          adjustments: partnerAdjustments,
          lastWorkingWeight: 0,
          lastReps: 10,
          personalRecordWeight: 0,
        },
      },
    };

    const nextMachines = [newMachine, ...state.machines];
    const nextSessionIds = state.isSessionActive && !state.sessionMachineIds.includes(newMachine.id)
      ? [...state.sessionMachineIds, newMachine.id]
      : state.sessionMachineIds;
    const nowMs = Date.now();
    const nextTimings = state.isSessionActive
      ? { ...state.sessionExerciseTimings, [newMachine.id]: { machineId: newMachine.id, startedAt: new Date(nowMs).toISOString() } }
      : state.sessionExerciseTimings;

    updateState({
      machines: nextMachines,
      selectedMachineId: newMachine.id,
      sessionMachineIds: nextSessionIds,
      ...(state.isSessionActive ? { sessionExerciseTimings: nextTimings, currentSetStartedAt: nowMs } : {}),
    });

    void syncEngine.broadcast({
      type: 'MACHINE_ADDED',
      payload: { machine: newMachine },
    });
  };

  const logSet = (weight: number, reps: number, machineId?: string): WorkoutSetLog => {
    const currentMachine =
      (machineId ? state.machines.find((m) => m.id === machineId) : null) ||
      state.machines.find((machine) => machine.id === state.selectedMachineId);
    if (!currentMachine) throw new Error('Select a machine before logging a set.');
    const startedAt = state.sessionStartedAt ?? nextSessionStart();
    const workoutId = `w_${startedAt}`;
    const activeUserId = state.activeUser;
    const currentSetup = currentMachine?.partnerSetups?.[activeUserId];
    const previousPR = currentSetup?.personalRecordWeight || 0;

    const safeWeight =
      typeof weight === 'number' && !Number.isNaN(weight) && Number.isFinite(weight)
        ? Math.max(0, Number(weight.toFixed(2)))
        : currentSetup?.lastWorkingWeight || 40;
    const safeReps =
      typeof reps === 'number' && !Number.isNaN(reps) && Number.isFinite(reps)
        ? Math.max(1, Math.round(reps))
        : currentSetup?.lastReps || 10;

    const isPR = safeWeight > previousPR && safeWeight > 0;

    const currentSetsForMachine = state.sets.filter(
      (s) => s.machineId === currentMachine?.id && s.userId === activeUserId && s.workoutId === workoutId
    );
    const setNumber = Math.max(0, ...currentSetsForMachine.map((set) => set.setNumber)) + 1;

    const userProfile = state.profiles[activeUserId];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const currentTiming = state.sessionExerciseTimings[currentMachine.id];
    const exerciseStartedAt =
      currentTiming?.startedAt ||
      new Date(
        state.currentSetStartedAt && state.currentSetStartedAt <= nowMs
          ? state.currentSetStartedAt
          : startedAt
      ).toISOString();

    let setStartedMs = nowMs;
    if (currentSetsForMachine.length === 0) {
      setStartedMs =
        state.currentSetStartedAt && state.currentSetStartedAt <= nowMs
          ? Math.min(nowMs, state.currentSetStartedAt)
          : Date.parse(exerciseStartedAt);
    } else {
      const prevSetMs = Math.max(...currentSetsForMachine.map((s) => Date.parse(s.loggedAt)));
      if (state.currentSetStartedAt && state.currentSetStartedAt <= nowMs && state.currentSetStartedAt >= prevSetMs) {
        setStartedMs = state.currentSetStartedAt;
      }
    }
    const setStartedAtIso = new Date(Math.min(nowMs, setStartedMs)).toISOString();

    const newSet: WorkoutSetLog = {
      id: `set_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      workoutId,
      machineId: currentMachine?.id || 'm-custom',
      machineName: currentMachine?.name || currentMachine?.nameZh || 'Workout Machine',
      userId: activeUserId,
      setNumber,
      weight: safeWeight,
      reps: safeReps,
      unit: userProfile?.unit || 'kg',
      isPR,
      loggedAt: nowIso,
      startedAt: setStartedAtIso,
      exerciseStartedAt,
    };

    triggerHaptic(isPR ? 'success' : 'medium');

    const nextMachines = state.machines.map((m) => {
      if (m.id === newSet.machineId) {
        const existingSetup = m.partnerSetups?.[activeUserId];
        const updatedSetup = buildSynchronizedSetup(
          {
            ...existingSetup,
            lastWorkingWeight: safeWeight,
            lastReps: safeReps,
            personalRecordWeight: isPR ? safeWeight : previousPR,
          },
          m.adjustmentLabels
        );
        return {
          ...m,
          partnerSetups: {
            ...(m.partnerSetups || {}),
            [activeUserId]: updatedSetup,
          },
        };
      }
      return m;
    });

    const nextRestSeconds = 90;


    const nextSets = [newSet, ...state.sets];

    const latestReaction: HypeReaction = {
        id: `set_self_${newSet.id}`,
        fromUser: activeUserId,
        toUser: activeUserId,
        emoji: isPR ? '👑' : '💪',
        message: state.language === 'zh-TW'
          ? `${userProfile.name} 完成第 ${setNumber} 組：${newSet.machineName} · ${safeWeight} ${newSet.unit} × ${safeReps}${isPR ? ' · 新紀錄！' : ''}`
          : `${userProfile.name} finished set ${setNumber}: ${newSet.machineName} · ${safeWeight} ${newSet.unit} × ${safeReps}${isPR ? ' · New PR!' : ''}`,
        createdAt: new Date().toISOString(),
    };

    const nextSessionMachineIds = state.sessionMachineIds.includes(newSet.machineId)
      ? state.sessionMachineIds
      : [...state.sessionMachineIds, newSet.machineId];
    const nextTimings: Record<string, ExerciseTiming> = {
      ...state.sessionExerciseTimings,
      [currentMachine.id]: {
        machineId: currentMachine.id,
        startedAt: exerciseStartedAt,
        endedAt: nowIso,
      },
    };

    updateState({
      isSessionActive: true,
      sessionStartedAt: startedAt,
      sessionMachineIds: nextSessionMachineIds,
      sessionExerciseTimings: nextTimings,
      currentSetStartedAt: nowMs + nextRestSeconds * 1000,
      sets: nextSets,
      machines: nextMachines,
      restDurationSeconds: nextRestSeconds,
      restSeconds: nextRestSeconds,
      restEndsAt: nowMs + nextRestSeconds * 1000,
      latestReaction,
    });

    void syncEngine.broadcast({
      type: 'SET_LOGGED',
      payload: { set: newSet },
    });

    broadcastOwnStatus({
      currentMachineId: newSet.machineId,
      currentMachineName: newSet.machineName,
      currentSetNumber: setNumber,
      lastSetWeight: safeWeight,
      lastSetReps: safeReps,
      totalSetsToday: nextSets.filter((s) => s.userId === activeUserId && new Date(s.loggedAt).toDateString() === new Date().toDateString()).length,
    });

    return newSet;
  };

  const sendReaction = (emoji: HypeEmoji, customMessage?: string) => {
    triggerHaptic('medium');
    const fromUser = state.activeUser;
    const toUser: PartnerId = fromUser === 'markus' ? 'partner' : 'markus';
    const senderName = state.profiles[fromUser].name;

    const zhMessages: Record<HypeEmoji, string> = {
      '🔥': `${senderName}：這組很強！保持節奏。`,
      '💪': `${senderName}：動作很漂亮，下一組繼續！`,
      '❤️': `${senderName}：一起把這次練完！`,
      '👑': `${senderName}：大重量也很穩！`,
      '👀': `${senderName}：可以幫我補一組嗎？`,
      '💧': `${senderName}：要不要喝口水？`,
    };
    const defaultMessages: Record<HypeEmoji, string> = state.language === 'zh-TW' ? zhMessages : {
      '🔥': `${senderName}: Strong set! Keep the pace rolling.`,
      '💪': `${senderName}: Clean reps — lock in for the next set.`,
      '❤️': `${senderName}: Crushing this session together.`,
      '👑': `${senderName}: Heavy weight moving smooth!`,
      '👀': `${senderName}: Can you spot me for a set?`,
      '💧': `${senderName}: Water break?`,
    };

    const reaction: HypeReaction = {
      id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromUser,
      toUser,
      emoji,
      message: customMessage || defaultMessages[emoji],
      createdAt: new Date().toISOString(),
    };

    void syncEngine.broadcast({
      type: 'HYPE_REACTION',
      payload: { reaction },
    });
  };

  const simulatePartnerSet = () => {
    triggerHaptic('success');
    const partnerId: PartnerId = state.activeUser === 'markus' ? 'partner' : 'markus';
    const partnerProfile = state.profiles[partnerId];
    const partnerName = partnerProfile?.name || 'Partner';
    const targetMachine = selectedMachine || state.machines[0];
    if (!targetMachine) return;

    const currentSetup = targetMachine.partnerSetups?.[partnerId];
    const previousPR = currentSetup?.personalRecordWeight || (partnerId === 'partner' ? 35 : 60);
    const simulatedWeight = previousPR + (partnerId === 'partner' ? 2.5 : 5);
    const simulatedReps = 10;

    const partnerStartedAt = state.sessionStartedAt || nextSessionStart();
    const partnerWorkoutId = `w_${partnerStartedAt}`;
    const partnerSets = state.sets.filter(
      (s) => s.machineId === targetMachine.id && s.userId === partnerId && s.workoutId === partnerWorkoutId
    );
    const setNumber = partnerSets.length + 1;

    const simulatedSet: WorkoutSetLog = {
      id: `sim_set_${Date.now()}`,
      workoutId: partnerWorkoutId,
      machineId: targetMachine.id,
      machineName: targetMachine.name,
      userId: partnerId,
      setNumber,
      weight: simulatedWeight,
      reps: simulatedReps,
      unit: partnerProfile?.unit || 'kg',
      isPR: true,
      loggedAt: new Date().toISOString(),
    };

    const celebrationReaction: HypeReaction = {
      id: `set_alert_${simulatedSet.id}`,
      fromUser: partnerId,
      toUser: state.activeUser,
      emoji: '👑',
      message: state.language === 'zh-TW'
        ? `${partnerName} 在 ${targetMachine.nameZh || targetMachine.name} 創下新紀錄：${simulatedWeight} kg × ${simulatedReps}！`
        : `New PR: ${partnerName} hit ${simulatedWeight} kg × ${simulatedReps} on ${targetMachine.name}!`,
      createdAt: new Date().toISOString(),
    };

    const simulatedStatus: PartnerLiveStatus = {
      userId: partnerId,
      isOnline: true,
      currentMachineId: targetMachine.id,
      currentMachineName: targetMachine.name,
      currentSetNumber: setNumber,
      restSecondsRemaining: 90,
      restEndsAt: Date.now() + 90000,
      isSessionActive: true,
      sessionStartedAt: partnerStartedAt,
      sessionMachineIds: [...new Set([...(state.partnerStatus.sessionMachineIds || []), targetMachine.id])],
      lastUpdated: new Date().toISOString(),
    };

    const nextMachines = state.machines.map((m) => {
      if (m.id === targetMachine.id) {
        const existingSetup = m.partnerSetups?.[partnerId];
        const updatedSetup = buildSynchronizedSetup(
          {
            ...existingSetup,
            lastWorkingWeight: simulatedWeight,
            lastReps: simulatedReps,
            personalRecordWeight: simulatedWeight,
          },
          m.adjustmentLabels
        );
        return {
          ...m,
          partnerSetups: {
            ...(m.partnerSetups || {}),
            [partnerId]: updatedSetup,
          },
        };
      }
      return m;
    });

    const nextProfiles = partnerProfile
      ? {
          ...state.profiles,
          [partnerId]: {
            ...partnerProfile,
            completedThisWeek: Math.min(
              partnerProfile.weeklyGoal,
              partnerProfile.completedThisWeek + 1
            ),
          },
        }
      : state.profiles;

    updateState({
      sets: [simulatedSet, ...state.sets],
      machines: nextMachines,
      partnerStatus: simulatedStatus,
      profiles: nextProfiles,
      latestReaction: celebrationReaction,
    });
    void notifyCompletedSet(simulatedSet, partnerName, state.language);

    void syncEngine.broadcast({
      type: 'SET_LOGGED',
      payload: { set: simulatedSet },
    });
    void syncEngine.broadcast({
      type: 'HYPE_REACTION',
      payload: { reaction: celebrationReaction },
    });
    void syncEngine.broadcast({
      type: 'PARTNER_STATUS',
      payload: { status: simulatedStatus },
    });
  };

  const openOnboarding = () => {
    triggerHaptic('light');
    updateState({ isOnboardingOpen: true });
  };

  const closeOnboarding = () => {
    triggerHaptic('light');
    updateState({ isOnboardingOpen: false });
  };

  const completeOnboarding = (options: {
    markusName: string;
    partnerName: string;
    unit: 'kg' | 'lbs';
    weeklyGoal: number;
    loadDemoMachines: boolean;
  }) => {
    triggerHaptic('success');
    const safeMarkusName = options.markusName?.trim() || 'Markus';
    const safePartnerName = options.partnerName?.trim() || 'Abby';
    const safeUnit: 'kg' | 'lbs' = options.unit === 'lbs' ? 'lbs' : 'kg';
    const safeGoal =
      typeof options.weeklyGoal === 'number' && options.weeklyGoal > 0
        ? options.weeklyGoal
        : 4;
    const loadDemo = Boolean(options.loadDemoMachines);

    const nextProfiles: Record<PartnerId, PartnerProfile> = {
      markus: {
        ...state.profiles.markus,
        name: safeMarkusName,
        avatarEmoji: safeMarkusName.charAt(0).toUpperCase() || 'M',
        unit: safeUnit,
        weeklyGoal: safeGoal,
        completedThisWeek: loadDemo ? 3 : 0,
      },
      partner: {
        ...state.profiles.partner,
        name: safePartnerName,
        avatarEmoji: safePartnerName.charAt(0).toUpperCase() || 'A',
        unit: safeUnit,
        weeklyGoal: safeGoal,
        completedThisWeek: loadDemo ? 3 : 0,
      },
    };

    if (state.hasCompletedOnboarding) {
      const machines = state.machines.map((m) => ({ ...m, partnerSetups: {
        markus: convertSetupUnit(m.partnerSetups.markus, state.profiles.markus.unit, safeUnit),
        partner: convertSetupUnit(m.partnerSetups.partner, state.profiles.partner.unit, safeUnit),
      } }));
      updateState({ profiles: nextProfiles, machines, isOnboardingOpen: false });
      refreshProgress();
      void syncEngine.broadcast({ type: 'PROFILES_UPDATED', payload: { profiles: state.profiles } });
      for (const machine of machines) void syncEngine.broadcast({ type: 'MACHINE_ADDED', payload: { machine } });
      return;
    }
    if (!loadDemo) {
      updateState({
        profiles: nextProfiles,
        machines: [],
        sets: [],
        selectedMachineId: null,
        sessionMachineIds: [],
        isSessionActive: false,
        sessionStartedAt: null,
        sessionElapsedSeconds: 0,
        restSeconds: 0,
        latestReaction: null,
        streak: {
          ...state.streak,
          currentStreakWeeks: 0,
        },
        partnerStatus: {
          ...state.partnerStatus,
          currentMachineId: null,
          currentMachineName: null,
          currentSetNumber: 0,
          restSecondsRemaining: 0,
          lastUpdated: new Date().toISOString(),
        },
        hasCompletedOnboarding: true,
        isOnboardingOpen: false,
      });
    } else {
      updateState({
        profiles: nextProfiles,
        machines: INITIAL_MACHINES,
        sets: INITIAL_SETS,
        selectedMachineId: 'm-chest-press',
        sessionMachineIds: [],
        sessionExerciseTimings: {},
        currentSetStartedAt: null,
        isSessionActive: false,
        sessionStartedAt: null,
        sessionElapsedSeconds: 0,
        restSeconds: 0,
        streak: {
          ...state.streak,
          currentStreakWeeks: 4,
        },
        partnerStatus: {
          ...state.partnerStatus,
          currentMachineId: 'm-chest-press',
          currentMachineName: 'Iso-Lateral Chest Press',
          currentSetNumber: 1,
          restSecondsRemaining: 35,
          lastUpdated: new Date().toISOString(),
        },
        hasCompletedOnboarding: true,
        isOnboardingOpen: false,
      });
    }
  };

  return {
    // State
    activeUser: currentState.activeUser,
    language: currentState.language,
    isSessionActive: currentState.isSessionActive,
    sessionStartedAt: currentState.sessionStartedAt,
    sessionElapsedSeconds: currentState.sessionElapsedSeconds,
    sessionTitle: currentState.sessionTitle,
    sessionMachineIds: currentState.sessionMachineIds,
    sessionExerciseTimings: currentState.sessionExerciseTimings,
    profiles: currentState.profiles,
    machines: currentState.machines,
    sets: currentState.sets,
    partnerStatus: currentState.partnerStatus,
    streak: currentState.streak,
    latestReaction: currentState.latestReaction,
    restSeconds: currentState.restSeconds,
    restDurationSeconds: currentState.restDurationSeconds,
    completedWorkouts: currentState.completedWorkouts,
    quickRoutines: currentState.quickRoutines,
    sessionAlarmMinutes: currentState.sessionAlarmMinutes,
    selectedMachineId: currentState.selectedMachineId,
    selectedMachine,
    activeSplit: currentState.activeSplit,
    syncConnected: currentState.syncConnected,
    cloudConnected: currentState.cloudConnected,
    isOnboardingOpen: currentState.isOnboardingOpen,
    hasCompletedOnboarding: currentState.hasCompletedOnboarding,

    // Actions
    dismissReaction: () => updateState({ latestReaction: null }),
    syncLocalData: async () => {
      const snapshot = state;
      await syncEngine.broadcast({ type: 'PROFILES_UPDATED', payload: { profiles: snapshot.profiles } });
      for (const machine of snapshot.machines) await syncEngine.broadcast({ type: 'MACHINE_ADDED', payload: { machine } });
      for (const set of [...snapshot.sets].reverse()) {
        if (!set.id.startsWith('set-init-') && !set.id.startsWith('sim_')) await syncEngine.broadcast({ type: 'SET_LOGGED', payload: { set } });
      }
      for (const workout of snapshot.completedWorkouts) await syncEngine.broadcast({ type: 'SESSION_FINISHED', payload: {
        workoutId: workout.id, finishedAt: workout.finishedAt, participants: workout.participants,
        startedAt: workout.startedAt, title: workout.title,
        finishedBy: snapshot.activeUser, finishedByName: snapshot.profiles[snapshot.activeUser].name, durationSeconds: workout.durationSeconds || 0,
      } });
      for (const [workoutId, title] of Object.entries(snapshot.workoutEdits)) {
        await syncEngine.broadcast({ type: 'SESSION_CHANGED', payload: { workoutId, title } });
      }
    },
    setLanguage,
    toggleLanguage,
    startSession,
    finishSession,
    addMachineToSession,
    removeMachineFromSession,
    switchActiveUser,
    setSelectedMachineId,
    setActiveSplit,
    startRest,
    cancelRest,
    setSessionAlarm,
    updatePartnerSetup,
    addMachine,
    updateMachine,
    updateMachineNames,
    updateMachinePhoto: (id: string, photoUri: string) => {
      const machine = state.machines.find((item) => item.id === id);
      if (!machine) return;
      const updated = { ...machine, photoUri };
      updateState({ machines: state.machines.map((item) => item.id === id ? updated : item) });
      void syncEngine.broadcast({ type: 'MACHINE_ADDED', payload: { machine: updated } });
    },
    deleteMachine: (id: string) => {
      updateState({ machines: state.machines.filter((item) => item.id !== id), sessionMachineIds: state.sessionMachineIds.filter((item) => item !== id), selectedMachineId: state.selectedMachineId === id ? null : state.selectedMachineId });
      void syncEngine.broadcast({ type: 'MACHINE_DELETED', payload: { machineId: id } });
    },
    saveQuickRoutine: (routine: QuickRoutine) => {
      const name = routine.name.trim();
      if (!name) return;
      const updated = { ...routine, name };
      updateState({ quickRoutines: state.quickRoutines.some((item) => item.id === routine.id)
        ? state.quickRoutines.map((item) => item.id === routine.id ? updated : item)
        : [...state.quickRoutines, updated] });
    },
    deleteQuickRoutine: (id: string) => updateState({ quickRoutines: state.quickRoutines.filter((item) => item.id !== id) }),
    changeSet: (setId: string, values: { weight: number; reps: number } | null) => {
      const old = state.sets.find((set) => set.id === setId);
      const inCompletedWorkout = old ? state.completedWorkouts.some((w) => w.id === old.workoutId) : false;
      if (!old || (old.userId !== state.activeUser && !inCompletedWorkout)) return;
      if (values && (!Number.isFinite(values.weight) || values.weight < 0 || !Number.isSafeInteger(values.reps) || values.reps < 1)) return;
      const set = values ? { ...old, ...values, isPR: false } : null;
      applySetChange(setId, set);
      void syncEngine.broadcast({ type: 'SET_CHANGED', payload: { setId, set } });
    },
    changeWorkout: (workoutId: string, title: string | null) => {
      if (!state.completedWorkouts.some((workout) => workout.id === workoutId)) return;
      if (title !== null && (!title.trim() || title.length > 120)) return;
      const nextTitle = title?.trim() ?? null;
      applyWorkoutChange(workoutId, nextTitle);
      void syncEngine.broadcast({ type: 'SESSION_CHANGED', payload: { workoutId, title: nextTitle } });
    },
    addExerciseToWorkout: (workoutId: string, machineId: string) => {
      const workout = state.completedWorkouts.find((w) => w.id === workoutId);
      const machine = state.machines.find((m) => m.id === machineId);
      if (!workout || !machine) return;
      const existingIds = workout.machineIds ?? [...new Set(state.sets.filter((s) => s.workoutId === workoutId).map((s) => s.machineId))];
      if (existingIds.includes(machineId)) return;
      const nextMachineIds = [...existingIds, machineId];
      applyWorkoutChange(workoutId, { machineIds: nextMachineIds });
      void syncEngine.broadcast({ type: 'SESSION_CHANGED', payload: { workoutId, machineIds: nextMachineIds } });
    },
    removeExerciseFromWorkout: (workoutId: string, machineId: string) => {
      const workout = state.completedWorkouts.find((w) => w.id === workoutId);
      if (!workout) return;
      const removedSets = state.sets.filter((s) => s.workoutId === workoutId && s.machineId === machineId);
      const remainingSets = state.sets.filter((s) => !(s.workoutId === workoutId && s.machineId === machineId));
      const remainingForWorkout = remainingSets.filter((s) => s.workoutId === workoutId);
      const existingIds = workout.machineIds ?? [...new Set(state.sets.filter((s) => s.workoutId === workoutId).map((s) => s.machineId))];
      const nextMachineIds = existingIds.filter((id) => id !== machineId);
      const nextParticipants = remainingForWorkout.length > 0
        ? ([...new Set(remainingForWorkout.map((s) => s.userId))] as PartnerId[])
        : workout.participants;
      const nextTimings = workout.exerciseTimings
        ? Object.fromEntries(Object.entries(workout.exerciseTimings).filter(([k]) => k !== machineId))
        : undefined;
      const recalculated = recalculateSetRecords(remainingSets, removedSets);
      const nextWorkouts = state.completedWorkouts.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              machineIds: nextMachineIds,
              participants: nextParticipants,
              exerciseTimings: nextTimings && Object.keys(nextTimings).length ? nextTimings : undefined,
            }
          : w
      );
      updateState({ ...recalculated, completedWorkouts: nextWorkouts });
      for (const s of removedSets) {
        void syncEngine.broadcast({ type: 'SET_CHANGED', payload: { setId: s.id, set: null } });
      }
      void syncEngine.broadcast({ type: 'SESSION_CHANGED', payload: { workoutId, machineIds: nextMachineIds, participants: nextParticipants } });
    },
    addSetToWorkout: (workoutId: string, machineId: string, userId: PartnerId, weight: number, reps: number): WorkoutSetLog | null => {
      const workout = state.completedWorkouts.find((w) => w.id === workoutId);
      const machine = state.machines.find((m) => m.id === machineId);
      if (!workout || !machine) return null;
      if (!Number.isFinite(weight) || weight < 0 || !Number.isSafeInteger(reps) || reps < 1) return null;
      const safeWeight = Number(weight.toFixed(2));
      const existingMachineSets = state.sets.filter((s) => s.workoutId === workoutId && s.machineId === machineId);
      const userMachineSets = existingMachineSets.filter((s) => s.userId === userId);
      const setNumber = Math.max(0, ...userMachineSets.map((s) => s.setNumber)) + 1;
      const baseMs = existingMachineSets.length > 0
        ? Math.max(...existingMachineSets.map((s) => Date.parse(s.loggedAt))) + 90000
        : Date.parse(workout.finishedAt);
      const loggedAt = new Date(Number.isFinite(baseMs) ? baseMs : Date.now()).toISOString();

      const rawSet: WorkoutSetLog = {
        id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        workoutId,
        machineId: machine.id,
        machineName: machine.name || machine.nameZh || 'Workout Machine',
        userId,
        setNumber,
        weight: safeWeight,
        reps,
        unit: state.profiles[userId].unit,
        isPR: false,
        loggedAt,
      };
      const recalculated = recalculateSetRecords([rawSet, ...state.sets], [rawSet]);
      const finalSet = recalculated.sets.find((s) => s.id === rawSet.id) ?? rawSet;
      const nextMachineIds = [...new Set([...(workout.machineIds ?? state.sets.filter((s) => s.workoutId === workoutId).map((s) => s.machineId)), machineId])];
      const nextParticipants = [...new Set([...workout.participants, userId])] as PartnerId[];
      const nextWorkouts = state.completedWorkouts.map((w) =>
        w.id === workoutId ? { ...w, machineIds: nextMachineIds, participants: nextParticipants } : w
      );
      updateState({ ...recalculated, completedWorkouts: nextWorkouts });
      void syncEngine.broadcast({ type: 'SET_LOGGED', payload: { set: finalSet } });
      void syncEngine.broadcast({ type: 'SESSION_CHANGED', payload: { workoutId, machineIds: nextMachineIds, participants: nextParticipants } });
      return finalSet;
    },
    logSet,
    sendReaction,
    simulatePartnerSet,
    openOnboarding,
    closeOnboarding,
    completeOnboarding,
  };
}
