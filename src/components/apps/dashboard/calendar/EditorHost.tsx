import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import EventEditor from './EventEditor';
import type { DashData } from '../../../../lib/dashboard/model';

interface EditorApi {
  /** Open the todo editor beside `el` (anywhere in the dashboard) */
  open: (id: string, el: HTMLElement) => void;
  close: () => void;
}

const Ctx = createContext<EditorApi>({ open: () => {}, close: () => {} });
export const useEditor = () => useContext(Ctx);

const W = 256;

/**
 * Hosts the one todo editor for the whole dashboard, so the calendar and the
 * day list can live in separate, rearrangeable panels and still share it.
 */
export function EditorHost({ data, children }: { data: DashData; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ id: string; x: number; y: number } | null>(null);

  const open = useCallback((id: string, el: HTMLElement) => {
    const root = ref.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let x = r.right - root.left + 6;
    if (x + W > root.width - 4) x = r.left - root.left - W - 6;
    const y = Math.min(Math.max(r.top - root.top, 4), root.height - 220);
    setEditing({ id, x: Math.max(4, x), y: Math.max(4, y) });
  }, []);
  const close = useCallback(() => setEditing(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);
  const todo = editing && data.todos.find((t) => t.id === editing.id);

  return (
    <Ctx.Provider value={api}>
      <div ref={ref} className="relative flex min-h-0 flex-1 flex-col">
        {children}
        {todo && <EventEditor todo={todo} pos={editing} onClose={close} />}
      </div>
    </Ctx.Provider>
  );
}
