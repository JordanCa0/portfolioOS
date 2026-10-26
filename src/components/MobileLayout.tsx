import { Github, Linkedin, Moon, Sun } from 'lucide-react';
import { APPS, GITHUB_URL, LINKEDIN_URL } from '../apps';
import type { AppId } from '../types';
import About from './apps/About';
import Resume from './apps/Resume';
import Projects from './apps/Projects';
import Skills from './apps/Skills';
import Contact from './apps/Contact';
import Themes from './apps/Themes';
import Spotify from './apps/Spotify';

interface MobileLayoutProps {
  dark: boolean;
  onToggleTheme: () => void;
  themeId: string;
  onSelectTheme: (id: string) => void;
}

/** Simplified stacked layout for < 768px, no draggable windows. */
export default function MobileLayout({
  dark,
  onToggleTheme,
  themeId,
  onSelectTheme,
}: MobileLayoutProps) {
  const sections: Array<{ id: AppId; node: React.ReactNode }> = [
    { id: 'about', node: <About /> },
    { id: 'projects', node: <Projects /> },
    { id: 'skills', node: <Skills /> },
    { id: 'resume', node: <Resume /> },
    { id: 'spotify', node: <div className="h-44"><Spotify /></div> },
    { id: 'themes', node: <Themes currentId={themeId} onSelect={onSelectTheme} /> },
    { id: 'contact', node: <Contact /> },
  ];

  return (
    <div className="wallpaper min-h-full overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-edge bg-glass px-4 text-sm backdrop-blur-glass">
        <span className="font-semibold text-accent-soft">jordan@portfolio</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="rounded p-2 transition-colors hover:bg-accent/20"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub" className="p-2">
            <Github size={15} />
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="p-2">
            <Linkedin size={15} />
          </a>
        </div>
      </header>

      <div className="relative mx-auto max-w-2xl space-y-6 px-4 py-6">
        {sections.map(({ id, node }) => {
          const app = APPS.find((a) => a.id === id)!;
          const Icon = app.icon;
          return (
            <section
              key={id}
              className="overflow-hidden rounded-lg border border-edge bg-glass backdrop-blur-glass"
            >
              <div className="flex items-center gap-2 border-b border-edge bg-chrome px-4 py-2.5">
                <Icon size={14} className="text-accent-soft" />
                <h2 className="text-xs font-semibold">{app.label}</h2>
              </div>
              {node}
            </section>
          );
        })}
      </div>
    </div>
  );
}
