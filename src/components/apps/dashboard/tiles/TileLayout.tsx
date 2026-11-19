import { Fragment, useRef, useState } from 'react';
import { GripVertical, type LucideIcon } from 'lucide-react';
import { PanelClose } from '../shared';
import { move, type Panel, type Side, type Tree } from './layout';

export interface PanelDef {
  label: string;
  icon: LucideIcon;
  /** Smallest width (px) the panel's column may shrink to */
  minW: number;
  /** Frame scrolls its content (panels that don't manage their own scroll) */
  scroll: boolean;
  render: () => React.ReactNode;
}

const MIN_H = 110;
const DRAG_THRESHOLD = 4;
/** Within this fraction of a panel's edge the drop docks on that side; beyond it, swaps */
const EDGE = 0.3;

interface DragState {
  id: Panel;
  x: number;
  y: number;
  target: { id: Panel; side: Side; rect: DOMRect } | null;
}

function sideAt(rect: DOMRect, x: number, y: number): Side {
  const fx = (x - rect.left) / rect.width;
  const fy = (y - rect.top) / rect.height;
  const edges: Array<[Side, number]> = [
    ['left', fx],
    ['right', 1 - fx],
    ['top', fy],
    ['bottom', 1 - fy],
  ];
  const [side, d] = edges.reduce((m, e) => (e[1] < m[1] ? e : m));
  return d < EDGE ? side : 'center';
}

/** Rect (relative to root) highlighted for a drop, like the window snap preview */
function previewRect(root: DOMRect, r: DOMRect, side: Side) {
  const box = { left: r.left - root.left, top: r.top - root.top, width: r.width, height: r.height };
  if (side === 'left') box.width /= 2;
  if (side === 'right') {
    box.left += box.width / 2;
    box.width /= 2;
  }
  if (side === 'top') box.height /= 2;
  if (side === 'bottom') {
    box.top += box.height / 2;
    box.height /= 2;
  }
  return box;
}

