import { COMMAND_DESCRIPTIONS } from '../Terminal/commands';

// Display list only; the binds themselves live in App.tsx
const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: 'Alt Enter', desc: 'Open the terminal' },
  { keys: 'Alt Q', desc: 'Close the focused window' },
  { keys: 'Alt R', desc: 'Toggle the app launcher' },
  { keys: 'Alt 1–5', desc: 'Switch workspace' },
  { keys: 'Esc', desc: 'Close the launcher' },
];

function Table({ rows }: { rows: Array<{ key: string; desc: string }> }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-edge">
      {rows.map(({ key, desc }, i) => (
        <div
          key={key}
          className={`flex items-baseline gap-4 px-4 py-2.5 text-sm ${
            i % 2 === 0 ? 'bg-chrome' : ''
          }`}
        >
          <code className="w-28 shrink-0 text-term-green">{key}</code>
          <span className="text-xs text-body-muted">{desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function Help() {
  return (
    <div className="space-y-6 p-6">
      <section>
        <h1 className="text-lg font-bold">Keyboard</h1>
        <p className="mt-1 text-xs text-body-muted">
          Alt is Option (⌥) on a Mac. Drag a window to an edge or corner to tile it.
        </p>
        <Table rows={SHORTCUTS.map(({ keys, desc }) => ({ key: keys, desc }))} />
      </section>
      <section>
        <h1 className="text-lg font-bold">Terminal</h1>
        <Table rows={COMMAND_DESCRIPTIONS.map(({ cmd, desc }) => ({ key: cmd, desc }))} />
      </section>
    </div>
  );
}
