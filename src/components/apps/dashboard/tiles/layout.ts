/**
 * Tiling layout for the one-page dashboard: a row of columns, each a stack
 * of panels. Weights are flex-grow factors (kept in px-ish units, so
 * resizing can just write measured sizes back). Panels absent from the tree
 * are closed.
 */
import { useCallback, useState } from 'react';

export type Panel = 'calendar' | 'day' | 'timers' | 'habits';
export const ALL_PANELS: Panel[] = ['calendar', 'day', 'timers', 'habits'];

export interface Tile {
  id: Panel;
  w: number;
}
export interface Column {
  w: number;
  tiles: Tile[];
}
export type Tree = Column[];

/** Where a dragged panel lands relative to the panel under the pointer */
export type Side = 'left' | 'right' | 'top' | 'bottom' | 'center';

export const DEFAULT_TREE: Tree = [
  { w: 640, tiles: [{ id: 'calendar', w: 1 }] },
  { w: 256, tiles: [{ id: 'day', w: 1 }] },
  {
    w: 352,
    tiles: [
      { id: 'timers', w: 300 },
      { id: 'habits', w: 460 },
    ],
  },
];

const clone = (t: Tree): Tree => t.map((c) => ({ w: c.w, tiles: c.tiles.map((x) => ({ ...x })) }));

export function locate(tree: Tree, id: Panel): [number, number] | null {
  for (let c = 0; c < tree.length; c++) {
    const t = tree[c].tiles.findIndex((x) => x.id === id);
    if (t !== -1) return [c, t];
  }
  return null;
}

export const isOpen = (tree: Tree, id: Panel) => locate(tree, id) !== null;

export function remove(tree: Tree, id: Panel): Tree {
  return clone(tree)
    .map((c) => ({ ...c, tiles: c.tiles.filter((x) => x.id !== id) }))
    .filter((c) => c.tiles.length > 0);
}

/** Reopened panels stack at the bottom of the last column */
export function add(tree: Tree, id: Panel): Tree {
  if (isOpen(tree, id)) return tree;
  const t = clone(tree);
  const last = t[t.length - 1];
  if (!last) return [{ w: 1, tiles: [{ id, w: 1 }] }];
  const avg = last.tiles.reduce((s, x) => s + x.w, 0) / last.tiles.length;
  last.tiles.push({ id, w: avg });
  return t;
}

export function move(tree: Tree, src: Panel, target: Panel, side: Side): Tree {
  if (src === target) return tree;
  const a = locate(tree, src);
  const b = locate(tree, target);
  if (!a || !b) return tree;

  if (side === 'center') {
    // Swap places; each spot keeps its size
    const t = clone(tree);
    t[a[0]].tiles[a[1]].id = target;
    t[b[0]].tiles[b[1]].id = src;
    return t;
  }

  const t = remove(tree, src);
  const [ci, ti] = locate(t, target)!;
  if (side === 'left' || side === 'right') {
    // New column beside the target's column, splitting its width
    const col = t[ci];
    col.w /= 2;
    t.splice(side === 'left' ? ci : ci + 1, 0, { w: col.w, tiles: [{ id: src, w: 1 }] });
  } else {
    // Stack into the target's column, splitting its height
    const tile = t[ci].tiles[ti];
    tile.w /= 2;
    t[ci].tiles.splice(side === 'top' ? ti : ti + 1, 0, { id: src, w: tile.w });
  }
  return t;
}

const KEY = 'dashboard-tiles';

function valid(t: unknown): t is Tree {
  if (!Array.isArray(t) || !t.length) return false;
  const ids = (t as Tree).flatMap((c) => (Array.isArray(c?.tiles) ? c.tiles.map((x) => x?.id) : [null]));
  return (
    ids.every((id) => ALL_PANELS.includes(id as Panel)) &&
    new Set(ids).size === ids.length &&
    (t as Tree).every((c) => c.w > 0 && c.tiles.length > 0 && c.tiles.every((x) => x.w > 0))
  );
}

function load(): Tree {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === '[]') return [];
    const t = raw ? (JSON.parse(raw) as unknown) : null;
    if (valid(t)) return t;
    // Carry over panels closed under the previous (fixed) layout
    const old = JSON.parse(localStorage.getItem('dashboard-layout') ?? '{}') as { hidden?: Panel[] };
    return (old.hidden ?? []).reduce(remove, DEFAULT_TREE);
  } catch {
    return DEFAULT_TREE;
  }
}

/** The layout tree, persisted per browser (a display preference, not vault data) */
export function useTiles() {
  const [tree, setTreeState] = useState<Tree>(load);
  const setTree = useCallback((next: Tree | ((t: Tree) => Tree)) => {
    setTreeState((prev) => {
      const t = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(KEY, JSON.stringify(t));
      } catch {
        // storage unavailable: layout just won't persist
      }
      return t;
    });
  }, []);
  return [tree, setTree] as const;
}
