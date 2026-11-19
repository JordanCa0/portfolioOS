import { Check, Repeat, X } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { formatTime, isDue, uid, type DashData, type Todo } from '../../../lib/dashboard/model';

export const btn =
  'rounded border border-edge px-2.5 py-1 text-xs transition-colors hover:bg-accent/20 disabled:opacity-40 disabled:hover:bg-transparent';
export const btnPrimary =
  'rounded bg-accent px-3 py-1 text-xs text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-40';
export const input =
  'min-w-0 rounded border border-edge bg-transparent px-2 py-1 text-xs outline-none placeholder:text-body-muted focus:border-accent';

/** One row in a day's agenda: a todo or a recurring task due that day */
export interface AgendaItem {
  kind: 'todo' | 'recurring';
  id: string;
  text: string;
  done: boolean;
  start?: number;
  end?: number;
}

export const isTimed = (t: { start?: number; end?: number }) =>
  t.start !== undefined && t.end !== undefined;

/** Timed todos by start time, then all-day todos, then recurring tasks */
export function agendaFor(data: DashData, key: string): AgendaItem[] {
  const todos = data.todos
    .filter((t) => t.date === key)
    .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
  return [
    ...todos.map(
      (t): AgendaItem => ({ kind: 'todo', id: t.id, text: t.text, done: t.done, start: t.start, end: t.end }),
    ),
    ...data.recurring
      .filter((r) => isDue(r, key))
      .map((r): AgendaItem => ({ kind: 'recurring', id: r.id, text: r.text, done: r.done.includes(key) })),
  ];
}

export function useActions() {
  const { update } = useDashboard();
  const patchTodo = (id: string, patch: Partial<Todo>) =>
    update((d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  return {
    addTodo: (text: string, date: string, start?: number, end?: number) =>
      update((d) => ({
        ...d,
        todos: [...d.todos, { id: uid(), text, date, done: false, ...(start !== undefined && end !== undefined ? { start, end } : {}) }],
      })),
    patchTodo,
    /** Move to a day; null times make it an all-day todo */
    moveTodo: (id: string, date: string, start: number | null, end: number | null) =>
      patchTodo(id, { date, start: start ?? undefined, end: end ?? undefined }),
    toggle: (item: AgendaItem, date: string) =>
      update((d) =>
        item.kind === 'todo'
          ? { ...d, todos: d.todos.map((t) => (t.id === item.id ? { ...t, done: !t.done } : t)) }
          : {
              ...d,
              recurring: d.recurring.map((r) =>
                r.id !== item.id
                  ? r
                  : {
                      ...r,
                      done: r.done.includes(date)
                        ? r.done.filter((k) => k !== date)
                        : [...r.done, date],
                    },
              ),
            },
      ),
    removeTodo: (id: string) => update((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) })),
  };
}

/** The X that closes a dashboard panel (reopen it from the header toggles) */
export function PanelClose({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label={`Close ${name}`}
      title={`Close ${name}`}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-body-muted transition-colors hover:bg-accent/20 hover:text-body"
    >
      <X size={13} />
    </button>
  );
}

export function CheckBox({
  done,
  label,
  onToggle,
  small = false,
}: {
  done: boolean;
  label: string;
  onToggle: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // Don't start a calendar drag from the checkbox
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`${done ? 'Uncheck' : 'Check'} ${label}`}
      aria-pressed={done}
      className={`flex shrink-0 items-center justify-center rounded border transition-colors ${
        small ? 'h-3 w-3' : 'h-4 w-4'
      } ${done ? 'border-accent bg-accent text-accent-contrast' : 'border-edge bg-glass hover:border-accent'}`}
    >
      {done && <Check size={small ? 9 : 12} strokeWidth={3} />}
    </button>
  );
}

export function CheckRow({
  item,
  date,
  onOpen,
}: {
  item: AgendaItem;
  date: string;
  /** Todos: open the editor (clicking the text) */
  onOpen?: (id: string, el: HTMLElement) => void;
}) {
  const { toggle, removeTodo } = useActions();
  const time = isTimed(item) ? formatTime(item.start!) : null;
  return (
    <div className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent/10">
      <CheckBox done={item.done} label={item.text} onToggle={() => toggle(item, date)} />
      {time && <span className="shrink-0 text-[10px] tabular-nums text-body-muted">{time}</span>}
      <span
        className={`min-w-0 flex-1 truncate text-xs ${item.done ? 'text-body-muted line-through' : ''} ${
          onOpen && item.kind === 'todo' ? 'cursor-pointer' : ''
        }`}
        title={item.text}
        onClick={(e) => item.kind === 'todo' && onOpen?.(item.id, e.currentTarget)}
      >
        {item.text}
      </span>
      {item.kind === 'recurring' && <Repeat size={12} className="shrink-0 text-accent-soft" aria-label="recurring" />}
      {item.kind === 'todo' && (
        <button
          onClick={() => removeTodo(item.id)}
          aria-label={`Delete ${item.text}`}
          className="shrink-0 text-body-muted opacity-0 transition-opacity hover:text-accent-hover focus:opacity-100 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
