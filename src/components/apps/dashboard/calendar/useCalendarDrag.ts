/**
 * Pointer-driven drag for the calendar (no HTML5 DnD: it can't render a
 * live, snapped preview). Drop targets are plain elements tagged with
 * data-drop-date + data-drop-zone:
 *   time  — an hour column; the drop gets a start time from the pointer's y
 *   day   — the all-day row; the drop becomes an all-day todo
 *   month — a month cell; the drop keeps its time, changes only the date
 * Events render inside their drop target, so elementFromPoint(...).closest()
 * resolves correctly even with the dragged item under the pointer.
 */
import { useCallback, useRef, useState } from 'react';
import { DAY_MINUTES, type Todo } from '../../../../lib/dashboard/model';

export const HOUR_PX = 44;
const SNAP = 15;
export const DEFAULT_LEN = 60;
/** Pointer travel before a press becomes a drag (a smaller one is a click) */
const DRAG_THRESHOLD = 4;

export type Zone = 'time' | 'day' | 'month';

export interface Preview {
  kind: 'move' | 'resize' | 'create';
  /** The todo being moved/resized */
  id?: string;
  zone: Zone;
  date: string;
  start: number | null;
  end: number | null;
}

interface Session {
  kind: Preview['kind'];
  todo?: Todo;
  /** Hour column the press started in (create/resize stay in it) */
  col?: HTMLElement;
  date: string;
  /** Minutes between the block's top and the pointer, for moves */
  grab: number;
  /** create: the minute pressed */
  anchor: number;
  x0: number;
  y0: number;
  moved: boolean;
}

const snap = (m: number, step = SNAP) => Math.round(m / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function minuteAt(col: HTMLElement, clientY: number): number {
  return ((clientY - col.getBoundingClientRect().top) / HOUR_PX) * 60;
}

function targetAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-date]');
  if (!el) return null;
  return { el, date: el.dataset.dropDate!, zone: el.dataset.dropZone as Zone };
}

export interface DragHandlers {
  preview: Preview | null;
  /** pointerdown on an existing todo (block, chip) */
  startMove: (e: React.PointerEvent, todo: Todo, col?: HTMLElement) => void;
  /** pointerdown on a block's bottom edge */
  startResize: (e: React.PointerEvent, todo: Todo, col: HTMLElement) => void;
  /** pointerdown on empty space in an hour column */
  startCreate: (e: React.PointerEvent, date: string, col: HTMLElement) => void;
}

export function useCalendarDrag(opts: {
  onMove: (id: string, date: string, start: number | null, end: number | null) => void;
  onResize: (id: string, end: number) => void;
  /** Drag-created or click-created block, ready for a title */
  onCreate: (date: string, start: number, end: number) => void;
  /** Press on a todo that never became a drag */
  onClickTodo: (todo: Todo, el: HTMLElement) => void;
  /** Hour-grid scroller, auto-scrolled while dragging near its edges */
  scroller?: React.RefObject<HTMLElement>;
}): DragHandlers {
  const [preview, setPreview] = useState<Preview | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback((e: React.PointerEvent, s: Session, source: HTMLElement) => {
    if (e.button !== 0) return;
    // Blocks sit inside hour columns: don't let a block press also start a
    // create. (No preventDefault: the window needs its mousedown to focus;
    // the calendar is select-none instead.)
    e.stopPropagation();
    let last: Preview | null = null;

    const compute = (x: number, y: number): Preview | null => {
      if (s.kind === 'create' || s.kind === 'resize') {
        const m = clamp(snap(minuteAt(s.col!, y)), 0, DAY_MINUTES);
        if (s.kind === 'resize') {
          const start = s.todo!.start!;
          return { kind: 'resize', id: s.todo!.id, zone: 'time', date: s.date, start, end: Math.max(start + SNAP, m) };
        }
        const a = s.anchor;
        const [start, end] = m >= a ? [a, Math.max(m, a + SNAP)] : [m, a];
        return { kind: 'create', zone: 'time', date: s.date, start, end };
      }
      const t = targetAt(x, y);
      if (!t) return last;
      const todo = s.todo!;
      const timed = todo.start !== undefined && todo.end !== undefined;
      const len = timed ? todo.end! - todo.start! : DEFAULT_LEN;
      if (t.zone === 'time') {
        const start = clamp(snap(minuteAt(t.el, y) - s.grab), 0, DAY_MINUTES - len);
        return { kind: 'move', id: todo.id, zone: 'time', date: t.date, start, end: start + len };
      }
      if (t.zone === 'month') {
        return { kind: 'move', id: todo.id, zone: 'month', date: t.date, start: todo.start ?? null, end: todo.end ?? null };
      }
      return { kind: 'move', id: todo.id, zone: 'day', date: t.date, start: null, end: null };
    };

    const onMove = (ev: PointerEvent) => {
      if (!s.moved) {
        if (Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0) < DRAG_THRESHOLD) return;
        s.moved = true;
        document.body.style.cursor = s.kind === 'resize' ? 'ns-resize' : 'grabbing';
      }
      // Nudge the hour grid when dragging near its top/bottom edge
      const sc = optsRef.current.scroller?.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (ev.clientY < r.top + 40) sc.scrollTop -= 12;
        else if (ev.clientY > r.bottom - 30) sc.scrollTop += 12;
      }
      last = compute(ev.clientX, ev.clientY);
      setPreview(last);
    };

    const finish = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      document.body.style.cursor = '';
      setPreview(null);
      const o = optsRef.current;
      if (!s.moved) {
        if (s.kind === 'create') {
          // A click books an hour at the half-hour pressed
          const start = clamp(Math.floor(s.anchor / 30) * 30, 0, DAY_MINUTES - DEFAULT_LEN);
          o.onCreate(s.date, start, start + DEFAULT_LEN);
        } else if (s.todo) o.onClickTodo(s.todo, source);
        return;
      }
      const p = compute(ev.clientX, ev.clientY) ?? last;
      if (!p) return;
      if (p.kind === 'move') o.onMove(p.id!, p.date, p.start, p.end);
      else if (p.kind === 'resize') o.onResize(p.id!, p.end!);
      else o.onCreate(p.date, p.start!, p.end!);
    };

    const cancel = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      document.body.style.cursor = '';
      setPreview(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
  }, []);

  const base = (e: React.PointerEvent) => ({ x0: e.clientX, y0: e.clientY, moved: false });

  return {
    preview,
    startMove: (e, todo, col) =>
      run(
        e,
        {
          kind: 'move',
          todo,
          date: todo.date,
          grab: col && todo.start !== undefined ? minuteAt(col, e.clientY) - todo.start : 0,
          anchor: 0,
          ...base(e),
        },
        e.currentTarget as HTMLElement,
      ),
    startResize: (e, todo, col) =>
      run(e, { kind: 'resize', todo, col, date: todo.date, grab: 0, anchor: 0, ...base(e) }, e.currentTarget as HTMLElement),
    startCreate: (e, date, col) =>
      run(
        e,
        { kind: 'create', col, date, grab: 0, anchor: clamp(snap(minuteAt(col, e.clientY)), 0, DAY_MINUTES), ...base(e) },
        e.currentTarget as HTMLElement,
      ),
  };
}
