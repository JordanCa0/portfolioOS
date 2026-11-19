import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Download,
  ListTodo,
  Lock,
  LogOut,
  RotateCcw,
  Target,
  Terminal,
  Timer as TimerIcon,
  Upload,
} from 'lucide-react';
import type { AppId } from '../../../types';
import { useDashboard } from './DashboardContext';
import { btn } from './shared';
import Planner, { CalendarPanel, DayPanel, type View } from './Planner';
import Habits from './Habits';
import Timers from './Timers';
import { clamp, DEFAULT_LAYOUT, useLayoutPrefs } from './Splitter';
import { EditorHost } from './calendar/EditorHost';
import TileLayout, { type PanelDef } from './tiles/TileLayout';
import { add, ALL_PANELS, DEFAULT_TREE, isOpen, remove, useTiles, type Panel } from './tiles/layout';
import { todayKey } from '../../../lib/dashboard/model';
import { download, exportBackup, parseBackup, pickBackupFile, restoreBackup } from '../../../lib/dashboard/vault';

type ImportState =
  | { kind: 'idle' }
  | { kind: 'confirm'; backup: ReturnType<typeof parseBackup> }
  | { kind: 'done'; user: string }
  | { kind: 'error'; message: string };

/**
 * Restore a backup file (exported elsewhere, e.g. on localhost) into this
 * browser. It stays encrypted; the user still logs in with its password.
 */
