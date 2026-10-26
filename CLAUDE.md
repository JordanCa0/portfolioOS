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
