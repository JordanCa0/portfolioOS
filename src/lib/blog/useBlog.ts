import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSET_FOLDER } from './config';
import { commit, fetchContent, getToken, listFiles, setToken, verifyToken, type Change } from './github';
import {
  MANIFEST,
  basename,
  cleanName,
  dirname,
  find,
  join,
  manifestFromFiles,
  planMove,
  readAsBase64,
  subtree,
  uniquePath,
  withParents,
  type Manifest,
} from './fs';

export interface Blog {
  manifest: Manifest | null;
  loadError: string | null;
  /** GitHub login when author mode is unlocked */
  author: string | null;
  busy: boolean;
  /** Blob URLs for photos uploaded this session (the CDN can lag a few minutes) */
  localImages: Map<string, string>;
  unlock: (token: string) => Promise<void>;
  lock: () => void;
  loadNote: (path: string) => Promise<string>;
  saveNote: (path: string, text: string) => Promise<void>;
  createNote: (dir: string, name: string) => Promise<string>;
  createFolder: (dir: string, name: string) => Promise<string>;
  uploadImages: (dir: string, files: File[]) => Promise<string[]>;
  rename: (path: string, name: string) => Promise<string>;
  remove: (path: string) => Promise<void>;
}

const nowIso = () => new Date().toISOString();

