import fs from 'node:fs';
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

// --- DASHBOARD: tty-style login with hidden password, encrypted vault ---
const term = page.locator('input[aria-label="jordan@portfolio:~$"]').filter({ visible: true });
const SECRET = 'hunter22';
await page.evaluate(() => localStorage.removeItem('dashboard-vaults'));
await term.fill('dashboard');
await term.press('Enter');
const loginInput = page.locator('input[aria-label="login:"]');
await loginInput.fill('tester');
await loginInput.press('Enter');
const newPw = page.locator('input[aria-label="New password:"]');
check('unknown user is offered a new account', await newPw.isVisible());
check('password prompt is a hidden field', (await newPw.getAttribute('type')) === 'password');
await newPw.fill(SECRET);
await newPw.press('Enter');
const confirmPw = page.locator('input[aria-label="Retype new password:"]');
await confirmPw.fill(SECRET);
await confirmPw.press('Enter');
const lockBtn = page.locator('button[aria-label="Log out"]');
await lockBtn.waitFor({ timeout: 8000 });
check('account creation opens the dashboard', await lockBtn.isVisible());
check(
  'password is never echoed to the terminal',
  (await page.getByText(SECRET).count()) === 0 &&
    (await page.getByText(/^New password: $/).filter({ visible: true }).count()) === 1,
);

await page.locator('input[aria-label="New todo"]').fill('Write tests');
await page.locator('input[aria-label="New todo"]').press('Enter');
const dayPanel = page.locator('aside[aria-label="Selected day"]');
await dayPanel.locator('button[aria-label="Check Write tests"]').click();
check('todo can be added and checked off', await dayPanel.locator('button[aria-label="Uncheck Write tests"]').isVisible());

// --- CALENDAR: Google-Calendar-style time blocks and drag & drop ---
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
const today = ymd(now);
// A neighbour day in the same Mon–Sun week
const other = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getDay() === 0 ? -1 : 1)));
const HOUR = 44;
await page.locator('[data-testid="time-grid"]').evaluate((el) => (el.scrollTop = 8 * 44));
const col = (date) => page.locator(`[data-drop-zone="time"][data-drop-date="${date}"]`);
const yAt = async (date, min) => (await col(date).boundingBox()).y + (min / 60) * HOUR;
const xOf = async (date) => { const b = await col(date).boundingBox(); return b.x + b.width / 2; };
const dragTo = async (x1, y1, x2, y2) => {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
};

await dragTo(await xOf(today), (await yAt(today, 600)) + 3, await xOf(today), (await yAt(today, 690)) + 3);
const title = page.locator('input[aria-label="New event title"]');
await title.fill('Deep work');
await title.press('Enter');
const block = (date) => col(date).locator('[role="button"][aria-label^="Deep work"]');
check('dragging on the grid creates a time block', (await block(today).getAttribute('aria-label'))?.includes('10:00') && (await block(today).getAttribute('aria-label'))?.includes('11:30'), await block(today).getAttribute('aria-label'));

const bb = await block(today).boundingBox();
await dragTo(bb.x + 10, bb.y + 8, await xOf(other), (await yAt(other, 840)) + 8);
check('dragging a block moves it to another day and time', (await block(other).count()) === 1 && (await block(today).count()) === 0 && (await block(other).getAttribute('aria-label')).includes('2:00'), await block(other).getAttribute('aria-label'));

const bb2 = await block(other).boundingBox();
await dragTo(bb2.x + 10, bb2.y + bb2.height - 2, bb2.x + 10, bb2.y + bb2.height - 2 + HOUR);
check('dragging the bottom edge resizes a block', (await block(other).getAttribute('aria-label')).includes('4:30'), await block(other).getAttribute('aria-label'));

await block(other).click();
check('clicking a block opens its editor', await page.locator('[role="dialog"][aria-label="Edit Deep work"]').isVisible());
await page.keyboard.press('Escape');

await page.locator('[role="tab"]:has-text("month")').click();
const chip = page.locator(`[data-drop-zone="month"][data-drop-date="${today}"] span[title="Write tests"]`);
const cb = await chip.boundingBox();
const target = await page.locator(`[data-drop-zone="month"][data-drop-date="${other}"]`).boundingBox();
await dragTo(cb.x + 10, cb.y + 5, target.x + target.width / 2, target.y + target.height - 10);
check('month view: dragging a todo moves it to another day', (await page.locator(`[data-drop-zone="month"][data-drop-date="${other}"] span[title="Write tests"]`).count()) === 1);
// put it back for the persistence check below
const cb2 = await page.locator(`[data-drop-zone="month"][data-drop-date="${other}"] span[title="Write tests"]`).boundingBox();
const back = await page.locator(`[data-drop-zone="month"][data-drop-date="${today}"]`).boundingBox();
await dragTo(cb2.x + 10, cb2.y + 5, back.x + back.width / 2, back.y + back.height - 10);
await page.locator(`[data-drop-zone="month"][data-drop-date="${today}"]`).click({ position: { x: 5, y: 5 } });

