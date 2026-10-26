import { chromium } from 'playwright';

const BASE = 'http://localhost:5199/portfolioOS/';
const BOOT_TEXT = "Type 'help' to see available commands.";
const ABOUT = 'img[alt="Jordan Cao"]';
const results = [];
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE);
await page.waitForTimeout(800);

// Terminal window should be open on load
const titleBar = page.locator('.window-drag-handle').first();
check('terminal window opens on load', await titleBar.isVisible());

// Ghost "help" hint typewrites on the empty prompt (full word ~1.7s in, held 2.2s)
await page.waitForTimeout(1500);
const ghostText = (await page.locator('span[aria-hidden="true"]').first().textContent()) ?? '';
check('ghost help hint typewrites on prompt', ghostText === 'help', `ghost="${ghostText}"`);

// --- DRAG: grab the title bar, move, window should follow ---
const before = await titleBar.boundingBox();
await page.mouse.move(before.x + 200, before.y + before.height / 2);
await page.mouse.down();
await page.mouse.move(before.x + 500, before.y + 250, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await titleBar.boundingBox();
const dx = after.x - before.x;
const dy = after.y - before.y;
check('drag moves the window', Math.abs(dx) > 200 && Math.abs(dy) > 150, `moved (${dx.toFixed(0)}, ${dy.toFixed(0)})`);

// --- MAXIMIZE: click green dot, window should fill desktop AND show content ---
await page.locator('button[aria-label="Maximize"]').first().click();
await page.waitForTimeout(400);
const maxBox = await titleBar.locator('..').boundingBox(); // the window root (motion div)
const vp = page.viewportSize();
check(
  'maximize fills the desktop',
  maxBox.width > vp.width - 10 && maxBox.height > vp.height - 60,
  `${maxBox.width.toFixed(0)}x${maxBox.height.toFixed(0)} at (${maxBox.x.toFixed(0)},${maxBox.y.toFixed(0)})`,
);
const promptVisible = await page.getByText(BOOT_TEXT).isVisible();
check('maximized window still shows content', promptVisible);

// Clicking title bar (no movement) should NOT un-maximize
await titleBar.click({ position: { x: 300, y: 15 } });
await page.waitForTimeout(300);
const stillMax = await titleBar.locator('..').boundingBox();
check('plain click does not un-maximize', stillMax.width > vp.width - 10);

// Maximize again toggles back to restored size
await page.locator('button[aria-label="Maximize"]').first().click();
await page.waitForTimeout(400);
const restored = await titleBar.locator('..').boundingBox();
check('maximize toggles back to previous size', restored.width < vp.width - 100, `${restored.width.toFixed(0)}x${restored.height.toFixed(0)}`);

// --- MINIMIZE: window hides, dock chip appears, click restores ---
await page.locator('button[aria-label="Minimize"]').first().click();
await page.waitForTimeout(500);
const winGone = !(await page.locator('.window-drag-handle').first().isVisible());
const dockChip = page.locator('button:has-text("Terminal")').last();
check('minimize hides window and shows dock chip', winGone && (await dockChip.isVisible()));
await dockChip.click();
await page.waitForTimeout(500);
check('dock chip restores the window', await page.locator('.window-drag-handle').first().isVisible());

// --- SNAP: drag to left edge, expect half-screen tile ---
const tb2 = page.locator('.window-drag-handle').first();
const b2 = await tb2.boundingBox();
await page.mouse.move(b2.x + 200, b2.y + 15);
await page.mouse.down();
await page.mouse.move(30, 450, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(400);
const snapped = await tb2.locator('..').boundingBox();
check(
  'drag to left edge snaps to left half',
  Math.abs(snapped.x) < 5 && Math.abs(snapped.width - vp.width / 2) < 10,
  `${snapped.width.toFixed(0)}px wide at x=${snapped.x.toFixed(0)}`,
);

// --- Terminal state survived minimize/restore, commands still work ---
check('terminal scrollback survives minimize/restore', await page.getByText(BOOT_TEXT).isVisible());
await page.mouse.click(300, 500); // click inside the (left-snapped) terminal to focus it
await page.keyboard.type('whoami');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('terminal whoami works', await page.locator('div.whitespace-pre-wrap').getByText('jordan', { exact: true }).isVisible());

// --- WORKSPACES: per-workspace windows, terminal auto-opens on first visit ---
// Workspace A's terminal has whoami output; a fresh terminal won't.
const whoamiOut = page.locator('div.whitespace-pre-wrap').getByText('jordan', { exact: true });
await page.locator('button[aria-label="Workspace 2"]').click();
await page.waitForTimeout(500);
const visibleBoots = await page
  .getByText(BOOT_TEXT)
  .filter({ visible: true })
  .count();
check(
  'workspace 2 auto-opens a fresh terminal',
  visibleBoots === 1 && !(await whoamiOut.isVisible()),
  `${visibleBoots} visible terminal(s)`,
);

await page.locator('button[aria-label="App launcher"]').click();
await page.locator('nav button:has-text("About")').click();
await page.waitForTimeout(400);
check(
  'launcher opens About on current workspace (2), no jump to 1',
  (await page.locator(ABOUT).isVisible()) && !(await whoamiOut.isVisible()),
);

await page.locator('button[aria-label="Workspace 1"]').click();
await page.waitForTimeout(300);
check(
  'workspace 1 unchanged: its terminal back, no About',
  (await whoamiOut.isVisible()) && !(await page.locator(ABOUT).isVisible()),
);

// Opening About on A creates a second, independent instance
await page.locator('button[aria-label="App launcher"]').click();
await page.locator('nav button:has-text("About")').click();
await page.waitForTimeout(400);
const aboutVisible = await page.locator(ABOUT).filter({ visible: true }).count();
const aboutCount = await page.locator(ABOUT).count();
check(
  'About opens separately on 1 too (2 instances)',
  aboutVisible === 1 && aboutCount === 2,
  `${aboutCount} instances, ${aboutVisible} visible`,
);

// --- THEMES app applies a theme ---
await page.locator('button[aria-label="App launcher"]').click();
await page.locator('nav button:has-text("Themes")').click();
await page.waitForTimeout(400);
await page.locator('button:has-text("Nord")').click();
await page.waitForTimeout(300);
const desktopVar = await page.evaluate(() =>
  document.documentElement.style.getPropertyValue('--color-desktop').trim(),
);
check('selecting Nord theme applies it', desktopVar === '#242933', `--color-desktop=${desktopVar}`);
const persisted = await page.evaluate(() => localStorage.getItem('theme'));
check('theme choice is persisted', persisted === 'nord', `localStorage.theme=${persisted}`);

// --- SPOTIFY app shows the embed player ---
await page.locator('button[aria-label="App launcher"]').click();
await page.locator('nav button:has-text("Spotify")').click();
await page.waitForTimeout(1500);
const spotifyFrame = page.locator('iframe[title="Spotify player"]');
check(
  'spotify window opens with embed player',
  (await spotifyFrame.isVisible()) &&
    (await spotifyFrame.getAttribute('src')).includes('open.spotify.com/embed'),
);

// --- KEYBOARD: Alt+Q closes the focused window, Alt+3 switches workspace ---
const visibleWindows = () => page.locator('.window-drag-handle').filter({ visible: true }).count();
const beforeClose = await visibleWindows();
await page.keyboard.press('Alt+KeyQ');
await page.waitForTimeout(400);
check('Alt+Q closes the focused window', (await visibleWindows()) === beforeClose - 1);
await page.keyboard.press('Alt+Digit3');
await page.waitForTimeout(400);
check('Alt+3 switches to workspace 3', (await page.locator('button[aria-label="Workspace 3"]').getAttribute('class')).includes('bg-accent '));

// --- TERMINAL: neofetch on boot, Tab completion, cat ---
check('neofetch shows on boot', await page.getByText('SWE Intern @ Mercury').filter({ visible: true }).first().isVisible());
await page.keyboard.type('cat con');
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('Tab completes and cat contact.txt prints email', await page.getByText(/^email\s+/).filter({ visible: true }).first().isVisible());

console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
