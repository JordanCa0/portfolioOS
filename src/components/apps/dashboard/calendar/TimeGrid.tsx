import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Repeat } from 'lucide-react';
import { agendaFor, CheckBox, isTimed, useActions } from '../shared';
import { HOUR_PX, type DragHandlers } from './useCalendarDrag';
import {
  DAY_MINUTES,
  DAY_SHORT,
  formatTime,
  fromKey,
  todayKey,
  type DashData,
  type Todo,
} from '../../../../lib/dashboard/model';

export interface Draft {
  date: string;
  start: number;
  end: number;
}

interface Props {
  data: DashData;
  days: string[];
  selected: string;
  onSelect: (date: string) => void;
  drag: DragHandlers;
  draft: Draft | null;
  onDraftDone: (text: string | null) => void;
  onOpen: (todo: Todo, el: HTMLElement) => void;
  scroller: React.RefObject<HTMLDivElement>;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const top = (min: number) => (min / 60) * HOUR_PX;
const height = (start: number, end: number) => Math.max(top(end - start) - 2, 16);
const timeRange = (s: number, e: number) => `${formatTime(s)} – ${formatTime(e)}`;

/** Side-by-side columns for overlapping blocks, like Google Calendar */
function layout(events: Todo[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  const sorted = [...events].sort((a, b) => a.start! - b.start! || b.end! - a.end!);
  let cluster: Todo[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const e of cluster) out.get(e.id)!.cols = colEnds.length;
    cluster = [];
    colEnds = [];
  };
  for (const e of sorted) {
    if (e.start! >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= e.start!);
    if (col === -1) col = colEnds.push(0) - 1;
    colEnds[col] = e.end!;
    out.set(e.id, { col, cols: 1 });
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end!);
  }
  flush();
  return out;
}