function ImportBackup({ exists }: { exists: (user: string) => boolean }) {
  const [state, setState] = useState<ImportState>({ kind: 'idle' });
  const pick = async () => {
    const text = await pickBackupFile();
    if (text === null) return;
    try {
      const backup = parseBackup(text);
      if (exists(backup.user)) return setState({ kind: 'confirm', backup });
      restoreBackup(backup);
      setState({ kind: 'done', user: backup.user });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  };

  if (state.kind === 'confirm') {
    return (
      <div className="flex flex-col items-center gap-2 text-xs" role="alert">
        <p>
          An account <b>{state.backup.user}</b> already exists in this browser. Replace it with the backup?
        </p>
        <div className="flex gap-1.5">
          <button
            className={btn}
            onClick={() => {
              restoreBackup(state.backup);
              setState({ kind: 'done', user: state.backup.user });
            }}
          >
            Replace
          </button>
          <button className={btn} onClick={() => setState({ kind: 'idle' })}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button className={`${btn} flex items-center gap-1.5`} onClick={() => void pick()}>
        <Upload size={12} /> Import backup
      </button>
      {state.kind === 'done' && (
        <p className="text-xs" role="status">
          Imported <b>{state.user}</b>. Log in with <code className="text-term-green">dashboard {state.user}</code>
        </p>
      )}
      {state.kind === 'error' && (
        <p className="text-xs text-accent-hover" role="alert">
          Import failed: {state.message}
        </p>
      )}
    </div>
  );
}

const TABS = [
  { id: 'planner', label: 'Planner', icon: CalendarDays },
  { id: 'habits', label: 'Habits', icon: Target },
  { id: 'timers', label: 'Timers', icon: TimerIcon },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Window size at which everything fits on one page (tiles instead of tabs) */
const WIDE = { width: 1180, height: 600 };

/** Tracks the window's own size, not the viewport: resizing/maximizing it switches layouts */
function useSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export default function Dashboard({ openApp }: { openApp: (id: AppId) => void }) {
  const { user, data, logout, flush, exists } = useDashboard();
  const [tab, setTab] = useState<Tab>('planner');
  const rootRef = useRef<HTMLDivElement>(null);
  const size = useSize(rootRef);
  const wide = size.width >= WIDE.width && size.height >= WIDE.height;
  const [prefs, setPrefs] = useLayoutPrefs();
  const [tree, setTree] = useTiles();
  const [view, setView] = useState<View>('week');
  const [selected, setSelected] = useState(todayKey);
  const planner = { view, setView, selected, setSelected };

  const open = (p: Panel) => isOpen(tree, p);
  const setOpen = (p: Panel, on: boolean) => setTree((t) => (on ? add(t, p) : remove(t, p)));

  if (!user || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock size={28} className="text-accent-soft" />
        <h2 className="text-sm font-bold">Dashboard is locked</h2>
        <p className="max-w-xs text-xs text-body-muted">
          Run <code className="text-term-green">dashboard</code> in a terminal to log in or create
          an account. Everything is encrypted with your password and stays in this browser.
        </p>
        <button className={`${btn} mt-1 flex items-center gap-1.5`} onClick={() => openApp('terminal')}>
          <Terminal size={12} /> Open terminal
        </button>
        <div className="mt-4 max-w-xs border-t border-edge pt-4">
          <p className="mb-2 text-[11px] text-body-muted">
            Moving from another browser or from localhost? Export there, then import the file here.
          </p>
          <ImportBackup exists={exists} />
        </div>
      </div>
    );
  }

  const running = data.timers.filter((t) => t.endsAt !== null).length;

  const panels: Record<Panel, PanelDef> = {
    calendar: {
      label: 'Calendar',
      icon: CalendarDays,
      minW: 380,
      scroll: false,
      render: () => <CalendarPanel data={data} state={planner} />,
    },
    day: {
      label: 'Day list',
      icon: ListTodo,
      minW: 200,
      scroll: false,
      // Without a calendar on screen, the day list gets its own day arrows
      render: () => <DayPanel data={data} state={planner} nav={!open('calendar')} />,
    },
    timers: { label: 'Timers', icon: TimerIcon, minW: 220, scroll: true, render: () => <Timers data={data} compact /> },
    habits: { label: 'Habits', icon: Target, minW: 260, scroll: true, render: () => <Habits data={data} compact /> },
  };

  const isDefault = JSON.stringify(tree) === JSON.stringify(DEFAULT_TREE);

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" data-layout={wide ? 'wide' : 'tabs'}>
      <header className="flex items-center gap-1 border-b border-edge bg-chrome px-3 py-1.5">
        {wide ? (
          <div className="flex items-center gap-1" role="group" aria-label="Panels">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-body-muted">Panels</span>
            {ALL_PANELS.map((id) => {
              const { label, icon: Icon } = panels[id];
              const on = open(id);
              return (
                <button
                  key={id}
                  aria-pressed={on}
                  onClick={() => setOpen(id, !on)}
                  title={on ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? 'border-accent bg-accent text-accent-contrast hover:bg-accent-hover'
                      : 'border-dashed border-edge text-body-muted hover:bg-accent/20 hover:text-body'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                  {id === 'timers' && !on && running > 0 && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-term-green" aria-label={`${running} running`} />
                  )}
                </button>
              );
            })}
            <button
              className={`${btn} ml-1 flex items-center gap-1`}
              onClick={() => setTree(DEFAULT_TREE)}
              disabled={isDefault}
              title="Put every panel back where it started"
            >
              <RotateCcw size={12} /> Reset layout
            </button>
            <span className="ml-2 hidden text-[10px] text-body-muted 2xl:inline">Drag a panel’s title bar to move it</span>
          </div>
        ) : (
          <nav className="flex gap-1" role="tablist" aria-label="Dashboard sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors ${
                  tab === id ? 'bg-accent text-accent-contrast' : 'hover:bg-accent/20'
                }`}
              >
                <Icon size={13} />
                {label}
                {id === 'timers' && running > 0 && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-term-green" aria-label={`${running} running`} />
                )}
              </button>
            ))}
          </nav>
        )}
        {!wide && (
          <span className="ml-3 hidden text-[10px] text-body-muted lg:inline">
            Maximize to arrange everything on one page
          </span>
        )}
        <span className="ml-auto mr-2 text-xs text-body-muted">
          <span className="text-term-green">{user}</span>@dashboard
        </span>
        <button
          className={`${btn} mr-1 flex items-center gap-1`}
          title="Download an encrypted backup (import it on another browser or the live site)"
          onClick={async () => {
            await flush();
            const b = exportBackup(user);
            if (b) download(b.filename, b.json);
          }}
        >
          <Download size={12} /> Export
        </button>
        <button className={`${btn} flex items-center gap-1`} onClick={() => void logout()} aria-label="Log out">
          <LogOut size={12} /> Lock
        </button>
      </header>
      <EditorHost data={data}>
        {wide ? (
          tree.length ? (
            <TileLayout tree={tree} setTree={setTree} panels={panels} onClose={(id) => setOpen(id, false)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-bold">All panels are closed</p>
              <p className="text-xs text-body-muted">Turn them back on from the Panels toggles above.</p>
              <button className={`${btn} mt-1`} onClick={() => setTree(DEFAULT_TREE)}>
                Show everything
              </button>
            </div>
          )
        ) : (
          <div className="min-h-0 flex-1">
            {tab === 'planner' && (
              <Planner
                data={data}
                state={planner}
                day={{
                  open: open('day'),
                  setOpen: (on) => setOpen('day', on),
                  width: clamp(prefs.day, 180, size.width - 420),
                  max: size.width - 420,
                  setWidth: (v) => setPrefs({ day: v }),
                  resetWidth: () => setPrefs({ day: DEFAULT_LAYOUT.day }),
                }}
              />
            )}
            {tab === 'habits' && <Habits data={data} />}
            {tab === 'timers' && <Timers data={data} />}
          </div>
        )}
      </EditorHost>
    </div>
  );
}
