/** Page load time; the top bar and neofetch report uptime from here. */
export const BOOT_TIME = Date.now();

/** Compact uptime like `up 42s`, `up 7m`, `up 1h 3m`. */
export function formatUptime(now: number = Date.now()): string {
  const s = Math.floor((now - BOOT_TIME) / 1000);
  if (s < 60) return `up ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `up ${m}m`;
  return `up ${Math.floor(m / 60)}h ${m % 60}m`;
}
