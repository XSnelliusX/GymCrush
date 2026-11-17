import { CompletedWorkout, PartnerId, WorkoutSetLog } from '../types/gym';

export function workoutStart(workout: CompletedWorkout): string | undefined {
  if (workout.startedAt) return workout.startedAt;
  return /^w_\d{13}$/.test(workout.id) ? new Date(Number(workout.id.slice(2))).toISOString() : undefined;
}

export function workoutDuration(workout: CompletedWorkout): number | undefined {
  const start = workoutStart(workout);
  if (start) return Math.max(0, Math.floor((Date.parse(workout.finishedAt) - Date.parse(start)) / 1000));
  return workout.durationSeconds;
}

export interface ExerciseProgressPoint {
  workoutId: string;
  date: string;
  maxWeight: number;
  maxReps: number;
  totalReps: number;
  sets: number;
}

export function exerciseProgress(sets: WorkoutSetLog[], workouts: CompletedWorkout[], machineId: string, user: PartnerId, unit: 'kg' | 'lbs'): ExerciseProgressPoint[] {
  const completed = new Map(workouts.map((workout) => [workout.id, workout]));
  const points = new Map<string, ExerciseProgressPoint>();
  for (const set of sets) {
    if (set.machineId !== machineId || set.userId !== user || !completed.has(set.workoutId)) continue;
    const weight = set.weight * (set.unit === unit ? 1 : unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218);
    const point = points.get(set.workoutId) || {
      workoutId: set.workoutId, date: completed.get(set.workoutId)!.finishedAt,
      maxWeight: 0, maxReps: 0, totalReps: 0, sets: 0,
    };
    point.maxWeight = Math.max(point.maxWeight, weight);
    point.maxReps = Math.max(point.maxReps, set.reps);
    point.totalReps += set.reps;
    point.sets++;
    points.set(set.workoutId, point);
  }
  return [...points.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
