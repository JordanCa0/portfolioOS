import { useState } from 'react';
import { formatUptime } from '../../uptime';

// The J keycap from the site icon
const ART = [
  '╭───────────╮',
  '│           │┃',
  '│       ██  │┃',
  '│       ██  │┃',
  '│   ██  ██  │┃',
  '│    ████   │┃',
  '│           │┃',
  '╰───────────╯┃',
  ' ┗━━━━━━━━━━━┛',
];

const INFO: Array<[string, string]> = [
  ['Role', 'Software Engineer'],
  ['Edu', 'BSc Computer Science, Wilfrid Laurier'],
  ['Last', 'SWE Intern @ Mercury'],
  ['Langs', 'Haskell, TypeScript, Rust, Python'],
  ['Stack', 'React, TypeScript, Vite'],
  ['WM', 'react-rnd, edge snapping'],
];

const SWATCHES = [
  'bg-accent',
  'bg-accent-hover',
  'bg-accent-soft',
  'bg-term-green',
  'bg-term-amber',
  'bg-term-pink',
];

export default function Neofetch() {
  // Uptime is frozen at the moment neofetch ran, like the real thing
  const [uptime] = useState(() => formatUptime());

  return (
    <div className="my-1 flex flex-wrap items-start gap-x-6 gap-y-2">
      <pre className="font-mono leading-tight text-accent-soft">{ART.join('\n')}</pre>
      <div className="min-w-0">
        <p>
          <span className="font-semibold text-term-green">jordan</span>
          <span className="text-body-muted">@</span>
          <span className="font-semibold text-term-green">portfolio</span>
        </p>
        <p className="text-body-muted">────────────────</p>
        {[...INFO, ['Uptime', uptime.replace(/^up /, '')] as [string, string]].map(
          ([key, value]) => (
            <p key={key} className="flex gap-3">
              <span className="w-14 shrink-0 font-semibold text-accent-soft">{key}</span>
              <span className="min-w-0">{value}</span>
            </p>
          ),
        )}
        <div className="mt-2 flex">
          {SWATCHES.map((s) => (
            <span key={s} className={`h-3 w-5 ${s}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
