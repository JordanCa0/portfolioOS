import { useRef } from 'react';
import { Rnd } from 'react-rnd';
import { motion } from 'framer-motion';
import type { AppDefinition, Position, Size, SnapZone, WindowInstance } from '../../types';
import { detectSnapZone, snapZoneRect } from './snap';

interface WindowProps {
  win: WindowInstance;
  app: AppDefinition;
  focused: boolean;
  /** Minimized or on an inactive workspace — kept mounted so state survives */
  hidden: boolean;
  getDesktopSize: () => Size;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onMinimize: (id: string) => void;
  onUpdate: (id: string, patch: Partial<WindowInstance>) => void;
  onSnapPreview: (zone: SnapZone) => void;
  children: React.ReactNode;
}

// Strong ease-out: moves immediately, settles softly
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

export default function Window({
  win,
  app,
  focused,
  hidden,
  getDesktopSize,
  onClose,
  onFocus,
  onMinimize,
  onUpdate,
  onSnapPreview,
  children,
}: WindowProps) {
  const Icon = app.icon;
  // Zone under the pointer during the current drag, applied on drop
  const dragZone = useRef<SnapZone>(null);
  // Where the drag started, to tell real drags apart from plain clicks
  const dragStart = useRef<Position | null>(null);

  const pointerZone = (e: MouseEvent | TouchEvent): SnapZone => {
    const point = 'touches' in e ? e.touches[0] : e;
    if (!point) return null;
    const desktop = getDesktopSize();
    // Desktop canvas starts below the top bar; convert to desktop coords
    const topOffset = window.innerHeight - desktop.height;
    return detectSnapZone(point.clientX, point.clientY - topOffset, desktop);
  };

  const unsnap = () => {
    if (!win.snapped || !win.restore) return;
    onUpdate(win.id, {
      snapped: null,
      position: win.restore.position,
      size: win.restore.size,
      restore: null,
    });
  };

  const toggleMaximize = () => {
    if (win.snapped === 'full') {
      unsnap();
      return;
    }
    onUpdate(win.id, {
      snapped: 'full',
      restore: win.restore ?? { position: win.position, size: win.size },
      ...snapZoneRect('full', getDesktopSize()),
    });
  };

  return (
    <Rnd
      position={win.position}
      size={win.size}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      bounds="parent"
      dragHandleClassName="window-drag-handle"
      style={{
        zIndex: win.zIndex,
        display: hidden ? 'none' : undefined,
      }}
      onDragStart={() => {
        dragStart.current = { ...win.position };
        onFocus(win.id);
      }}
      onDrag={(e, d) => {
        // Controlled Rnd: position state must update during the drag,
        // otherwise the window doesn't move at all
        onUpdate(win.id, { position: { x: d.x, y: d.y } });
        const zone = pointerZone(e as MouseEvent | TouchEvent);
        if (zone !== dragZone.current) {
          dragZone.current = zone;
          onSnapPreview(zone);
        }
      }}
      onDragStop={(_e, d) => {
        const zone = dragZone.current;
        const start = dragStart.current;
        dragZone.current = null;
        dragStart.current = null;
        onSnapPreview(null);
        // A plain click on the title bar fires drag events too; only treat
        // it as a drag if the window actually moved
        const moved =
          start !== null &&
          (Math.abs(d.x - start.x) > 4 || Math.abs(d.y - start.y) > 4);
        if (!moved) {
          if (start) onUpdate(win.id, { position: start });
          return;
        }
        if (zone) {
          onUpdate(win.id, {
            snapped: zone,
            restore: win.restore ?? { position: start, size: win.size },
            ...snapZoneRect(zone, getDesktopSize()),
          });
        } else if (win.snapped) {
          // Dragged away from the edge: restore free size at the drop point
          onUpdate(win.id, {
            snapped: null,
            position: { x: d.x, y: d.y },
            size: win.restore?.size ?? win.size,
            restore: null,
          });
        } else {
          onUpdate(win.id, { position: { x: d.x, y: d.y } });
        }
      }}
      onResizeStart={() => onFocus(win.id)}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onUpdate(win.id, {
          snapped: null,
          restore: null,
          position,
          size: { width: ref.offsetWidth, height: ref.offsetHeight },
        });
      }}
      onMouseDown={() => onFocus(win.id)}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
        // Closing is faster than opening: the user has already decided
        exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.14, ease: EASE_OUT } }}
        className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-glass shadow-2xl backdrop-blur-glass ${
          focused ? 'border-accent/60 shadow-accent/20' : 'border-edge'
        }`}
      >
        <div
          className="window-drag-handle flex h-9 shrink-0 select-none items-center gap-2 border-b border-edge bg-chrome px-3"
          onDoubleClick={unsnap}
        >
          <Icon size={14} className="text-accent-soft" />
          <span className="flex-1 truncate text-xs font-medium">{app.label}</span>
          {/* Keep clicks on the control dots from starting a drag */}
          <div
            className="flex items-center gap-2"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Minimize"
              onClick={() => onMinimize(win.id)}
              className="h-3 w-3 rounded-full bg-term-amber transition-transform duration-100 ease-out active:scale-90"
            />
            <button
              aria-label="Maximize"
              onClick={toggleMaximize}
              className="h-3 w-3 rounded-full bg-term-max transition-transform duration-100 ease-out active:scale-90"
            />
            <button
              aria-label="Close"
              onClick={() => onClose(win.id)}
              className="h-3 w-3 rounded-full bg-term-close transition-transform duration-100 ease-out active:scale-90"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    </Rnd>
  );
}