await page.locator('button[role="tab"]:has-text("Habits")').click();
await page.locator('input[aria-label="New recurring task"]').fill('Read');
await page.locator('input[aria-label="New recurring task"]').press('Enter');
const todayKey = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
await page.locator(`button[aria-label="Read on ${todayKey}: not done"]`).click();
check(
  'habit check-in shows in the completion chart',
  (await page.locator(`[role="listitem"][aria-label="${todayKey}: 100% (1 of 1)"]`).count()) === 1,
);

await page.locator('button[role="tab"]:has-text("Timers")').click();
await page.getByRole('button', { name: '5m', exact: true }).click();
await page.locator('button:has-text("Start")').click();
await page.waitForTimeout(1300);
check('timer counts down', /^4:5\d$/.test((await page.locator('p.text-3xl').first().textContent()) ?? ''));

await page.waitForTimeout(500); // let the debounced save land
const vault = await page.evaluate(() => localStorage.getItem('dashboard-vaults') ?? '');
check('vault is encrypted at rest', vault.includes('"tester"') && !vault.includes('Write tests'));

await lockBtn.click();
check('lock returns to the locked screen', await page.getByText('Dashboard is locked').isVisible());
await term.fill('dashboard tester');
await term.press('Enter');
const pw = page.locator('input[aria-label="Password:"]');
await pw.fill('wrong-password');
await pw.press('Enter');
await page.getByText('Login incorrect').waitFor({ timeout: 8000 });
check('wrong password is rejected', await page.getByText('Login incorrect').isVisible());
await term.fill('dashboard tester');
await term.press('Enter');
await pw.fill(SECRET);
await pw.press('Enter');
await lockBtn.waitFor({ timeout: 8000 });
await page.locator('button[role="tab"]:has-text("Planner")').click();
check('correct password restores saved data', await dayPanel.locator('button[aria-label="Uncheck Write tests"]').isVisible());

const dashMax = page.locator('.window-drag-handle:has-text("Dashboard") button[aria-label="Maximize"]');
await dashMax.click();
await page.waitForTimeout(400);
const panel = (name) => page.locator(`section[data-panel="${name}"]`);
const box = async (name) => panel(name).boundingBox();
check(
  'maximized dashboard tiles every panel on one page',
  (await page.locator('[data-layout="wide"]').count()) === 1 &&
    (await Promise.all(['calendar', 'day', 'timers', 'habits'].map((n) => panel(n).isVisible()))).every(Boolean),
);

