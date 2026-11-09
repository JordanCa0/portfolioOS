import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlog, type Blog } from '../../../lib/blog/useBlog';
import Dialogs, { type DialogState } from './Dialogs';
import type { UI } from './ui';

interface BlogContextValue {
  blog: Blog;
  ui: UI;
  /** Phone layout: single tap opens, no split view */
  compact: boolean;
  openFile: (path: string, edit?: boolean) => void;
  setDirty: (key: string, dirty: boolean) => void;
  /** Resolves true when the window `key` can close (asks first if it has unsaved edits). */
  confirmClose: (key: string, name: string) => Promise<boolean>;
}

const Ctx = createContext<BlogContextValue | null>(null);

export function useBlogContext(): BlogContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('Blog components must sit inside <BlogProvider>');
  return v;
}

interface ProviderProps {
  compact: boolean;
  openFile: (path: string, edit?: boolean) => void;
  /** A file or folder was renamed: open windows should follow it */
  onMoved: (from: string, to: string) => void;
  /** A file or folder was deleted: close windows showing it */
  onRemoved: (path: string) => void;
  children: ReactNode;
}

/**
 * One blog store shared by the Blog explorer and every Notepad window, plus
 * the dialogs and toasts they use.
 */
export function BlogProvider({ compact, openFile, onMoved, onRemoved, children }: ProviderProps) {
  const raw = useBlog();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; kind: 'ok' | 'error' }>>([]);
  const dirty = useRef(new Set<string>());

  const ui: UI = useMemo(
    () => ({
      prompt: (title, opts) =>
        new Promise((resolve) =>
          setDialog({ kind: 'prompt', title, initial: opts?.initial ?? '', confirm: opts?.confirm ?? 'OK', resolve }),
        ),
      confirm: (title, body, confirm = 'OK') =>
        new Promise((resolve) => setDialog({ kind: 'confirm', title, body, confirm, resolve })),
      toast: (message, kind = 'ok') => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t.slice(-3), { id, message, kind }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 2800);
      },
      openUnlock: () => setDialog({ kind: 'unlock' }),
    }),
    [],
  );

  // Renames and deletes also move/close the windows showing those files
  const blog: Blog = useMemo(
    () => ({
      ...raw,
      rename: async (path, name) => {
        const to = await raw.rename(path, name);
        if (to !== path) onMoved(path, to);
        return to;
      },
      remove: async (path) => {
        await raw.remove(path);
        onRemoved(path);
      },
    }),
    [raw, onMoved, onRemoved],
  );

  const setDirty = useCallback((key: string, d: boolean) => {
    if (d) dirty.current.add(key);
    else dirty.current.delete(key);
  }, []);

  const confirmClose = useCallback(
    async (key: string, name: string) => {
      if (!dirty.current.has(key)) return true;
      const ok = await ui.confirm(`Close ${name}?`, 'You have unsaved changes. They will be lost.', 'Discard');
      if (ok) dirty.current.delete(key);
      return ok;
    },
    [ui],
  );

  const value = useMemo(
    () => ({ blog, ui, compact, openFile, setDirty, confirmClose }),
    [blog, ui, compact, openFile, setDirty, confirmClose],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialogs dialog={dialog} close={() => setDialog(null)} unlock={raw.unlock} />
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[30000] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`window-in max-w-xs rounded-md border bg-glass px-3 py-2 text-xs shadow-xl backdrop-blur-glass ${
              t.kind === 'error' ? 'border-term-close text-term-close' : 'border-edge'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
