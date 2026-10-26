import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useWindowManager } from './hooks/useWindowManager';
import { useIsMobile } from './hooks/useIsMobile';
import type { AppId } from './types';
import { applyTheme, getTheme, loadThemeId } from './themes';
import TopBar from './components/TopBar/TopBar';
import Desktop from './components/Desktop/Desktop';
import AppLauncher from './components/AppLauncher/AppLauncher';
import Terminal from './components/Terminal/Terminal';
import MobileLayout from './components/MobileLayout';
import About from './components/apps/About';
import Resume from './components/apps/Resume';
import Projects from './components/apps/Projects';
import Skills from './components/apps/Skills';
import Contact from './components/apps/Contact';
import Themes from './components/apps/Themes';
import Spotify from './components/apps/Spotify';
import Help from './components/apps/Help';

export default function App() {
  const wm = useWindowManager();
  const isMobile = useIsMobile();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [themeId, setThemeId] = useState(loadThemeId);
  const theme = getTheme(themeId);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme.id);
  }, [theme]);

  // Quick toggle between the two signature themes; the Themes app has the rest
  const toggleTheme = () => setThemeId(theme.dark ? 'parchment' : 'crimson');

  // Terminal opens (and focuses) on page load
  const { openWindow } = wm;
  useEffect(() => {
    if (!isMobile) openWindow('terminal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hyprland-style binds with Alt as the mod key (Super belongs to the OS)
  const { focusedId, closeWindow, switchWorkspace } = wm;
  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      // e.code, not e.key: on macOS Alt+Q types 'œ'
      const workspace = /^Digit([1-5])$/.exec(e.code);
      if (workspace) switchWorkspace(Number(workspace[1]) - 1);
      else if (e.code === 'Enter') openWindow('terminal');
      else if (e.code === 'KeyQ') {
        if (focusedId) closeWindow(focusedId);
      } else if (e.code === 'KeyR') setLauncherOpen((o) => !o);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, focusedId, openWindow, closeWindow, switchWorkspace]);

  const renderApp = useCallback(
    (appId: AppId, focused: boolean) => {
      switch (appId) {
        case 'terminal':
          return <Terminal openApp={openWindow} focused={focused} />;
        case 'about':
          return <About />;
        case 'resume':
          return <Resume />;
        case 'projects':
          return <Projects />;
        case 'skills':
          return <Skills />;
        case 'contact':
          return <Contact />;
        case 'themes':
          return <Themes currentId={themeId} onSelect={setThemeId} />;
        case 'spotify':
          return <Spotify />;
        case 'help':
          return <Help />;
      }
    },
    [openWindow, themeId],
  );

  if (isMobile) {
    return (
      <MobileLayout
        dark={theme.dark}
        onToggleTheme={toggleTheme}
        themeId={themeId}
        onSelectTheme={setThemeId}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-full flex-col overflow-hidden">
        <TopBar
          dark={theme.dark}
          onToggleTheme={toggleTheme}
          onToggleLauncher={() => setLauncherOpen((o) => !o)}
          activeWorkspace={wm.activeWorkspace}
          occupiedWorkspaces={new Set(wm.windows.map((w) => w.workspace))}
          onSwitchWorkspace={wm.switchWorkspace}
        />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Desktop wm={wm} renderApp={renderApp} />
          <AppLauncher
            open={launcherOpen}
            onClose={() => setLauncherOpen(false)}
            onLaunch={openWindow}
          />
        </div>
      </div>
    </MotionConfig>
  );
}
