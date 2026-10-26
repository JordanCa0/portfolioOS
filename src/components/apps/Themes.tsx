import { Check } from 'lucide-react';
import { THEMES, type Theme } from '../../themes';

interface ThemesProps {
  currentId: string;
  onSelect: (id: string) => void;
}

function ThemePreview({ theme }: { theme: Theme }) {
  const c = theme.colors;
  return (
    <div
      className="h-20 w-full overflow-hidden rounded-md border"
      style={{ background: c.desktop, borderColor: c.border }}
    >
      {/* Mini top bar */}
      <div className="flex h-3 items-center gap-1 px-1.5" style={{ background: c.chrome }}>
        <span className="h-1 w-1 rounded-full" style={{ background: c.accent }} />
        <span className="h-1 w-4 rounded-full" style={{ background: c.textMuted }} />
      </div>
      {/* Mini window */}
      <div
        className="mx-3 mt-2 h-12 overflow-hidden rounded border"
        style={{ background: c.glass, borderColor: c.border }}
      >
        <div className="flex h-3 items-center gap-1 px-1.5" style={{ background: c.chrome }}>
          <span className="h-1 w-6 rounded-full" style={{ background: c.accentSoft }} />
        </div>
        <div className="space-y-1 p-1.5">
          <span className="block h-1 w-3/4 rounded-full" style={{ background: c.text }} />
          <span className="block h-1 w-1/2 rounded-full" style={{ background: c.textMuted }} />
        </div>
      </div>
    </div>
  );
}

export default function Themes({ currentId, onSelect }: ThemesProps) {
  return (
    <div className="p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => {
          const active = theme.id === currentId;
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active
                  ? 'border-accent bg-accent/10'
                  : 'border-edge hover:border-accent/60'
              }`}
            >
              <ThemePreview theme={theme} />
              <div className="mt-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{theme.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-body-muted">
                    {theme.dark ? 'Dark' : 'Light'}
                  </p>
                </div>
                {active && <Check size={16} className="text-accent-soft" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
