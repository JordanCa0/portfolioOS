import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppId, Size, SnapZone } from '../../types';
import type { WindowManager } from '../../hooks/useWindowManager';
import { APP_MAP } from '../../apps';
import Window from '../Window/Window';
import { snapZoneRect } from '../Window/snap';

interface DesktopProps {
  wm: WindowManager;
  renderApp: (appId: AppId, focused: boolean) => React.ReactNode;
}

export default function Desktop({ wm, renderApp }: DesktopProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [previewZone, setPreviewZone] = useState<SnapZone>(null);

  const getDesktopSize = useCallback((): Size => {
    const rect = ref.current?.getBoundingClientRect();
    return rect
      ? { width: rect.width, height: rect.height }
      : { width: window.innerWidth, height: window.innerHeight - 40 };
  }, []);

  const preview = previewZone ? snapZoneRect(previewZone, getDesktopSize()) : null;

  return (
    <main
      ref={ref}
      className="wallpaper relative flex-1 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) wm.clearFocus();
      }}
    >
      {/* Snap preview overlay shown while dragging near an edge/corner */}
      {preview && (
        <div
          className="pointer-events-none absolute z-[9999] rounded-lg border-2 border-accent bg-snap-preview transition-[left,top,width,height] duration-150 ease-out"
          style={{
            left: preview.position.x,
            top: preview.position.y,
            width: preview.size.width,
            height: preview.size.height,
          }}
        />
      )}

      {/* Dock for minimized windows on this workspace — click to restore */}
      {wm.windows.some((w) => w.minimized && w.workspace === wm.activeWorkspace) && (
        <div className="absolute bottom-3 left-1/2 z-[9998] flex -translate-x-1/2 gap-1.5 rounded-lg border border-edge bg-glass p-1.5 shadow-2xl backdrop-blur-glass">
          {wm.windows
            .filter((w) => w.minimized && w.workspace === wm.activeWorkspace)
            .map((w) => {
              const app = APP_MAP[w.appId];
              const Icon = app.icon;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    wm.minimizeWindow(w.id);
                    wm.focusWindow(w.id);
                  }}
                  className="flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors hover:bg-accent/25"
                >
                  <Icon size={14} className="text-accent-soft" />
                  {app.label}
                </button>
              );
            })}
        </div>
      )}

      <AnimatePresence>
        {wm.windows.map((w) => (
            <Window
              key={w.id}
              win={w}
              app={APP_MAP[w.appId]}
              focused={wm.focusedId === w.id}
              hidden={w.minimized || w.workspace !== wm.activeWorkspace}
              getDesktopSize={getDesktopSize}
              onClose={wm.closeWindow}
              onFocus={wm.focusWindow}
              onMinimize={wm.minimizeWindow}
              onUpdate={wm.updateWindow}
              onSnapPreview={setPreviewZone}
            >
              {renderApp(w.appId, wm.focusedId === w.id)}
            </Window>
          ))}
      </AnimatePresence>
    </main>
  );
}
