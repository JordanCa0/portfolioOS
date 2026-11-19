# Portfolio OS — agent context

Personal portfolio for Jordan Cao styled as a Linux Hyprland desktop. React +
TypeScript + Vite + Tailwind + framer-motion + react-rnd. Fully static, no
backend. Repo: https://github.com/JordanCa0/portfolioOS (public), live at https://jordanca0.github.io/portfolioOS/.

## Environment quirks (read first)

- **Node is NOT on PATH.** It's installed at `~/.local/node`. Prefix commands:
  `export PATH="$HOME/.local/node/bin:$PATH"`
- `vite.config.ts` defines `process.env.NODE_ENV` because react-rnd's bundled
  react-draggable reads it at runtime and crashes the window component
  without it. Do not remove.
- Git remote uses HTTPS + gh credential helper (SSH host key not set up).

## Verification

UI behavior is verified with a real-browser Playwright suite:

```bash
# one-time setup (playwright lives outside the repo)
mkdir -p /tmp/pw-test && cd /tmp/pw-test && npm init -y && npm i playwright \
  && npx playwright install chromium --only-shell
# run (dev server on port 5199 expected by the test)
npm run dev -- --port 5199 &   # serves /portfolioOS/ (vite base); then:
node tests/ui.test.mjs   # run from a dir with playwright installed, e.g. /tmp/pw-test
```

All ~23 checks must pass before pushing window-manager or app changes.
`npm run build` (tsc + vite) must also be clean.

## Architecture

- `src/hooks/useWindowManager.ts` — windows state: open/close/focus/minimize,
  z-index counter, workspaces. Windows are **per-workspace**; opening an app
  focuses the instance on the current workspace or creates one there. First
  visit to a workspace auto-opens a terminal.
- `src/components/Window/Window.tsx` + `snap.ts` — react-rnd wrapper.
  Controlled position: **must update state in onDrag**, not just onDragStop.
  Snapping: halves at edges (80px), quadrants at corners (120px), 'full' for
  maximize. `restore` holds pre-snap geometry. Clicks with <4px movement are
  not drags. Minimized/off-workspace windows are hidden with `display:none`,
  never unmounted (terminal scrollback must survive).
- `src/themes.ts` — themes set CSS variables on documentElement; `:root` in
  `index.css` holds the Parchment defaults for first paint. Wallpaper and
  snap-preview tint from `--color-accent` via color-mix. Theme id persists in
  localStorage ('theme'); old 'dark'/'light' values migrate. applyTheme also
  toggles `.dark` on <html> for Tailwind's `dark:` variant.
- `src/apps.ts` — single source for app registry, GitHub/LinkedIn/email/phone
  constants, and `SPOTIFY_URL` (any share link; Spotify.tsx rewrites it to
  the /embed/ form — non-embed links are blocked by X-Frame-Options).
- `src/components/Terminal/` — commands + Tab completion in commands.ts,
  neofetch boot block in Neofetch.tsx; ghost "help" typewriter hint shows
  until the first command runs.
- Keyboard binds (Alt = mod) live in App.tsx; Help.tsx lists them for display.
- Mobile (<768px) renders `MobileLayout.tsx` (stacked sections), not the WM.
- `public/resume.pdf` — bundled resume; replace the file to update it.

## Conventions

- All colors via CSS vars / Tailwind config tokens — no hex in components.
- Personal info only via constants in `src/apps.ts`, never inline.
- Resume/About content mirrors Jordan's actual resume; don't invent entries.
- Deployment (S3 + CloudFront, GitHub Pages mirror) is planned but not set up.
- Blog: `blog` app = file explorer (`components/apps/blog/Explorer.tsx`);
  each file opens in its own `notepad` window (`wm.openFile`, `win.file`).
  Posts are plain files in `public/blog/` — add a folder or `.md`, push,
  done. `blog-manifest.ts` (Vite plugin) generates `blog/manifest.json`
  at build (and per request in dev); dates come from git history, so CI
  checks out with `fetch-depth: 0`. Never commit a manifest.json by hand.
  Dotfiles are hidden (`.gitkeep` keeps empty folders); so is `assets/`
  (photo folder) unless in author mode. Author mode (GitHub
  fine-grained token, Contents: write) lists the live git tree and commits
  via the git data API (`lib/blog/github.ts`); each commit redeploys.
  `#/blog` opens the explorer, `#/blog/<path>` deep-links a note. Mobile: explorer inline, notes full-screen.
- Dashboard: `dashboard` in the terminal runs a tty-style login (Terminal.tsx
  `Auth` steps; passwords are a password input with transparent text and
  caret, never echoed). Unknown usernames get an account created. Data is
  per-browser only: `lib/dashboard/vault.ts` encrypts each user's JSON with
  AES-GCM under a PBKDF2 key from the password, in localStorage
  'dashboard-vaults'. The key lives only in memory (`DashboardContext`), so
  a refresh locks it again. A forgotten password means the data is gone.
  Recurring tasks double as habits (completion chart + streaks); timers
  ring from the provider, so they fire with the window closed. Desktop only.
  Planner is Google-Calendar-like: todos with `start`/`end` (minutes) are
  time blocks on the Day/Week hour grid; without them they're all-day.
  Drag & drop is pointer-based (`calendar/useCalendarDrag.ts`): drop targets
  carry `data-drop-date` + `data-drop-zone` (time | day | month) and events
  render inside their target. When the window is ≥1180×600 (ResizeObserver
  on the window, not the viewport) tabs give way to a one-page layout.
  One-page layout is a tiling tree (`tiles/layout.ts`): columns of stacked
  panels (calendar, day, timers, habits), flex weights in px-ish units,
  persisted in localStorage 'dashboard-tiles'; a panel not in the tree is
  closed. `TileLayout.tsx` drags a panel by its title bar onto another
  panel's edge (dock as new column / stack) or middle (swap), and resizes
  via dividers that write measured px back as weights (per-panel minW).
  The todo editor lives in `calendar/EditorHost.tsx` so the calendar and
  day list can sit in separate tiles. Tab mode keeps the fixed Planner
  (calendar + day list, width in 'dashboard-layout' via `Splitter.tsx`).
- Tailwind colors use `withAlpha()` (color-mix) so opacity modifiers like
  `bg-accent/20` work with CSS-variable colors; plain `var()` silently
  produced no CSS for them.