function useNowMinutes() {
  const get = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(get);
  useEffect(() => {
    const id = setInterval(() => setNow(get()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const colOf = (el: Element) => el.closest<HTMLElement>('[data-drop-zone="time"]')!;

export default function TimeGrid({ data, days, selected, onSelect, drag, draft, onDraftDone, onOpen, scroller }: Props) {
  const { toggle } = useActions();
  const today = todayKey();
  const now = useNowMinutes();
  const { preview } = drag;
  const cols = `3.25rem repeat(${days.length}, minmax(0, 1fr))`;

  // Open scrolled to the working day (or just above "now" when it's today)
  useLayoutEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const hour = days.includes(today) ? Math.max(0, Math.floor(now / 60) - 2) : 7;
    sc.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, days[0]]);

  return (
    <div ref={scroller} className="relative h-full select-none overflow-y-auto" data-testid="time-grid">
      {/* Day headers + all-day row stay pinned while the hours scroll */}
      <div className="sticky top-0 z-30 border-b border-edge bg-chrome backdrop-blur-glass">
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((key) => {
            const d = fromKey(key);
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                aria-label={d.toDateString()}
                className={`flex flex-col items-center py-1 transition-colors hover:bg-accent/10 ${
                  key === selected ? 'bg-accent/10' : ''
                }`}
              >
                <span className={`text-[10px] uppercase ${key === today ? 'text-accent' : 'text-body-muted'}`}>
                  {DAY_SHORT[d.getDay()]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    key === today ? 'bg-accent font-bold text-accent-contrast' : ''
                  }`}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid border-t border-edge" style={{ gridTemplateColumns: cols }}>
          <div className="self-center pr-1.5 text-right text-[9px] uppercase text-body-muted">all-day</div>
          {days.map((key) => {
            const items = agendaFor(data, key).filter((i) => !isTimed(i));
            const over = preview?.kind === 'move' && preview.zone === 'day' && preview.date === key;
            return (
              <div
                key={key}
                data-drop-date={key}
                data-drop-zone="day"
                className={`max-h-24 min-h-7 space-y-0.5 overflow-y-auto border-l border-edge p-0.5 transition-colors ${
                  over ? 'bg-accent/20' : ''
                }`}
              >
                {items.map((i) => {
                  const todo = i.kind === 'todo' ? data.todos.find((t) => t.id === i.id)! : null;
                  return (
                    <div
                      key={i.id}
                      onPointerDown={todo ? (e) => drag.startMove(e, todo) : undefined}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${
                        i.kind === 'todo' ? 'cursor-grab bg-accent/20' : 'bg-chrome'
                      } ${preview?.id === i.id ? 'opacity-40' : ''}`}
                      title={i.text}
                    >
                      <CheckBox small done={i.done} label={i.text} onToggle={() => toggle(i, key)} />
                      <span className={`min-w-0 flex-1 truncate ${i.done ? 'text-body-muted line-through' : ''}`}>
                        {i.text}
                      </span>
                      {i.kind === 'recurring' && <Repeat size={9} className="shrink-0 text-accent-soft" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR_PX }}>
        <div className="relative">
          {HOURS.slice(1).map((h) => (
            <span
              key={h}
              className="absolute right-1.5 -translate-y-1/2 text-[9px] tabular-nums text-body-muted"
              style={{ top: h * HOUR_PX }}
            >
              {formatTime(h * 60).replace(':00', '')}
            </span>
          ))}
        </div>
        {days.map((key) => {
          const events = data.todos.filter((t) => t.date === key && isTimed(t));
          const pos = layout(events);
          const ghost = preview && preview.zone === 'time' && preview.date === key && preview.kind !== 'resize';
          return (
            <div
              key={key}
              data-drop-date={key}
              data-drop-zone="time"
              aria-label={`${fromKey(key).toDateString()} hours`}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) drag.startCreate(e, key, e.currentTarget);
              }}
              className={`relative cursor-cell border-l border-edge ${key === today ? 'bg-accent/[0.04]' : ''}`}
              style={{
                backgroundImage: 'linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
                backgroundSize: `100% ${HOUR_PX}px`,
              }}
            >
              {events.map((t) => {
                const p = pos.get(t.id)!;
                const end = preview?.kind === 'resize' && preview.id === t.id ? preview.end! : t.end!;
                const h = height(t.start!, end);
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.text}, ${timeRange(t.start!, end)}`}
                    onPointerDown={(e) => drag.startMove(e, t, colOf(e.currentTarget))}
                    onKeyDown={(e) => e.key === 'Enter' && onOpen(t, e.currentTarget)}
                    className={`group absolute z-10 cursor-grab overflow-hidden rounded-md border-l-[3px] border-accent px-1.5 py-0.5 text-[11px] leading-tight shadow-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent ${
                      t.done ? 'bg-accent/10 text-body-muted' : 'bg-accent/25'
                    } ${preview?.kind === 'move' && preview.id === t.id ? 'opacity-40' : ''}`}
                    style={{
                      top: top(t.start!),
                      height: h,
                      left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                      width: `calc(${100 / p.cols}% - 4px)`,
                    }}
                  >
                    <div className="flex items-start gap-1">
                      <span className={`min-w-0 flex-1 truncate font-bold ${t.done ? 'line-through' : ''}`}>{t.text}</span>
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">
                        <CheckBox
                          small
                          done={t.done}
                          label={t.text}
                          onToggle={() => toggle({ kind: 'todo', id: t.id, text: t.text, done: t.done }, key)}
                        />
                      </span>
                    </div>
                    {h > 30 && <div className="truncate text-[10px] opacity-80">{timeRange(t.start!, end)}</div>}
                    <div
                      aria-hidden="true"
                      onPointerDown={(e) => drag.startResize(e, t, colOf(e.currentTarget))}
                      className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                    />
                  </div>
                );
              })}

              {ghost && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md border border-dashed border-accent bg-accent/30 px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ top: top(preview.start!), height: height(preview.start!, preview.end!) }}
                >
                  {timeRange(preview.start!, preview.end!)}
                </div>
              )}

              {draft?.date === key && <DraftBlock draft={draft} onDone={onDraftDone} />}

              {key === today && (
                <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-accent-hover" style={{ top: top(now) }}>
                  <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-accent-hover" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftBlock({ draft, onDone: done }: { draft: Draft; onDone: (text: string | null) => void }) {
  // Enter both submits and unmounts (→ blur); only the first one counts
  const finished = useRef(false);
  const onDone = (t: string | null) => {
    if (finished.current) return;
    finished.current = true;
    done(t);
  };
  const [text, setText] = useState('');
  return (
    <div
      className="absolute inset-x-0.5 z-20 rounded-md border-l-[3px] border-accent bg-accent/40 px-1.5 py-0.5 shadow-lg"
      style={{ top: top(draft.start), minHeight: height(draft.start, Math.min(draft.end, DAY_MINUTES)) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onDone(text.trim() || null);
          if (e.key === 'Escape') onDone(null);
        }}
        onBlur={() => onDone(text.trim() || null)}
        placeholder="Add title"
        aria-label="New event title"
        className="w-full bg-transparent text-[11px] font-bold outline-none placeholder:text-body-muted"
      />
      <div className="text-[10px] opacity-80">{timeRange(draft.start, draft.end)}</div>
    </div>
  );
}
