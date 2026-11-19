import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DashData } from '../../../lib/dashboard/model';
import {
  accountExists,
  createAccount,
  saveVault,
  unlock,
  type Session,
} from '../../../lib/dashboard/vault';

interface DashboardContextValue {
  /** Signed-in username, null while locked */
  user: string | null;
  data: DashData | null;
  update: (fn: (d: DashData) => DashData) => void;
  exists: (user: string) => boolean;
  login: (user: string, password: string) => Promise<boolean>;
  register: (user: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboard outside DashboardProvider');
  return ctx;
}

/** A short two-note chime when a timer finishes */
function chime() {
  try {
    const ac = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const t = ac.currentTime + i * 0.22;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(() => ac.close(), 1200);
  } catch {
    // no audio available
  }
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // The key only ever lives in memory: a refresh locks the dashboard again
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashData | null>(null);
  const dirty = useRef(false);

  const update = useCallback((fn: (d: DashData) => DashData) => {
    dirty.current = true;
    setData((d) => (d ? fn(d) : d));
  }, []);

  // Encrypt + save shortly after each change
  useEffect(() => {
    if (!session || !data || !dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      saveVault(session, data).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [session, data]);

  // Timers ring here, so they fire even with the dashboard window closed
  const hasRunning = !!data?.timers.some((t) => t.endsAt !== null);
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => {
      const now = Date.now();
      setData((d) => {
        if (!d || !d.timers.some((t) => t.endsAt !== null && t.endsAt <= now)) return d;
        chime();
        dirty.current = true;
        return {
          ...d,
          timers: d.timers.map((t) =>
            t.endsAt !== null && t.endsAt <= now ? { ...t, endsAt: null, remaining: 0 } : t,
          ),
        };
      });
    }, 500);
    return () => clearInterval(id);
  }, [hasRunning]);

  const login = useCallback(async (user: string, password: string) => {
    const res = await unlock(user, password);
    if (!res) return false;
    dirty.current = false;
    setSession(res.session);
    setData(res.data);
    return true;
  }, []);

  const register = useCallback(async (user: string, password: string) => {
    const res = await createAccount(user, password);
    dirty.current = false;
    setSession(res.session);
    setData(res.data);
  }, []);

  const logout = useCallback(async () => {
    if (session && data && dirty.current) await saveVault(session, data);
    dirty.current = false;
    setSession(null);
    setData(null);
  }, [session, data]);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        data,
        update,
        exists: accountExists,
        login,
        register,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
