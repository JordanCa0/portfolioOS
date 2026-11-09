import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppId, WindowInstance } from '../types';

const DEFAULT_SIZE = { width: 700, height: 500 };

/**
 * Window layout survives a page refresh (sessionStorage: per tab, so a new
 * visit still starts with a fresh desktop).
 */
const SESSION_KEY = 'wm-session';

interface Session {
  windows: WindowInstance[];
  focusedId: string | null;
  activeWorkspace: number;
  visited: number[];
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!Array.isArray(s.windows) || !s.windows.length) return null;
    return s;
  } catch {
    return null;
  }
}

export interface WindowManager {
  windows: WindowInstance[];
  focusedId: string | null;
  activeWorkspace: number;
  switchWorkspace: (index: number) => void;
  openWindow: (appId: AppId) => void;
  /** Open a blog file in its own Notepad window (focuses it if already open here). */
  openFile: (path: string, edit?: boolean) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  updateWindow: (id: string, patch: Partial<WindowInstance>) => void;
  clearFocus: () => void;
  /** True when this page load restored windows from before a refresh. */
  restored: boolean;
}

export function useWindowManager(): WindowManager {
  const [session] = useState(loadSession);
  const [windows, setWindows] = useState<WindowInstance[]>(() =>
    (session?.windows ?? []).map((w) => ({ ...w, editOnOpen: false })),
  );
  const [focusedId, setFocusedId] = useState<string | null>(session?.focusedId ?? null);
  const [activeWorkspace, setActiveWorkspace] = useState(session?.activeWorkspace ?? 0);
  const zCounter = useRef(Math.max(10, ...windows.map((w) => w.zIndex)));
  const idCounter = useRef(
    Math.max(0, ...windows.map((w) => Number(w.id.replace('win-', '')) || 0)) + 1,
  );
  const visitedWorkspaces = useRef(new Set(session?.visited ?? [0]));

  useEffect(() => {
    try {
      const s: Session = {
        windows,
        focusedId,
        activeWorkspace,
        visited: [...visitedWorkspaces.current],
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      // storage unavailable (private mode, quota) — layout just won't persist
    }
  }, [windows, focusedId, activeWorkspace]);

  const buildWindow = (
    appId: AppId,
    workspace: number,
    offset: number,
  ): WindowInstance => {
    // Slightly randomized spawn so windows don't stack perfectly
    const maxX = Math.max(40, window.innerWidth - DEFAULT_SIZE.width - 80);
    const maxY = Math.max(40, window.innerHeight - DEFAULT_SIZE.height - 120);
    return {
      id: `win-${idCounter.current++}`,
      appId,
      workspace,
      zIndex: ++zCounter.current,
      minimized: false,
      position: {
        x: Math.min(60 + offset * 36 + Math.floor(Math.random() * 100), maxX),
        y: Math.min(30 + offset * 28 + Math.floor(Math.random() * 60), maxY),
      },
      size: { ...DEFAULT_SIZE },
      snapped: null,
      restore: null,
    };
  };

  const switchWorkspace = useCallback((index: number) => {
    setActiveWorkspace(index);
    setFocusedId(null);
    // First visit to a workspace auto-opens a terminal there
    if (!visitedWorkspaces.current.has(index)) {
      visitedWorkspaces.current.add(index);
      setWindows((ws) => {
        const win = buildWindow('terminal', index, ws.length);
        setFocusedId(win.id);
        return [...ws, win];
      });
    }
  }, []);

  const openWindow = useCallback(
    (appId: AppId) => {
      setWindows((ws) => {
        // Apps are per-workspace: focus the instance on this workspace if
        // one exists, otherwise open a new one here
        const existing = ws.find(
          (w) => w.appId === appId && w.workspace === activeWorkspace,
        );
        if (existing) {
          setFocusedId(existing.id);
          return ws.map((w) =>
            w.id === existing.id
              ? { ...w, minimized: false, zIndex: ++zCounter.current }
              : w,
          );
        }
        const win = buildWindow(appId, activeWorkspace, ws.length);
        setFocusedId(win.id);
        return [...ws, win];
      });
    },
    [activeWorkspace],
  );

  const openFile = useCallback(
    (path: string, edit = false) => {
      setWindows((ws) => {
        const existing = ws.find(
          (w) => w.appId === 'notepad' && w.file === path && w.workspace === activeWorkspace,
        );
        if (existing) {
          setFocusedId(existing.id);
          return ws.map((w) =>
            w.id === existing.id
              ? { ...w, minimized: false, zIndex: ++zCounter.current }
              : w,
          );
        }
        const win = {
          ...buildWindow('notepad', activeWorkspace, ws.length),
          file: path,
          editOnOpen: edit,
        };
        setFocusedId(win.id);
        return [...ws, win];
      });
    },
    [activeWorkspace],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((ws) => {
      const closing = ws.find((w) => w.id === id);
      const rest = ws.filter((w) => w.id !== id);
      // Hand focus to the topmost remaining window on the same workspace
      const next = rest
        .filter((w) => w.workspace === closing?.workspace && !w.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      setFocusedId((f) => (f === id ? (next?.id ?? null) : f));
      return rest;
    });
  }, []);

  const focusWindow = useCallback((id: string) => {
    setFocusedId(id);
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, zIndex: ++zCounter.current } : w)),
    );
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((ws) =>
      ws.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
    );
  }, []);

  const updateWindow = useCallback(
    (id: string, patch: Partial<WindowInstance>) => {
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    },
    [],
  );

  const clearFocus = useCallback(() => setFocusedId(null), []);

  return {
    windows,
    focusedId,
    activeWorkspace,
    switchWorkspace,
    openWindow,
    openFile,
    closeWindow,
    focusWindow,
    minimizeWindow,
    updateWindow,
    clearFocus,
    restored: session !== null,
  };
}
