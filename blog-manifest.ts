import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Builds the blog's file index from public/blog, so adding a folder or
 * .md file and pushing is all it takes to publish. Dates come from git
 * history (created = first commit, updated = last commit); files that aren't
 * committed yet use their filesystem times. Dotfiles (.gitkeep, .DS_Store)
 * are skipped.
 */
const CONTENT_DIR = 'public/blog';

interface Entry {
  path: string;
  type: 'file' | 'folder';
  created: string;
  updated: string;
}

function gitDates(root: string): Map<string, { created: string; updated: string }> {
  const dates = new Map<string, { created: string; updated: string }>();
  try {
    // Newest commit first: the first date seen is "updated", the last is "created"
    const log = execFileSync('git', ['log', '--format=%x00%aI', '--name-only', '--', CONTENT_DIR], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let date = '';
    for (const line of log.split('\n')) {
      if (line.startsWith('\0')) date = line.slice(1);
      else if (line.startsWith(`${CONTENT_DIR}/`)) {
        const rel = line.slice(CONTENT_DIR.length + 1);
        const seen = dates.get(rel);
        if (seen) seen.created = date;
        else dates.set(rel, { created: date, updated: date });
      }
    }
  } catch {
    /* not a git checkout: filesystem times only */
  }
  return dates;
}

type Span = { created: string; updated: string };

/** Earliest created / latest updated of the two. */
function widen(span: Span | null, d: Span): Span {
  if (!span) return { ...d };
  return {
    created: d.created < span.created ? d.created : span.created,
    updated: d.updated > span.updated ? d.updated : span.updated,
  };
}

export function buildManifest(root: string): { entries: Entry[] } {
  const base = path.join(root, CONTENT_DIR);
  const dates = gitDates(root);
  const entries: Entry[] = [];

  const walk = (dir: string): { created: string; updated: string } | null => {
    let span: Span | null = null;
    for (const name of fs.readdirSync(path.join(base, dir))) {
      if (name.startsWith('.')) continue;
      const rel = dir ? `${dir}/${name}` : name;
      const stat = fs.statSync(path.join(base, rel));
      let d: { created: string; updated: string } | null;
      if (stat.isDirectory()) {
        d = walk(rel) ?? { created: stat.birthtime.toISOString(), updated: stat.mtime.toISOString() };
        entries.push({ path: rel, type: 'folder', ...d });
      } else {
        d = dates.get(rel) ?? { created: stat.birthtime.toISOString(), updated: stat.mtime.toISOString() };
        entries.push({ path: rel, type: 'file', ...d });
      }
      span = widen(span, d);
    }
    return span;
  };

  if (fs.existsSync(base)) walk('');
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries };
}

export default function blogManifest(): Plugin {
  let root = process.cwd();
  return {
    name: 'blog-manifest',
    configResolved(config) {
      root = config.root;
    },
    // Dev: generated fresh on every request, so new files show on reload
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].endsWith('/blog/manifest.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(buildManifest(root)));
        } else next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'blog/manifest.json',
        source: `${JSON.stringify(buildManifest(root), null, 2)}\n`,
      });
    },
  };
}