export function useBlog(): Blog {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const [localImages] = useState(() => new Map<string, string>());

  const manifestRef = useRef<Manifest | null>(null);
  const tokenRef = useRef<string | null>(getToken());
  const notes = useRef(new Map<string, string>());
  // Commits run one at a time: two parallel ones would race on the branch ref
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const loadManifest = useCallback(async (token: string | null) => {
    try {
      // The deployed index (dates from git history)…
      const res = await fetch(`${import.meta.env.BASE_URL}blog/${MANIFEST}`, { cache: 'no-cache' });
      const deployed = res.ok ? ((await res.json()) as Manifest) : null;
      // …and for the author, the repo's live file list, so pushes and
      // in-app edits show before the site finishes redeploying
      const m = token ? manifestFromFiles(await listFiles(token), deployed) : deployed;
      if (!m) throw new Error(`Couldn't load notes (${res.status})`);
      manifestRef.current = m;
      setManifest(m);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const token = tokenRef.current;
    loadManifest(token);
    if (token) {
      verifyToken(token).then(setAuthor, () => {
        tokenRef.current = null;
        setToken(null);
      });
    }
  }, [loadManifest]);

  /** Run a commit built from the latest manifest; updates state on success. */
  const run = useCallback(
    <T,>(build: (m: Manifest) => { message: string; changes: Change[]; next: Manifest; result: T }) => {
      const task = queue.current.then(async () => {
        const token = tokenRef.current;
        const m = manifestRef.current;
        if (!token) throw new Error('Unlock author mode to make changes.');
        if (!m) throw new Error('Notes are still loading.');
        const { message, changes, next, result } = build(m);
        if (!message) return result; // nothing to commit
        setBusyCount((n) => n + 1);
        try {
          await commit(token, message, changes);
          manifestRef.current = next;
          setManifest(next);
          return result;
        } finally {
          setBusyCount((n) => n - 1);
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [],
  );

  const unlock = useCallback(
    async (token: string) => {
      const login = await verifyToken(token.trim());
      tokenRef.current = token.trim();
      setToken(token.trim());
      setAuthor(login);
      notes.current.clear();
      await loadManifest(token.trim()); // fresh copy, bypassing the CDN cache
    },
    [loadManifest],
  );

  const lock = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    setAuthor(null);
  }, []);

  const loadNote = useCallback(async (path: string) => {
    const cached = notes.current.get(path);
    if (cached !== undefined) return cached;
    const res = await fetchContent(path, tokenRef.current);
    // The dev server (and some hosts) answer a missing file with the app's
    // index.html and a 200, so an HTML reply for a non-HTML note means "gone".
    const html = res.headers.get('content-type')?.includes('text/html') && !/\.html?$/i.test(path);
    if (res.status === 404 || html) {
      throw new Error(`${basename(path)} isn't here anymore. It may have been renamed or deleted.`);
    }
    if (!res.ok) throw new Error(`Couldn't open ${basename(path)} (${res.status})`);
    const text = await res.text();
    notes.current.set(path, text);
    return text;
  }, []);

  const saveNote = useCallback(
    (path: string, text: string) =>
      run((m) => {
        const now = nowIso();
        const isNew = !find(m, path);
        const next: Manifest = {
          entries: isNew
            ? [...m.entries, ...withParents(m, path, now), { path, type: 'file', created: now, updated: now }]
            : m.entries.map((e) => (e.path === path ? { ...e, updated: now } : e)),
        };
        return {
          message: `${isNew ? 'Add' : 'Update'} ${path}`,
          changes: [{ path, text }],
          next,
          result: undefined,
        };
      }).then(() => {
        notes.current.set(path, text);
      }),
    [run],
  );

  const createNote = useCallback(
    async (dir: string, name: string) => {
      const clean = cleanName(name);
      if (!clean) throw new Error('Give the note a name.');
      const fileName = /\.(md|txt)$/i.test(clean) ? clean : `${clean}.md`;
      const path = uniquePath(manifestRef.current!, dir, fileName);
      await saveNote(path, `# ${clean.replace(/\.(md|txt)$/i, '')}\n\n`);
      return path;
    },
    [saveNote],
  );

  const createFolder = useCallback(
    (dir: string, name: string) =>
      run((m) => {
        const clean = cleanName(name);
        if (!clean) throw new Error('Give the folder a name.');
        const path = uniquePath(m, dir, clean);
        const now = nowIso();
        // Git can't store an empty folder; an empty .gitkeep holds its place
        const keep = `${path}/.gitkeep`;
        return {
          message: `Create folder ${path}`,
          changes: [{ path: keep, text: '' }],
          next: {
            entries: [
              ...m.entries,
              { path, type: 'folder', created: now, updated: now },
              { path: keep, type: 'file', created: now, updated: now },
            ],
          },
          result: path,
        };
      }),
    [run],
  );

  const uploadImages = useCallback(
    async (dir: string, files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (!images.length) throw new Error('Only images can be uploaded.');
      const tooBig = images.find((f) => f.size > 20 * 1024 * 1024);
      if (tooBig) throw new Error(`${tooBig.name} is over 20 MB.`);
      const encoded = await Promise.all(images.map(readAsBase64));
      return run((m) => {
        const target = dir || ASSET_FOLDER;
        const now = nowIso();
        const entries = [...m.entries, ...withParents(m, join(target, 'x'), now)];
        if (!entries.some((e) => e.path === target)) {
          entries.push({ path: target, type: 'folder', created: now, updated: now });
        }
        const paths: string[] = [];
        const changes: Change[] = images.map((f, i) => {
          const ext = f.name.includes('.') ? '' : `.${f.type.split('/')[1] || 'png'}`;
          const name = cleanName(f.name) || 'photo';
          const path = uniquePath({ entries }, target, `${name.replace(/\s+/g, '-')}${ext}`);
          entries.push({ path, type: 'file', created: now, updated: now });
          paths.push(path);
          localImages.set(path, URL.createObjectURL(f));
          return { path, base64: encoded[i] };
        });
        return {
          message: `Upload ${paths.join(', ')}`,
          changes,
          next: { entries },
          result: paths,
        };
      });
    },
    [run, localImages],
  );

  const rename = useCallback(
    (path: string, name: string) =>
      run((m) => {
        const entry = find(m, path);
        if (!entry) throw new Error(`${path} no longer exists.`);
        let clean = cleanName(name);
        if (!clean) throw new Error('The name can’t be empty.');
        const ext = basename(path).match(/\.[^.]+$/)?.[0] ?? '';
        if (entry.type === 'file' && ext && !clean.includes('.')) clean += ext;
        const to = join(dirname(path), clean);
        if (to === path) return { message: '', changes: [], next: m, result: path };
        if (find(m, to)) throw new Error(`${clean} already exists here.`);
        const { changes, next } = planMove(m, path, to);
        for (const e of subtree(m, path)) {
          const text = notes.current.get(e.path);
          if (text !== undefined) notes.current.set(to + e.path.slice(path.length), text);
          const img = localImages.get(e.path);
          if (img) localImages.set(to + e.path.slice(path.length), img);
        }
        return { message: `Rename ${path} → ${to}`, changes, next, result: to };
      }),
    [run, localImages],
  );

  const remove = useCallback(
    (path: string) =>
      run((m) => {
        const gone = subtree(m, path);
        const goneSet = new Set(gone.map((e) => e.path));
        return {
          message: `Delete ${path}`,
          changes: gone.filter((e) => e.type === 'file').map((e) => ({ path: e.path, delete: true as const })),
          next: { entries: m.entries.filter((e) => !goneSet.has(e.path)) },
          result: undefined,
        };
      }),
    [run],
  );

  return {
    manifest,
    loadError,
    author,
    busy: busyCount > 0,
    localImages,
    unlock,
    lock,
    loadNote,
    saveNote,
    createNote,
    createFolder,
    uploadImages,
    rename,
    remove,
  };
}
