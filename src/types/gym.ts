export type PartnerId = 'markus' | 'partner';

export type Language = 'en' | 'zh-TW';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Glutes'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Full Body';

export type WorkoutSplitId = 'all' | 'push' | 'pull' | 'legs' | 'upper';

export interface WorkoutSplit {
  id: WorkoutSplitId;
  name: string;
  subtitle: string;
  muscleGroups: MuscleGroup[];
}

export interface PartnerProfile {
  id: PartnerId;
  name: string;
  platform: 'Android' | 'iOS';
  unit: 'kg' | 'lbs';
  avatarEmoji: string;
  accentColor: string;
  weeklyGoal: number;
  completedThisWeek: number;
}

/**
 * Individual adjustable setting on a machine (e.g. Dial 1: Seat Height = "5", Dial 2: Back Pad = "3")
 */
export interface MachineAdjustment {
  id: string;
  label: string;
  value: string;
}

export interface MachinePartnerSetup {
  /**
   * 2+ named adjustable settings per machine (e.g., Seat Height + Back Pad / Pin)
   */
  adjustments: MachineAdjustment[];
  seatPosition: string;
  pinOrPadNote: string;
  lastWorkingWeight: number;
  lastReps: number;
  personalRecordWeight: number;
}

export interface GymMachine {
  id: string;
  name: string;
  nameZh?: string;
  muscleGroup: MuscleGroup;
  workoutSplits?: WorkoutSplitId[];
  locationNote?: string;
  locationNoteZh?: string;
  adjustmentLabels?: [string, string, ...string[]];
  photoUri: string;
  createdAt: string;
  partnerSetups: Record<PartnerId, MachinePartnerSetup>;
}

export interface WorkoutSetLog {
  id: string;
  workoutId: string;
  machineId: string;
  machineName: string;
  userId: PartnerId;
  setNumber: number;
  weight: number;
  reps: number;
  unit: 'kg' | 'lbs';
  isPR: boolean;
  loggedAt: string;
}

export type HypeEmoji = '🔥' | '💪' | '❤️' | '👑' | '👀' | '💧';

export interface HypeReaction {
  id: string;
  fromUser: PartnerId;
  toUser: PartnerId;
  emoji: HypeEmoji | '⏰'; // the alarm is local-only and never synced
  message: string;
  createdAt: string;
}

export interface PartnerLiveStatus {
  sourceInstanceId?: string;
  sequence?: number;
  userId: PartnerId;
  isOnline: boolean;
  routineTitle?: string | null;
  currentMachineId: string | null;
  currentMachineName: string | null;
  currentSetNumber: number;
  lastSetWeight?: number;
  lastSetReps?: number;
  totalSetsToday?: number;
  restSecondsRemaining: number;
  restEndsAt?: number;
  restDurationSeconds?: number;
  isSessionActive?: boolean;
  sessionStartedAt?: number | null;
  sessionMachineIds?: string[];
  lastUpdated: string;
}

export interface CoupleStreakState {
  currentStreakWeeks: number;
  bestStreakWeeks: number;
  coupleInviteCode: string;
  isPaired: boolean;
}

export interface CompletedWorkout {
  id: string;
  title?: string;
  startedAt?: string;
  finishedAt: string;
  durationSeconds?: number;
  participants: PartnerId[];
}

export interface QuickRoutine {
  id: string;
  name: string;
  machineIds: string[] | null;
}
