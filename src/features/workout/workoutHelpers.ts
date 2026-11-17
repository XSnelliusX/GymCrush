import { GymMachine, Language, PartnerId, WorkoutSetLog } from '../../types/gym';
import { settingsSummary } from '../machines/machineUtils';

export const otherPartner = (pid: PartnerId): PartnerId => (pid === 'markus' ? 'partner' : 'markus');

export const sessionWorkoutId = (startedAt: number | null) => (startedAt ? `w_${startedAt}` : null);

export const machineName = (m: GymMachine | undefined | null, lang: Language) =>
  !m ? '' : lang === 'zh-TW' && m.nameZh ? m.nameZh : m.name;

/** "Seat Height 5 · Back Pad 3" for one partner's setup on a machine. */
export function adjustmentSummary(m: GymMachine, pid: PartnerId): string {
  const setup = m.partnerSetups?.[pid];
  const list = setup?.adjustments?.length
    ? setup.adjustments
    : [{ label: m.adjustmentLabels?.[0] ?? 'Seat', value: setup?.seatPosition ?? '' }];
  return settingsSummary(list.filter((a) => a.value));
}

const toUnit = (weight: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs') =>
  from === to ? weight : Number((to === 'lbs' ? weight * 2.2046226218 : weight / 2.2046226218).toFixed(2));

/** The same set number from this partner's most recent earlier workout on this machine. */
export function previousSet(sets: WorkoutSetLog[], machineId: string, pid: PartnerId, setNumber: number, currentWorkoutId: string | null) {
  const earlier = sets
    .filter((s) => s.machineId === machineId && s.userId === pid && s.workoutId !== currentWorkoutId)
    .sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt));
  if (!earlier.length) return null;
  const lastWorkout = earlier[0].workoutId;
  const inLast = earlier.filter((s) => s.workoutId === lastWorkout);
  return inLast.find((s) => s.setNumber === setNumber) ?? null;
}

/** Starting values for the next-set input: last set this session, else the partner's saved working weight. */
export function defaultDraft(m: GymMachine, pid: PartnerId, unit: 'kg' | 'lbs', sessionSets: WorkoutSetLog[]) {
  const latest = sessionSets.filter((s) => s.machineId === m.id && s.userId === pid).at(-1);
  const setup = m.partnerSetups?.[pid];
  if (latest) return { weight: toUnit(latest.weight, latest.unit, unit), reps: latest.reps };
  return { weight: setup?.lastWorkingWeight ?? 0, reps: setup?.lastReps || 10 };
}

export const formatWeight = (n: number) => String(Number(n.toFixed(2)));

