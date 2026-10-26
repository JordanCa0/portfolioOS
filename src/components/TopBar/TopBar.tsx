import { useEffect, useState } from 'react';
import { Github, Grip, Linkedin, Moon, Sun } from 'lucide-react';
import { GITHUB_URL, LINKEDIN_URL } from '../../apps';
import { formatUptime } from '../../uptime';

interface TopBarProps {
  dark: boolean;
  onToggleTheme: () => void;
  onToggleLauncher: () => void;
  activeWorkspace: number;
  /** Workspace indices that currently hold windows */
  occupiedWorkspaces: Set<number>;
  onSwitchWorkspace: (index: number) => void;
}

export const WORKSPACES = ['1', '2', '3', '4', '5'];

function formatTime(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

export default function TopBar({
  dark,
  onToggleTheme,
  onToggleLauncher,
  activeWorkspace,
  occupiedWorkspaces,
  onSwitchWorkspace,
}: TopBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  return (
    <header className="relative flex h-10 shrink-0 items-center gap-4 border-b border-edge bg-glass px-3 text-xs backdrop-blur-glass">
      <button
        onClick={onToggleLauncher}
        aria-label="App launcher"
        className="rounded p-1.5 text-accent-soft transition-colors hover:bg-accent/20 hover:text-body"
      >
        <Grip size={16} />
      </button>
      <span className="font-semibold text-accent-soft">jordan@portfolio</span>
      <div className="hidden items-center gap-1.5 sm:flex">
        {WORKSPACES.map((w, i) => (
          <button
            key={w}
            onClick={() => onSwitchWorkspace(i)}
            aria-label={`Workspace ${w}`}
            className={`relative flex h-5 w-5 items-center justify-center rounded text-[10px] transition-colors ${
              i === activeWorkspace
                ? 'bg-accent text-accent-contrast'
                : occupiedWorkspaces.has(i)
                  ? 'border border-accent/60 text-body hover:bg-accent/25'
                  : 'border border-edge text-body-muted hover:bg-accent/25'
            }`}
          >
            {w}
            {occupiedWorkspaces.has(i) && i !== activeWorkspace && (
              <span className="absolute -bottom-0.5 h-0.5 w-2 rounded-full bg-accent-soft" />
            )}
          </button>
        ))}
      </div>

      <span className="absolute left-1/2 -translate-x-1/2 font-medium tabular-nums">
        {formatTime(now)}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-body-muted md:inline tabular-nums">
          {formatUptime(now.getTime())}
        </span>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="rounded p-1.5 transition-colors hover:bg-accent/20"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="rounded p-1.5 transition-colors hover:bg-accent/20 hover:text-accent-soft"
        >
          <Github size={14} />
        </a>
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="LinkedIn"
          className="rounded p-1.5 transition-colors hover:bg-accent/20 hover:text-accent-soft"
        >
          <Linkedin size={14} />
        </a>
      </div>
    </header>
  );
}
