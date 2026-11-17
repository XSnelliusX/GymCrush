import { CompletedWorkout } from '../../types/gym';

/** Monday 00:00 local of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Groups workouts (newest first) by week; label is "This week" / "Last week" / "Week of <date>". */
export function groupByWeek(workouts: CompletedWorkout[], now: Date, label: (kind: 'this' | 'last' | 'other', start: Date) => string) {
  const sorted = [...workouts].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  const cur = weekStart(now).getTime();
  const groups: { key: string; title: string; items: CompletedWorkout[] }[] = [];
  for (const w of sorted) {
    const start = weekStart(new Date(w.finishedAt));
    const key = String(start.getTime());
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const weeksAgo = Math.round((cur - start.getTime()) / (7 * 86400000));
      g = { key, title: label(weeksAgo <= 0 ? 'this' : weeksAgo === 1 ? 'last' : 'other', start), items: [] };
      groups.push(g);
    }
    g.items.push(w);
  }
  return groups;
}

export function formatDuration(seconds?: number): string | undefined {
  if (seconds === undefined) return undefined;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
