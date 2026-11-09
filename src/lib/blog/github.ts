import { BRANCH, CONTENT_DIR, OWNER, REPO } from './config';

const API = 'https://api.github.com';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${CONTENT_DIR}`;
/** Content as deployed with the site (rebuilt on every push). */
const SITE = `${import.meta.env.BASE_URL}blog`;
const TOKEN_KEY = 'blog-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: token lasts for this page only */
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.message) msg = `${res.status}: ${body.message}`;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`GitHub ${msg}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Checks the token can push to the blog repo. Returns the GitHub username. */
export async function verifyToken(token: string): Promise<string> {
  const repo = await gh<{ permissions?: { push?: boolean } }>(token, `/repos/${OWNER}/${REPO}`);
  if (!repo.permissions?.push) {
    throw new Error(`This token can read ${OWNER}/${REPO} but can't write to it.`);
  }
  const user = await gh<{ login: string }>(token, '/user').catch(() => ({ login: OWNER }));
  return user.login;
}

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/**
 * Fetch a content file. Visitors read the deployed copy; with a token it's
 * read through the API instead, so edits show before the site redeploys.
 */
export async function fetchContent(path: string, token: string | null): Promise<Response> {
  if (token) {
    const res = await fetch(
      `${API}/repos/${OWNER}/${REPO}/contents/${enc(`${CONTENT_DIR}/${path}`)}?ref=${BRANCH}`,
      { headers: { Accept: 'application/vnd.github.raw', Authorization: `Bearer ${token}` } },
    );
    if (res.ok) return res;
  }
  return fetch(`${SITE}/${enc(path)}`, { cache: 'no-cache' });
}

/** URL for a content file, for <img src>. Authors see the repo copy (newer than the site). */
export function contentUrl(path: string, author = false): string {
  return `${author ? RAW : SITE}/${enc(path)}`;
}

/** Every file under CONTENT_DIR on BRANCH (paths relative to it), dotfiles included. */
export async function listFiles(token: string): Promise<string[]> {
  const tree = await gh<{ tree: Array<{ path: string; type: string }>; truncated: boolean }>(
    token,
    `/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`,
  );
  const prefix = `${CONTENT_DIR}/`;
  return tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(prefix)).map((t) => t.path.slice(prefix.length));
}

export type Change =
  | { path: string; text: string }
  | { path: string; base64: string }
  | { path: string; delete: true }
  | { path: string; copyFrom: string };

/**
 * Apply every change in ONE commit on BRANCH (git data API), e.g. a folder
 * rename moves all its files at once. Paths are relative to CONTENT_DIR.
 * Returns the new commit sha.
 */
export async function commit(token: string, message: string, changes: Change[]): Promise<string> {
  const base = `/repos/${OWNER}/${REPO}/git`;
  const ref = await gh<{ object: { sha: string } }>(token, `${base}/ref/heads/${BRANCH}`);
  const parent = await gh<{ tree: { sha: string } }>(token, `${base}/commits/${ref.object.sha}`);

  let existing: Map<string, string> | null = null;
  if (changes.some((c) => 'copyFrom' in c)) {
    const tree = await gh<{ tree: Array<{ path: string; sha: string; type: string }> }>(
      token,
      `${base}/trees/${parent.tree.sha}?recursive=1`,
    );
    existing = new Map(tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha]));
  }

  const entries = await Promise.all(
    changes.map(async (c) => {
      const path = `${CONTENT_DIR}/${c.path}`;
      if ('delete' in c) return { path, mode: '100644', type: 'blob', sha: null };
      if ('copyFrom' in c) {
        const sha = existing?.get(`${CONTENT_DIR}/${c.copyFrom}`);
        if (!sha) throw new Error(`Can't find ${c.copyFrom} in the repo`);
        return { path, mode: '100644', type: 'blob', sha };
      }
      const blob = await gh<{ sha: string }>(token, `${base}/blobs`, {
        method: 'POST',
        body: JSON.stringify(
          'text' in c ? { content: c.text, encoding: 'utf-8' } : { content: c.base64, encoding: 'base64' },
        ),
      });
      return { path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  const tree = await gh<{ sha: string }>(token, `${base}/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
  });
  const next = await gh<{ sha: string }>(token, `${base}/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  await gh(token, `${base}/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: next.sha }),
  });
  return next.sha;
}
