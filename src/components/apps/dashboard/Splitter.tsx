import { useCallback, useState } from 'react';

/** Tab-layout sizes in px (the one-page layout keeps its own tree in tiles/layout.ts). */
export interface LayoutPrefs {
  /** Day list beside the calendar */
  day: number;
}

export const DEFAULT_LAYOUT: LayoutPrefs = { day: 256 };
const KEY = 'dashboard-layout';

export function useLayoutPrefs() {
  const [prefs, setPrefs] = useState<LayoutPrefs>(() => {
    try {
      return { ...DEFAULT_LAYOUT, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<LayoutPrefs>) };
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const set = useCallback((patch: Partial<LayoutPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: sizes just won't persist
      }
      return next;
    });
  }, []);
  return [prefs, set] as const;
}

export const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(Math.max(v, lo), Math.max(lo, hi)));

/**
 * Draggable divider that resizes the panel on one side of it.
 * `invert`: the panel is right of / below the divider, so dragging toward it
 * (left / up) grows it. Double-click resets; arrow keys nudge.
 */
export default function Splitter({
  axis,
  value,
  min,
  max,
  onChange,
  onReset,
  invert = false,
  label,
}: {
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onReset: () => void;
  invert?: boolean;
  label: string;
}) {
  const [active, setActive] = useState(false);
  const horizontal = axis === 'x';

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = horizontal ? e.clientX : e.clientY;
    const from = value;
    setActive(true);
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => {
      const delta = (horizontal ? ev.clientX : ev.clientY) - start;
      onChange(clamp(from + (invert ? -delta : delta), min, max));
    };
    const up = () => {
      setActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const grow = horizontal ? (invert ? 'ArrowLeft' : 'ArrowRight') : invert ? 'ArrowUp' : 'ArrowDown';
    const shrink = horizontal ? (invert ? 'ArrowRight' : 'ArrowLeft') : invert ? 'ArrowDown' : 'ArrowUp';
    const step = e.shiftKey ? 64 : 16;
    if (e.key === grow) onChange(clamp(value + step, min, max));
    else if (e.key === shrink) onChange(clamp(value - step, min, max));
    else if (e.key === 'Home') onReset();
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} · drag to resize, double-click to reset`}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      // A wide invisible hit area around a 1px line
      className={`group relative z-40 shrink-0 outline-none ${
        horizontal ? '-mx-[3px] w-[7px] cursor-col-resize' : '-my-[3px] h-[7px] cursor-row-resize'
      }`}
    >
      <div
        className={`absolute transition-colors duration-150 ${
          horizontal ? 'inset-y-0 left-[3px] w-px' : 'inset-x-0 top-[3px] h-px'
        } ${active ? 'bg-accent' : 'bg-edge group-hover:bg-accent/70 group-focus-visible:bg-accent'}`}
      />
      <div
        className={`absolute rounded-full transition-opacity duration-150 ${
          horizontal ? 'left-[2px] top-1/2 h-8 w-[3px] -translate-y-1/2' : 'left-1/2 top-[2px] h-[3px] w-8 -translate-x-1/2'
        } ${active ? 'bg-accent opacity-100' : 'bg-accent/70 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
      />
    </div>
  );
}
