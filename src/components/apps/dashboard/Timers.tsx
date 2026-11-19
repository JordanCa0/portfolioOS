import { useEffect, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { btn, btnPrimary, input } from './shared';
import { formatDuration, uid, type DashData, type Timer } from '../../../lib/dashboard/model';

const PRESETS = [5, 15, 25, 50];

const left = (t: Timer, now: number) => (t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remaining);

export default function Timers({
  data,
  compact = false,
}: {
  data: DashData;
  /** Inside a tile frame (which shows the title): tighter, cards reflow with width */
  compact?: boolean;
}) {
  const { update } = useDashboard();
  const [now, setNow] = useState(Date.now);
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState('25');

  const running = data.timers.some((t) => t.endsAt !== null);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const setTimer = (id: string, fn: (t: Timer) => Timer) =>
    update((d) => ({ ...d, timers: d.timers.map((t) => (t.id === id ? fn(t) : t)) }));

  const add = (mins: number, name = label.trim()) => {
    if (!(mins > 0)) return;
    const duration = Math.round(mins * 60_000);
    update((d) => ({
      ...d,
      timers: [...d.timers, { id: uid(), label: name || `${mins} min`, duration, remaining: duration, endsAt: null }],
    }));
    setLabel('');
  };

  const toggle = (t: Timer) => {
    const at = Date.now();
    setNow(at);
    setTimer(t.id, (x) =>
      x.endsAt !== null
        ? { ...x, remaining: Math.max(0, x.endsAt - at), endsAt: null }
        : { ...x, endsAt: at + (x.remaining > 0 ? x.remaining : x.duration), remaining: x.remaining || x.duration },
    );
  };

  return (
    <div className={compact ? 'space-y-3 p-3' : 'h-full space-y-4 overflow-y-auto p-4'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(Number(minutes));
        }}
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-edge p-3"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          aria-label="Timer label"
          className={`${input} ${compact ? 'w-full' : 'w-44'}`}
        />
        <input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          type="number"
          min={0.1}
          step="any"
          aria-label="Minutes"
          className={`${input} w-16 tabular-nums`}
        />
        <span className="text-xs text-body-muted">min</span>
        <button type="submit" className={`${btnPrimary} flex items-center gap-1`} disabled={!(Number(minutes) > 0)}>
          <Plus size={12} /> Add timer
        </button>
        <span className="ml-auto flex gap-1">
          {PRESETS.map((m) => (
            <button key={m} type="button" className={btn} onClick={() => add(m)}>
              {m}m
            </button>
          ))}
        </span>
      </form>

      {data.timers.length === 0 && (
        <p className={`${compact ? 'py-2' : 'py-8'} text-center text-xs text-body-muted`}>
          No timers. Add one above, or tap a preset. Timers keep running while you use other windows.
        </p>
      )}

      {/* Cards flow into more columns as the timers pane is widened */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-[repeat(auto-fill,minmax(170px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'}`}>
        {data.timers.map((t) => {
          const ms = left(t, now);
          const isRunning = t.endsAt !== null;
          const finished = !isRunning && t.remaining === 0;
          return (
            <div
              key={t.id}
              className={`group rounded-lg border transition-colors ${compact ? 'p-3' : 'p-4'} ${
                finished ? 'border-accent bg-accent/15' : 'border-edge bg-chrome'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-xs text-body-muted" title={t.label}>
                  {t.label}
                </p>
                <button
                  onClick={() => update((d) => ({ ...d, timers: d.timers.filter((x) => x.id !== t.id) }))}
                  aria-label={`Delete timer ${t.label}`}
                  className="text-body-muted opacity-0 transition-opacity hover:text-accent-hover focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className={`font-bold tabular-nums ${compact ? 'my-1 text-xl' : 'my-2 text-3xl'}`} aria-live={finished ? 'assertive' : 'off'}>
                {finished ? "Time's up" : formatDuration(ms)}
              </p>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-edge">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(1 - ms / t.duration) * 100}%` }} />
              </div>
              <div className="flex gap-1.5">
                <button
                  className={`${isRunning ? btn : btnPrimary} flex items-center gap-1`}
                  onClick={() => toggle(t)}
                >
                  {isRunning ? <Pause size={12} /> : <Play size={12} />}
                  {isRunning ? 'Pause' : finished ? 'Restart' : ms < t.duration ? 'Resume' : 'Start'}
                </button>
                <button
                  className={`${btn} flex items-center gap-1`}
                  onClick={() => setTimer(t.id, (x) => ({ ...x, remaining: x.duration, endsAt: null }))}
                  disabled={!isRunning && ms === t.duration}
                  aria-label={`Reset ${t.label}`}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