// --- REARRANGE: drag a panel's title bar onto another panel's edge or middle ---
const dragPanel = async (name, target, fx, fy) => {
  const h = await panel(name).locator('header').boundingBox();
  const t = await box(target);
  await page.mouse.move(h.x + 60, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 80, h.y + 20, { steps: 3 });
  await page.mouse.move(t.x + t.width * fx, t.y + t.height * fy, { steps: 6 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(150);
};
// Timers to the left edge of the calendar: becomes the first column
await dragPanel('timers', 'calendar', 0.08, 0.5);
let [tm, cal] = [await box('timers'), await box('calendar')];
check('docking a panel on another’s left edge makes it a new column there', tm.x < cal.x && Math.abs(tm.height - cal.height) < 4, `timers x=${tm.x} cal x=${cal.x}`);
// Habits onto the middle of the timers panel: they swap places
const habitsBefore = await box('habits');
await dragPanel('habits', 'timers', 0.5, 0.5);
const [hb, tm2] = [await box('habits'), await box('timers')];
check('dropping on a panel’s middle swaps the two', hb.x < cal.x && Math.abs(tm2.x - habitsBefore.x) < 4, `habits x=${hb.x}, timers x=${tm2.x}`);
// Day list onto the bottom edge of habits: stacks under it
await dragPanel('day', 'habits', 0.5, 0.92);
const [hb2, dayBox] = [await box('habits'), await box('day')];
check('docking on a bottom edge stacks the panels in one column', Math.abs(dayBox.x - hb2.x) < 4 && dayBox.y > hb2.y, `day (${dayBox.x},${dayBox.y}) habits (${hb2.x},${hb2.y})`);
const savedTiles = JSON.parse(await page.evaluate(() => localStorage.getItem('dashboard-tiles')));
check('the arrangement is remembered', savedTiles[0].tiles.map((t) => t.id).join() === 'habits,day', JSON.stringify(savedTiles.map((c) => c.tiles.map((t) => t.id))));

// --- RESIZE: dividers between columns and between stacked panels ---
const splitterBetween = (label) => page.locator(`[role="separator"][aria-label="${label}"]`);
const dragBy = async (loc, dx, dy) => {
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
  await page.mouse.move(x + dx, y + dy, { steps: 3 });
  await page.mouse.up();
};
const w0 = (await box('habits')).width;
await dragBy(splitterBetween('Resize habits column'), 60, 0); // calendar column keeps its 380px minimum
const h0 = (await box('habits')).height;
await dragBy(splitterBetween('Resize habits panel'), 0, 100);
check('dividers resize columns and stacked panels',
  Math.abs((await box('habits')).width - w0 - 60) <= 3 && Math.abs((await box('habits')).height - h0 - 100) <= 3,
  `w ${w0}→${(await box('habits')).width}, h ${h0}→${(await box('habits')).height}`);
await dragBy(splitterBetween('Resize habits column'), 600, 0);
check('a column can’t be squeezed below its minimum', Math.abs((await box('calendar')).width - 380) <= 2, `calendar ${(await box('calendar')).width}px`);

// --- CLOSE / REOPEN ---
const panelToggle = (name) => page.locator(`[role="group"][aria-label="Panels"] button:has-text("${name}")`);
await panel('habits').locator('button[aria-label="Close habits"]').click();
check('closing a panel removes it and the toggle shows it closed',
  (await panel('habits').count()) === 0 && (await panelToggle('Habits').getAttribute('aria-pressed')) === 'false' && (await box('day')).height > h0 + 200);
await panelToggle('Habits').click();
check('the toggle reopens a closed panel', await panel('habits').isVisible());
await panel('calendar').locator('button[aria-label="Close calendar"]').click();
check('with the calendar closed, the day list gets its own day arrows', await panel('day').locator('button[aria-label="Next day"]').isVisible());
for (const n of ['day', 'timers', 'habits']) await panel(n).locator(`button[aria-label="Close ${n === 'day' ? 'day list' : n}"]`).click();
check('all panels closed shows a way back', await page.getByText('All panels are closed').isVisible());
await page.locator('button:has-text("Show everything")').click();
check('Show everything restores the default layout',
  (await Promise.all(['calendar', 'day', 'timers', 'habits'].map((n) => panel(n).isVisible()))).every(Boolean) &&
    (await page.locator('button:has-text("Reset layout")').isDisabled()));


// --- BACKUP: export here, import into a browser with empty storage (e.g. the live site) ---
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('button:has-text("Export")').click()]);
const backupPath = await dl.path();
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
check('Export downloads an encrypted backup', dl.suggestedFilename() === 'dashboard-tester.json' && backup.user === 'tester' && !JSON.stringify(backup).includes('Write tests'), dl.suggestedFilename());

const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
await page2.goto(BASE);
await page2.waitForTimeout(800);
const term2 = page2.locator('input[aria-label="jordan@portfolio:~$"]').filter({ visible: true });
const importVia = async (file) => {
  const [chooser] = await Promise.all([page2.waitForEvent('filechooser'), (async () => { await term2.fill('dashboard import'); await term2.press('Enter'); })()]);
  await chooser.setFiles(file);
  await page2.waitForTimeout(300);
};
const junk = backupPath + '.junk.json';
fs.writeFileSync(junk, '{"hello":"world"}');
await importVia(junk);
check('importing a non-backup file is refused', await page2.getByText('dashboard: import failed: not a dashboard backup').isVisible());
await importVia(backupPath);
check('dashboard import restores the account in a fresh browser', await page2.getByText("Imported 'tester'. Log in with: dashboard tester").isVisible());
await term2.fill('dashboard tester');
await term2.press('Enter');
await page2.locator('input[aria-label="Password:"]').fill(SECRET);
await page2.locator('input[aria-label="Password:"]').press('Enter');
await page2.locator('button[aria-label="Log out"]').waitFor({ timeout: 8000 });
check('the imported account opens with its password and keeps its data',
  (await page2.locator('aside[aria-label="Selected day"] button[aria-label="Uncheck Write tests"]').count()) === 1);
await importVia(backupPath);
check('importing over an existing account asks first', await page2.getByText("An account 'tester' already exists in this browser.").isVisible());
const ow = page2.locator('input[aria-label="Replace it? [y/N]"]');
await ow.fill('n');
await ow.press('Enter');
check('declining leaves the account untouched', await page2.getByText('Import cancelled. Nothing changed.').isVisible());
await ctx2.close();

console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
