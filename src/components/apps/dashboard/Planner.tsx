import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelRightOpen, Plus } from 'lucide-react';
import { agendaFor, btn, btnPrimary, CheckRow, input, PanelClose, useActions } from './shared';
import { useCalendarDrag } from './calendar/useCalendarDrag';
import TimeGrid, { type Draft } from './calendar/TimeGrid';
import MonthGrid from './calendar/MonthGrid';
import { useEditor } from './calendar/EditorHost';
import Splitter from './Splitter';
import {
  addDays,
  addMonths,
  DAY_MINUTES,
  fromKey,
  fromTimeInput,
  startOfWeek,
  todayKey,
  type DashData,
} from '../../../lib/dashboard/model';

export type View = 'day' | 'week' | 'month';

/** Lives in Dashboard so it survives layout switches and panel moves */
export interface PlannerState {
  view: View;
  setView: (v: View) => void;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
}

function title(view: View, key: string): string {
  const d = fromKey(key);
  if (view === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (view === 'day')
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const start = fromKey(startOfWeek(key));
  const end = fromKey(addDays(startOfWeek(key), 6));
  const fmt = (x: Date) => x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

/** Calendar with toolbar: Day/Week hour grid or Month grid, with drag & drop */
export function CalendarPanel({
  data,
  state,
  toolbarExtra,
}: {
  data: DashData;
  state: PlannerState;
  toolbarExtra?: React.ReactNode;
}) {
  const { view, setView, selected, setSelected } = state;
  const [draft, setDraft] = useState<Draft | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { addTodo, moveTodo, patchTodo } = useActions();
  const editor = useEditor();

  const drag = useCalendarDrag({
    scroller,
    onMove: (id, date, start, end) => {
      moveTodo(id, date, start, end);
      setSelected(date);
    },
    onResize: (id, end) => patchTodo(id, { end }),
    onCreate: (date, start, end) => {
      editor.close();
      setDraft({ date, start, end });
    },
    onClickTodo: (todo, el) => {
      setDraft(null);
      editor.open(todo.id, el);
    },
  });

  const step = (n: number) =>
    setSelected((k) => (view === 'month' ? addMonths(k, n) : addDays(k, view === 'week' ? 7 * n : n)));
  const days = view === 'day' ? [selected] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selected), i));

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
        <button className={btn} onClick={() => step(-1)} aria-label={`Previous ${view}`}>
          <ChevronLeft size={14} />
        </button>
        <button className={btn} onClick={() => step(1)} aria-label={`Next ${view}`}>
          <ChevronRight size={14} />
        </button>
        <button className={btn} onClick={() => setSelected(todayKey())}>
          Today
        </button>
        {/* min width: a narrow calendar wraps its toolbar rather than eliding the date */}
        <h2 className="ml-1 min-w-[11rem] flex-1 truncate text-sm font-bold">{title(view, selected)}</h2>
        {toolbarExtra}
        <div className="flex overflow-hidden rounded border border-edge" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                view === v ? 'bg-accent text-accent-contrast' : 'hover:bg-accent/20'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${view === 'month' ? 'overflow-auto p-3' : ''}`}>
        {view === 'month' ? (
          <MonthGrid data={data} selected={selected} onSelect={setSelected} drag={drag} />
        ) : (
          <TimeGrid
            data={data}
            days={days}
            selected={selected}
            onSelect={setSelected}
            drag={drag}
            draft={draft}
            scroller={scroller}
            onOpen={(t, el) => editor.open(t.id, el)}
            onDraftDone={(text) => {
              if (text && draft) addTodo(text, draft.date, draft.start, draft.end);
              setDraft(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Tab layout: calendar + resizable, closable day list side by side */
export default function Planner({
  data,
  state,
  day,
}: {
  data: DashData;
  state: PlannerState;
  day: {
    open: boolean;
    setOpen: (open: boolean) => void;
    width: number;
    max: number;
    setWidth: (v: number) => void;
    resetWidth: () => void;
  };
}) {
  return (
    <div className="flex h-full min-h-0">
      <CalendarPanel
        data={data}
        state={state}
        toolbarExtra={
          !day.open && (
            <button
              className={`${btn} flex items-center gap-1`}
              onClick={() => day.setOpen(true)}
              aria-label="Show day list"
              title="Show day list"
            >
              <PanelRightOpen size={13} />
            </button>
          )
        }
      />
      {day.open && (
        <>
          <Splitter
            axis="x"
            invert
            value={day.width}
            min={180}
            max={day.max}
            onChange={day.setWidth}
            onReset={day.resetWidth}
            label="Resize day list"
          />
          <DayPanel data={data} state={state} width={day.width} onClose={() => day.setOpen(false)} />
        </>
      )}
    </div>
  );
}

/** The selected day's agenda + quick add. `nav` adds day arrows (no calendar beside it). */
export function DayPanel({
  data,
  state,
  width,
  onClose,
  nav = false,
}: {
  data: DashData;
  state: PlannerState;
  /** Fixed width beside the calendar; undefined = fill its container */
  width?: number;
  onClose?: () => void;
  nav?: boolean;
}) {
  const { selected: date, setSelected } = state;
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const { addTodo } = useActions();
  const editor = useEditor();
  const items = agendaFor(data, date);
  const done = items.filter((i) => i.done).length;
  const d = fromKey(date);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const start = fromTimeInput(time);
    if (start === null) addTodo(text.trim(), date);
    else addTodo(text.trim(), date, start, Math.min(start + 60, DAY_MINUTES));
    setText('');
    setTime('');
  };

  return (
    <aside
      style={{ width }}
      className={`flex h-full min-h-0 flex-col ${width === undefined ? 'min-w-0 flex-1' : 'shrink-0'}`}
      aria-label="Selected day"
    >
      <div className="px-4 pb-2 pt-3">
        <div className="flex items-center justify-between gap-1">
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold">
            {d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          {nav && (
            <>
              <button className={`${btn} px-1.5`} onClick={() => setSelected((k) => addDays(k, -1))} aria-label="Previous day">
                <ChevronLeft size={12} />
              </button>
              <button className={`${btn} px-1.5`} onClick={() => setSelected(todayKey())}>
                Today
              </button>
              <button className={`${btn} px-1.5`} onClick={() => setSelected((k) => addDays(k, 1))} aria-label="Next day">
                <ChevronRight size={12} />
              </button>
            </>
          )}
          {onClose && <PanelClose name="day list" onClose={onClose} />}
        </div>
        <p className="text-[11px] text-body-muted">
          {items.length ? `${done} of ${items.length} done` : 'Nothing planned'}
        </p>
        {items.length > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-edge">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>
      <form onSubmit={submit} className="space-y-1.5 px-4 pb-2">
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a todo…"
            aria-label="New todo"
            className={`${input} flex-1`}
          />
          <button type="submit" className={btnPrimary} disabled={!text.trim()} aria-label="Add todo">
            <Plus size={14} />
          </button>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-body-muted">
          at
          <input
            type="time"
            step={900}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time (optional)"
            className={`${input} flex-1 py-0.5`}
          />
          <span>{time ? '1h block' : 'all-day'}</span>
        </label>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {items.map((i) => (
          <CheckRow key={i.id} item={i} date={date} onOpen={editor.open} />
        ))}
      </div>
    </aside>
  );
}
