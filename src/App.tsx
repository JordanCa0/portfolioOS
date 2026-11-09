import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useWindowManager } from './hooks/useWindowManager';
import { useIsMobile } from './hooks/useIsMobile';
import type { WindowInstance } from './types';
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
import Explorer from './components/apps/blog/Explorer';
import Notepad from './components/apps/blog/Notepad';
import ErrorBoundary from './components/apps/blog/ErrorBoundary';
import { BlogProvider, useBlogContext } from './components/apps/blog/BlogContext';
import type { WindowManager } from './hooks/useWindowManager';

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

  // Terminal opens (and focuses) on page load, unless a refresh restored windows
  const { openWindow } = wm;
  useEffect(() => {
    if (!isMobile && !wm.restored) openWindow('terminal');
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

  // ----- Blog: files open as Notepad windows; #/blog/<path> deep-links a note
  const { openFile, updateWindow } = wm;
  const [mobileFile, setMobileFile] = useState<{ path: string; edit: boolean } | null>(null);
  const windowsRef = useRef(wm.windows);
  windowsRef.current = wm.windows;

  const showFile = useCallback(
    (path: string, edit = false) => {
      if (isMobile) setMobileFile({ path, edit });
      else openFile(path, edit);
      history.replaceState(null, '', `#/blog/${encodeURI(path)}`);
    },
    [isMobile, openFile],
  );

  // #/blog opens the explorer; #/blog/<path> opens a note. Handled on load and
  // on hash changes only (a ref keeps the handler current), so switching
  // workspaces doesn't re-open the linked window there.
  const onHash = useRef(() => {});
  onHash.current = () => {
    const hash = window.location.hash;
    if (/^#\/blog\/?$/.test(hash)) {
      if (isMobile) {
        requestAnimationFrame(() =>
          document.getElementById('section-blog')?.scrollIntoView({ behavior: 'smooth' }),
        );
      } else openWindow('blog');
      return;
    }
    const m = hash.match(/^#\/blog\/(.+)$/);
    if (m) showFile(decodeURI(m[1]));
  };
  useEffect(() => {
    const handle = () => onHash.current();
    handle();
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);

  const under = (p: string, root: string) => p === root || p.startsWith(`${root}/`);
  const onMoved = useCallback(
    (from: string, to: string) => {
      for (const w of windowsRef.current) {
        if (w.file && under(w.file, from)) updateWindow(w.id, { file: to + w.file.slice(from.length) });
      }
      setMobileFile((f) => (f && under(f.path, from) ? { ...f, path: to + f.path.slice(from.length) } : f));
    },
    [updateWindow],
  );
  const onRemoved = useCallback(
    (path: string) => {
      for (const w of windowsRef.current) if (w.file && under(w.file, path)) closeWindow(w.id);
      setMobileFile((f) => (f && under(f.path, path) ? null : f));
    },
    [closeWindow],
  );

  const renderApp = useCallback(
    (win: WindowInstance, focused: boolean) => {
      switch (win.appId) {
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
        case 'blog':
          return (
            <ErrorBoundary>
              <Explorer />
            </ErrorBoundary>
          );
        case 'notepad':
          return (
            <ErrorBoundary>
              <Notepad path={win.file} windowId={win.id} startInEdit={win.editOnOpen} />
            </ErrorBoundary>
          );
      }
    },
    [openWindow, themeId],
  );

  const provider = (children: React.ReactNode) => (
    <BlogProvider compact={isMobile} openFile={showFile} onMoved={onMoved} onRemoved={onRemoved}>
      {children}
    </BlogProvider>
  );

  if (isMobile) {
    return provider(
      <MobileLayout
        dark={theme.dark}
        onToggleTheme={toggleTheme}
        themeId={themeId}
        onSelectTheme={setThemeId}
        openFile={mobileFile}
        onCloseFile={() => {
          setMobileFile(null);
          clearBlogHash();
        }}
      />,
    );
  }

  return provider(
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
          <BlogAwareDesktop wm={wm} renderApp={renderApp} />
          <AppLauncher
            open={launcherOpen}
            onClose={() => setLauncherOpen(false)}
            onLaunch={openWindow}
          />
        </div>
      </div>
    </MotionConfig>,
  );
}

function clearBlogHash() {
  if (window.location.hash.startsWith('#/blog/')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

/** Desktop whose Notepad windows ask before discarding unsaved edits. */
function BlogAwareDesktop({
  wm,
  renderApp,
}: {
  wm: WindowManager;
  renderApp: (win: WindowInstance, focused: boolean) => React.ReactNode;
}) {
  const { confirmClose } = useBlogContext();
  const { closeWindow, windows } = wm;
  const guardedClose = useCallback(
    async (id: string) => {
      const win = windows.find((w) => w.id === id);
      if (win?.file) {
        if (!(await confirmClose(id, win.file.slice(win.file.lastIndexOf('/') + 1)))) return;
        clearBlogHash();
      }
      closeWindow(id);
    },
    [windows, closeWindow, confirmClose],
  );
  return <Desktop wm={{ ...wm, closeWindow: guardedClose }} renderApp={renderApp} />;
}
