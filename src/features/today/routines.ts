import type { GymMachine, QuickRoutine } from '../../types/gym';

/** Built-in routines (push/pull/legs) are stored with machineIds null and resolve by muscle group, as the old idle screen did. */
export function routineMachineIds(routine: QuickRoutine, machines: GymMachine[]): string[] {
  if (routine.machineIds) return routine.machineIds.filter((id) => machines.some((m) => m.id === id));
  const groups: Record<string, string[]> = { push: ['Chest', 'Shoulders'], pull: ['Back', 'Arms'], legs: ['Legs', 'Glutes'] };
  const g = groups[routine.id] ?? [];
  return machines.filter((m) => g.includes(m.muscleGroup)).map((m) => m.id);
}

const ZH_ROUTINES: Record<string, string> = { push: '推舉日', pull: '拉背日', legs: '腿臀日' };
const EN_DEFAULTS: Record<string, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' };
/** Built-in routines translate until someone renames them. */
export const routineName = (r: QuickRoutine, zh: boolean) => (zh && r.name === EN_DEFAULTS[r.id] ? ZH_ROUTINES[r.id] : r.name);

export const machineLabel = (m: GymMachine, zh: boolean) => (zh ? m.nameZh || m.name : m.name || m.nameZh || '');
