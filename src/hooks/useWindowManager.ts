import { useCallback, useRef, useState } from 'react';
import type { AppId, WindowInstance } from '../types';

const DEFAULT_SIZE = { width: 700, height: 500 };

export interface WindowManager {
  windows: WindowInstance[];
  focusedId: string | null;
  activeWorkspace: number;
  switchWorkspace: (index: number) => void;
  openWindow: (appId: AppId) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  updateWindow: (id: string, patch: Partial<WindowInstance>) => void;
  clearFocus: () => void;
}

export function useWindowManager(): WindowManager {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState(0);
  const zCounter = useRef(10);
  const idCounter = useRef(1);
  const visitedWorkspaces = useRef(new Set([0]));

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
    closeWindow,
    focusWindow,
    minimizeWindow,
    updateWindow,
    clearFocus,
  };
}