export default function TileLayout({
  tree,
  setTree,
  panels,
  onClose,
}: {
  tree: Tree;
  setTree: (t: Tree | ((t: Tree) => Tree)) => void;
  panels: Record<Panel, PanelDef>;
  onClose: (id: Panel) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const startDrag = (e: React.PointerEvent, id: Panel) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let active = false;
    let last: DragState | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
        active = true;
        document.body.style.cursor = 'grabbing';
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-panel]');
      const over = el?.dataset.panel as Panel | undefined;
      let target: DragState['target'] = null;
      if (el && over && over !== id) {
        const rect = el.getBoundingClientRect();
        target = { id: over, side: sideAt(rect, ev.clientX, ev.clientY), rect };
      }
      last = { id, x: ev.clientX, y: ev.clientY, target };
      setDrag(last);
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
      setDrag(null);
      const t = last?.target;
      if (commit && t) setTree((tr) => move(tr, id, t.id, t.side));
    };
    const onUp = () => end(true);
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && end(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
  };

  const root = rootRef.current?.getBoundingClientRect();
  const colMin = (ci: number) => Math.max(...tree[ci].tiles.map((t) => panels[t.id].minW));

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1" data-testid="tiles">
      {tree.map((col, ci) => (
        <Fragment key={col.tiles.map((t) => t.id).join('+')}>
          {ci > 0 && (
            <PairSplitter
              axis="x"
              label={`Resize ${panels[tree[ci - 1].tiles[0].id].label.toLowerCase()} column`}
              mins={tree.map((_, i) => colMin(i))}
              index={ci}
              onResize={(ws) => setTree((t) => t.map((c, i) => ({ ...c, w: ws[i] ?? c.w })))}
            />
          )}
          <div
            data-idx={ci}
            className="flex min-h-0 flex-col"
            style={{ flex: `${col.w} 1 0px`, minWidth: colMin(ci) }}
          >
            {col.tiles.map((tile, ti) => {
              const def = panels[tile.id];
              const Icon = def.icon;
              const dragging = drag?.id === tile.id;
              return (
                <Fragment key={tile.id}>
                  {ti > 0 && (
                    <PairSplitter
                      axis="y"
                      label={`Resize ${panels[col.tiles[ti - 1].id].label.toLowerCase()} panel`}
                      mins={col.tiles.map(() => MIN_H)}
                      index={ti}
                      onResize={(ws) =>
                        setTree((t) =>
                          t.map((c, i) =>
                            i !== ci ? c : { ...c, tiles: c.tiles.map((x, j) => ({ ...x, w: ws[j] ?? x.w })) },
                          ),
                        )
                      }
                    />
                  )}
                  <section
                    data-idx={ti}
                    data-panel={tile.id}
                    aria-label={`${def.label} panel`}
                    className={`flex min-h-0 min-w-0 flex-col transition-opacity ${dragging ? 'opacity-40' : ''}`}
                    style={{ flex: `${tile.w} 1 0px`, minHeight: MIN_H }}
                  >
                    <header
                      onPointerDown={(e) => startDrag(e, tile.id)}
                      title="Drag to move this panel"
                      className="flex h-7 shrink-0 cursor-grab select-none items-center gap-1.5 border-b border-edge bg-chrome px-2 text-[11px] font-bold active:cursor-grabbing"
                    >
                      <GripVertical size={12} className="text-body-muted" aria-hidden="true" />
                      <Icon size={12} className="text-accent-soft" aria-hidden="true" />
                      <span className="flex-1 truncate">{def.label}</span>
                      <PanelClose name={def.label.toLowerCase()} onClose={() => onClose(tile.id)} />
                    </header>
                    <div className={`flex min-h-0 flex-1 flex-col ${def.scroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                      {def.render()}
                    </div>
                  </section>
                </Fragment>
              );
            })}
          </div>
        </Fragment>
      ))}

      {drag?.target && root && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border-2 border-accent bg-snap-preview transition-[left,top,width,height] duration-100 ease-out"
          style={previewRect(root, drag.target.rect, drag.target.side)}
        />
      )}
      {drag && root && (
        <div
          className="pointer-events-none absolute z-50 flex items-center gap-1.5 rounded border border-accent bg-glass px-2 py-1 text-[11px] font-bold shadow-2xl backdrop-blur-glass"
          style={{ left: drag.x - root.left + 12, top: drag.y - root.top + 12 }}
        >
          {(() => {
            const Icon = panels[drag.id].icon;
            return <Icon size={12} className="text-accent-soft" />;
          })()}
          {panels[drag.id].label}
          <span className="font-normal text-body-muted">
            {drag.target ? (drag.target.side === 'center' ? `swap with ${panels[drag.target.id].label}` : `dock ${drag.target.side}`) : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Divider between two siblings (columns, or panels in a column). On drag it
 * measures every sibling, so all weights become px and only the pair under
 * the divider changes size. Double-click splits the pair evenly.
 */
function PairSplitter({
  axis,
  index,
  mins,
  onResize,
  label,
}: {
  axis: 'x' | 'y';
  /** Index of the sibling after the divider */
  index: number;
  mins: number[];
  onResize: (weights: number[]) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const horizontal = axis === 'x';

  const measure = () => {
    const parent = ref.current!.parentElement!;
    return [...parent.children]
      .filter((el): el is HTMLElement => (el as HTMLElement).dataset.idx !== undefined)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return horizontal ? r.width : r.height;
      });
  };
  const resize = (sizes: number[], delta: number) => {
    const a = index - 1;
    const total = sizes[a] + sizes[index];
    const na = Math.min(Math.max(sizes[a] + delta, mins[a]), total - mins[index]);
    const next = [...sizes];
    next[a] = na;
    next[index] = total - na;
    onResize(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = horizontal ? e.clientX : e.clientY;
    const sizes = measure();
    setActive(true);
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
    const onMove = (ev: PointerEvent) => resize(sizes, (horizontal ? ev.clientX : ev.clientY) - start);
    const onUp = () => {
      setActive(false);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const fwd = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (e.key !== back && e.key !== fwd) return;
    e.preventDefault();
    resize(measure(), e.key === fwd ? step : -step);
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      title={`${label} · drag to resize, double-click to split evenly`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        const s = measure();
        resize(s, (s[index] - s[index - 1]) / 2);
      }}
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
