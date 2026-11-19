/**
 * Dashboard accounts live only in this browser. Each account is a vault in
 * localStorage: the data is encrypted with AES-GCM under a key derived from
 * the password (PBKDF2), so the password itself is never stored and a wrong
 * password simply fails to decrypt.
 */
import { emptyData, type DashData } from './model';

const STORAGE_KEY = 'dashboard-vaults';
const ITERATIONS = 250_000;

interface Vault {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

export const USERNAME_RE = /^[a-z0-9_-]{1,32}$/;
export const MIN_PASSWORD = 6;

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function readVaults(): Record<string, Vault> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Vault>;
  } catch {
    return {};
  }
}

function writeVault(user: string, vault: Vault) {
  const all = readVaults();
  all[user] = vault;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function normalizeUser(user: string): string {
  return user.trim().toLowerCase();
}

export function accountExists(user: string): boolean {
  return normalizeUser(user) in readVaults();
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface Session {
  user: string;
  key: CryptoKey;
  salt: string;
}

export async function saveVault(session: Session, data: DashData): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    session.key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  writeVault(session.user, { v: 1, salt: session.salt, iv: b64(iv), ct: b64(ct) });
}

export async function createAccount(
  user: string,
  password: string,
): Promise<{ session: Session; data: DashData }> {
  const name = normalizeUser(user);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const session = { user: name, key: await deriveKey(password, salt), salt: b64(salt) };
  const data = emptyData();
  await saveVault(session, data);
  return { session, data };
}

/** Null when the account doesn't exist or the password is wrong. */
export async function unlock(
  user: string,
  password: string,
): Promise<{ session: Session; data: DashData } | null> {
  const name = normalizeUser(user);
  const vault = readVaults()[name];
  if (!vault) return null;
  try {
    const key = await deriveKey(password, unb64(vault.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(vault.iv) },
      key,
      unb64(vault.ct),
    );
    const data = { ...emptyData(), ...(JSON.parse(new TextDecoder().decode(plain)) as DashData) };
    return { session: { user: name, key, salt: vault.salt }, data };
  } catch {
    return null;
  }
}
