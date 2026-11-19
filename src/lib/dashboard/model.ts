export interface Todo {
  id: string;
  text: string;
  /** Day it belongs to, 'YYYY-MM-DD' (local time) */
  date: string;
  done: boolean;
  /** Time block, minutes from midnight. Both unset = all-day todo. */
  start?: number;
  end?: number;
}

/** A recurring task, which doubles as a habit you track progress on. */
export interface Recurring {
  id: string;
  text: string;
  /** Weekdays it repeats on, 0 = Sunday. All seven = daily. */
  days: number[];
  /** First day it applies */
  start: string;
  /** Days it was completed */
  done: string[];
}

export interface Timer {
  id: string;
  label: string;
  /** ms */
  duration: number;
  /** ms left while paused; ignored while running */
  remaining: number;
  /** Epoch ms when it rings; null while paused */
  endsAt: number | null;
}

export interface DashData {
  v: 1;
  todos: Todo[];
  recurring: Recurring[];
  timers: Timer[];
}

export const emptyData = (): DashData => ({ v: 1, todos: [], recurring: [], timers: [] });

export const uid = () => crypto.randomUUID();

// ----- Dates: everything is keyed by local calendar day

export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = fromKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Clamp: Jan 31 + 1 month → Feb 28/29
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toKey(target);
}

/** Weeks start on Monday */
export function startOfWeek(key: string): string {
  const day = fromKey(key).getDay();
  return addDays(key, -((day + 6) % 7));
}

export const WEEKDAYS_MON = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isDue(r: Recurring, key: string): boolean {
  return key >= r.start && r.days.includes(fromKey(key).getDay());
}

/**
 * Consecutive due days completed, counting back from today. An unfinished
 * today doesn't break the streak; the day isn't over yet.
 */
export function streak(r: Recurring, today = todayKey()): number {
  const done = new Set(r.done);
  let key = done.has(today) || !isDue(r, today) ? today : addDays(today, -1);
  let count = 0;
  for (let i = 0; i < 400 && key >= r.start; i++, key = addDays(key, -1)) {
    if (!isDue(r, key)) continue;
    if (!done.has(key)) break;
    count++;
  }
  return count;
}

export function describeDays(days: number[]): string {
  if (days.length === 7) return 'Daily';
  const sorted = WEEKDAYS_MON.filter((d) => days.includes(d));
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '6,0') return 'Weekends';
  return sorted.map((d) => DAY_SHORT[d]).join(' ');
}

/** 540 → "9:00 AM" (locale format) */
export function formatTime(min: number): string {
  const d = new Date(2000, 0, 1, Math.floor(min / 60), min % 60);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** 540 → "09:00", for <input type="time"> */
export const toTimeInput = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function fromTimeInput(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const DAY_MINUTES = 24 * 60;

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
