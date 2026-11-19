import { useEffect, useRef, useState } from 'react';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { btn, btnPrimary, input } from './shared';
import {
  addDays,
  DAY_SHORT,
  describeDays,
  fromKey,
  isDue,
  streak,
  todayKey,
  uid,
  WEEKDAYS_MON,
  type DashData,
  type Recurring,
} from '../../../lib/dashboard/model';

const CHART_DAYS = 14;
const STRIP_DAYS = 14;

interface DayStat {
  key: string;
  due: number;
  done: number;
}

function dayStats(recurring: Recurring[], days: number, today = todayKey()): DayStat[] {
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(today, i - days + 1);
    const due = recurring.filter((r) => isDue(r, key));
    return { key, due: due.length, done: due.filter((r) => r.done.includes(key)).length };
  });
}

const pct = (s: { due: number; done: number }) => (s.due ? Math.round((s.done / s.due) * 100) : 0);

/** compact: the narrow side column of the one-page layout */
export default function Habits({ data, compact = false }: { data: DashData; compact?: boolean }) {
  // In a tile, show a week of history per habit until there's room for two
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Infinity);
  useEffect(() => {
    if (!compact || !ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [compact]);
  const stripDays = width >= 440 ? STRIP_DAYS : 7;
  const today = todayKey();
  const todayStat = dayStats(data.recurring, 1)[0];
  const month = dayStats(data.recurring, 30).reduce(
    (a, s) => ({ due: a.due + s.due, done: a.done + s.done }),
    { due: 0, done: 0 },
  );
  const best = data.recurring.reduce((m, r) => Math.max(m, streak(r, today)), 0);

  return (
    <div ref={ref} className={compact ? 'space-y-3 p-3' : 'h-full space-y-4 overflow-y-auto p-4'}>
      <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
        <Stat compact={compact} label="Today" value={`${todayStat.done}/${todayStat.due}`} sub="habits done" />
        <Stat compact={compact} label="30-day rate" value={month.due ? `${pct(month)}%` : '—'} sub={`${month.done} of ${month.due} check-ins`} />
        <Stat compact={compact} label="Best streak" value={String(best)} sub={best === 1 ? 'day' : 'days'} />
      </div>

      <CompletionChart compact={compact} stats={dayStats(data.recurring, CHART_DAYS)} />

      <section>
        <h3 className="mb-2 text-sm font-bold">Recurring tasks & habits</h3>
        <AddRecurring />
        <div className="mt-3 space-y-1.5">
          {data.recurring.length === 0 && (
            <p className="py-4 text-center text-xs text-body-muted">
              Nothing yet. Add a recurring task above and check it off from the planner or here.
            </p>
          )}
          {data.recurring.map((r) => (
            <HabitRow key={r.id} r={r} days={stripDays} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, compact }: { label: string; value: string; sub: string; compact: boolean }) {
  return (
    <div className={`rounded-lg border border-edge bg-chrome ${compact ? 'px-2.5 py-2' : 'px-4 py-3'}`}>
      <p className="text-[10px] uppercase tracking-wide text-body-muted">{label}</p>
      <p className={`mt-0.5 font-bold tabular-nums ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="text-[11px] text-body-muted">{sub}</p>
    </div>
  );
}

/** Single series: % of due habits completed per day. Hover any bar for detail. */
function CompletionChart({ stats, compact }: { stats: DayStat[]; compact: boolean }) {
  const H = compact ? 'h-24' : 'h-32';
  const [hover, setHover] = useState<number | null>(null);
  const today = todayKey();
  const h = stats[hover ?? -1];

  return (
    <section className="rounded-lg border border-edge bg-chrome p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-sm font-bold">Habit completion, last {CHART_DAYS} days</h3>
        <p className="text-[11px] text-body-muted tabular-nums" aria-live="polite">
          {h
            ? `${fromKey(h.key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${
                h.due ? `${h.done}/${h.due} done (${pct(h)}%)` : 'nothing due'
              }`
            : 'Hover a bar for details'}
        </p>
      </div>
      <div className="flex gap-2">
        {/* y-axis */}
        <div className={`flex ${H} flex-col justify-between text-right text-[9px] text-body-muted tabular-nums`}>
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="relative flex-1">
          {/* recessive gridlines */}
          <div className={`pointer-events-none absolute inset-x-0 top-0 ${H}`}>
            {[0, 50, 100].map((y) => (
              <div key={y} className="absolute inset-x-0 border-t border-edge" style={{ top: `${y}%` }} />
            ))}
          </div>
          <div className={`relative flex ${H} items-end gap-[2px]`} role="list" aria-label="Daily habit completion">
            {stats.map((s, i) => (
              <div
                key={s.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${s.key}: ${s.due ? `${pct(s)}% (${s.done} of ${s.due})` : 'nothing due'}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                // Hit target is the full column, not just the bar
                className="flex h-full flex-1 items-end justify-center outline-none"
              >
                <div
                  className={`w-full max-w-6 rounded-t transition-[height,opacity] duration-300 ${
                    s.due ? 'bg-accent' : ''
                  } ${hover !== null && hover !== i ? 'opacity-50' : ''}`}
                  style={{ height: s.due ? `${Math.max(pct(s), 2)}%` : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px]">
            {stats.map((s, i) => (
              <span
                key={s.key}
                className={`flex-1 text-center text-[9px] ${
                  s.key === today ? 'font-bold text-body' : 'text-body-muted'
                } ${i % 2 && s.key !== today ? 'invisible' : ''}`}
              >
                {fromKey(s.key).getDate()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AddRecurring() {
  const { update } = useDashboard();
  const [text, setText] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !days.length) return;
    update((d) => ({
      ...d,
      recurring: [...d.recurring, { id: uid(), text: text.trim(), days, start: todayKey(), done: [] }],
    }));
    setText('');
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-edge p-3">
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Read 20 pages, Gym, Leetcode…"
          aria-label="New recurring task"
          className={`${input} flex-1`}
        />
        <button type="submit" className={`${btnPrimary} flex items-center gap-1`} disabled={!text.trim() || !days.length}>
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {WEEKDAYS_MON.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDay(d)}
            aria-pressed={days.includes(d)}
            className={`w-9 rounded border py-0.5 text-[11px] transition-colors ${
              days.includes(d) ? 'border-accent bg-accent text-accent-contrast' : 'border-edge hover:bg-accent/20'
            }`}
          >
            {DAY_SHORT[d]}
          </button>
        ))}
        <span className="mx-1 text-edge">|</span>
        <button type="button" className={btn} onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
          Daily
        </button>
        <button type="button" className={btn} onClick={() => setDays([1, 2, 3, 4, 5])}>
          Weekdays
        </button>
        <span className="ml-auto text-[11px] text-body-muted">{days.length ? describeDays(days) : 'Pick a day'}</span>
      </div>
    </form>
  );
}

function HabitRow({ r, days: STRIP }: { r: Recurring; days: number }) {
  const { update } = useDashboard();
  const today = todayKey();
  const s = streak(r, today);
  const strip = Array.from({ length: STRIP }, (_, i) => addDays(today, i - STRIP + 1));

  const toggle = (key: string) =>
    update((d) => ({
      ...d,
      recurring: d.recurring.map((x) =>
        x.id !== r.id
          ? x
          : { ...x, done: x.done.includes(key) ? x.done.filter((k) => k !== key) : [...x.done, key] },
      ),
    }));
  const remove = () => update((d) => ({ ...d, recurring: d.recurring.filter((x) => x.id !== r.id) }));

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-edge bg-chrome px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold" title={r.text}>
          {r.text}
        </p>
        <p className="text-[10px] text-body-muted">{describeDays(r.days)}</p>
      </div>
      {/* Last 14 days: filled = done, outlined = due, faint = not scheduled */}
      <div className="flex gap-[2px]" aria-label={`${r.text}, last ${STRIP} days`}>
        {strip.map((key) => {
          const due = isDue(r, key);
          const done = r.done.includes(key);
          return (
            <button
              key={key}
              disabled={!due}
              onClick={() => toggle(key)}
              title={`${fromKey(key).toDateString()}${due ? (done ? ' · done' : ' · not done') : ' · not scheduled'}`}
              aria-label={`${r.text} on ${key}: ${due ? (done ? 'done' : 'not done') : 'not scheduled'}`}
              aria-pressed={due ? done : undefined}
              className={`h-4 w-3 rounded-sm transition-colors ${
                done
                  ? 'bg-accent'
                  : due
                    ? `border ${key === today ? 'border-accent' : 'border-edge'} hover:bg-accent/30`
                    : 'opacity-30'
              }`}
            >
              {!due && <span className="mx-auto block h-1 w-1 rounded-full bg-body-muted" />}
            </button>
          );
        })}
      </div>
      <div className="flex w-12 items-center justify-end gap-1 text-xs tabular-nums" title="Current streak">
        <Flame size={12} className={s ? 'text-term-amber' : 'text-body-muted'} />
        {s}
      </div>
      <button
        onClick={remove}
        aria-label={`Delete ${r.text}`}
        className="text-body-muted opacity-0 transition-opacity hover:text-accent-hover focus:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
