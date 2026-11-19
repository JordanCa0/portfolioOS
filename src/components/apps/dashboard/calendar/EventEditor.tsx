import { useEffect, useRef } from 'react';
import { Check, Clock, Trash2, X } from 'lucide-react';
import { btn, input, isTimed, useActions } from '../shared';
import { DAY_MINUTES, fromTimeInput, toTimeInput, type Todo } from '../../../../lib/dashboard/model';

/** Google-Calendar-style quick editor for one todo, anchored where it was clicked */
export default function EventEditor({
  todo,
  pos,
  onClose,
}: {
  todo: Todo;
  pos: { x: number; y: number };
  onClose: () => void;
}) {
  const { patchTodo, removeTodo } = useActions();
  const ref = useRef<HTMLDivElement>(null);
  const timed = isTimed(todo);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Next tick, so the click that opened the editor doesn't close it
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const setStart = (v: string) => {
    const s = fromTimeInput(v);
    if (s === null) return;
    // Keep the duration when the start moves
    const len = timed ? todo.end! - todo.start! : 60;
    patchTodo(todo.id, { start: s, end: Math.min(s + len, DAY_MINUTES) });
  };
  const setEnd = (v: string) => {
    const e = fromTimeInput(v);
    if (e !== null && e > todo.start!) patchTodo(todo.id, { end: e });
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Edit ${todo.text}`}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-50 w-64 space-y-2 rounded-lg border border-edge bg-glass p-3 shadow-2xl backdrop-blur-glass"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={todo.text}
          onChange={(e) => patchTodo(todo.id, { text: e.target.value })}
          aria-label="Title"
          className={`${input} flex-1 text-sm font-bold`}
        />
        <button onClick={onClose} aria-label="Close editor" className="text-body-muted hover:text-body">
          <X size={14} />
        </button>
      </div>
      <input
        type="date"
        value={todo.date}
        onChange={(e) => e.target.value && patchTodo(todo.id, { date: e.target.value })}
        aria-label="Date"
        className={`${input} w-full`}
      />
      {timed ? (
        <div className="flex items-center gap-1.5">
          <input type="time" step={900} value={toTimeInput(todo.start!)} onChange={(e) => setStart(e.target.value)} aria-label="Start time" className={`${input} flex-1`} />
          <span className="text-xs text-body-muted">–</span>
          <input type="time" step={900} value={toTimeInput(todo.end! % DAY_MINUTES)} onChange={(e) => setEnd(e.target.value)} aria-label="End time" className={`${input} flex-1`} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          className={`${btn} flex items-center gap-1`}
          onClick={() => patchTodo(todo.id, { done: !todo.done })}
          aria-pressed={todo.done}
        >
          <Check size={12} /> {todo.done ? 'Done' : 'Mark done'}
        </button>
        <button
          className={`${btn} flex items-center gap-1`}
          onClick={() =>
            timed
              ? patchTodo(todo.id, { start: undefined, end: undefined })
              : patchTodo(todo.id, { start: 9 * 60, end: 10 * 60 })
          }
        >
          <Clock size={12} /> {timed ? 'Make all-day' : 'Add time'}
        </button>
        <button
          className={`${btn} ml-auto flex items-center gap-1 hover:text-accent-hover`}
          onClick={() => {
            removeTodo(todo.id);
            onClose();
          }}
          aria-label={`Delete ${todo.text}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
