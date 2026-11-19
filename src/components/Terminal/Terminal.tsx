import { useEffect, useRef, useState } from 'react';
import type { AppId } from '../../types';
import { complete, executeCommand } from './commands';
import Neofetch from './Neofetch';
import { useDashboard } from '../apps/dashboard/DashboardContext';
import { MIN_PASSWORD, normalizeUser, USERNAME_RE } from '../../lib/dashboard/vault';

/** Interactive `dashboard` login, step by step like a tty login */
type Auth =
  | { step: 'user' }
  | { step: 'password'; user: string }
  | { step: 'new'; user: string }
  | { step: 'confirm'; user: string; first: string }
  | { step: 'busy'; label: string };

const AUTH_PROMPT: Record<Auth['step'], string> = {
  user: 'login: ',
  password: 'Password: ',
  new: 'New password: ',
  confirm: 'Retype new password: ',
  busy: '',
};

const isSecret = (a: Auth | null) =>
  a?.step === 'password' || a?.step === 'new' || a?.step === 'confirm';

interface TerminalProps {
  openApp: (appId: AppId) => void;
  /** Its window has focus; the prompt grabs keyboard focus to match */
  focused: boolean;
}

interface Line {
  type: 'input' | 'output' | 'boot' | 'neofetch';
  text: string;
}

const PROMPT = 'jordan@portfolio:~$';

const BOOT_LINES: Line[] = [
  { type: 'neofetch', text: '' },
  { type: 'boot', text: "Type 'help' to see available commands." },
];

export default function Terminal({ openApp, focused }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>(BOOT_LINES);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  // Ghost "help" hint typewritten on the prompt until the first command
  const [ghost, setGhost] = useState('');
  const [showGhost, setShowGhost] = useState(true);
  const [auth, setAuth] = useState<Auth | null>(null);
  const dash = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const print = (...texts: string[]) =>
    setLines((ls) => [...ls, ...texts.map((text): Line => ({ type: 'output', text }))]);

  // Re-focus the prompt after async steps (the input is disabled while busy)
  useEffect(() => {
    if (auth?.step !== 'busy' && focused) inputRef.current?.focus();
  }, [auth, focused]);

  const startDashboard = (args: string[]) => {
    if (args[0] === 'logout') {
      if (!dash.user) return print('dashboard: not logged in');
      const user = dash.user;
      void dash.logout().then(() => print(`Logged out ${user}. Dashboard locked.`));
      return;
    }
    if (args.length > 1 || (args[0] && !USERNAME_RE.test(normalizeUser(args[0])))) {
      return print('usage: dashboard [username] | dashboard logout');
    }
    if (dash.user && (!args[0] || normalizeUser(args[0]) === dash.user)) {
      openApp('dashboard');
      return print(`Opening dashboard for ${dash.user}...`);
    }
    if (args[0]) askPassword(normalizeUser(args[0]));
    else setAuth({ step: 'user' });
  };

  const askPassword = (user: string) => {
    if (dash.exists(user)) {
      setAuth({ step: 'password', user });
    } else {
      print(
        `No account '${user}' in this browser. Creating one.`,
        'Your data is encrypted with this password and stays on this device.',
      );
      setAuth({ step: 'new', user });
    }
  };

  const runAuth = async (a: Auth, value: string) => {
    // Echo the prompt; secrets are never shown, like a real tty
    print(`${AUTH_PROMPT[a.step]}${isSecret(a) ? '' : value}`);
    switch (a.step) {
      case 'user': {
        const user = normalizeUser(value);
        if (!user) return setAuth(null);
        if (!USERNAME_RE.test(user)) {
          print('Usernames are 1–32 chars: letters, digits, - and _.');
          return setAuth({ step: 'user' });
        }
        return askPassword(user);
      }
      case 'password': {
        setAuth({ step: 'busy', label: 'Decrypting...' });
        const ok = await dash.login(a.user, value);
        setAuth(null);
        if (!ok) return print('Login incorrect');
        print(`Welcome back, ${a.user}.`);
        return openApp('dashboard');
      }
      case 'new':
        if (value.length < MIN_PASSWORD) {
          print(`BAD PASSWORD: it must be at least ${MIN_PASSWORD} characters.`);
          return setAuth({ step: 'new', user: a.user });
        }
        return setAuth({ step: 'confirm', user: a.user, first: value });
      case 'confirm':
        if (value !== a.first) {
          setAuth(null);
          return print('Sorry, passwords do not match. No account created.');
        }
        setAuth({ step: 'busy', label: 'Creating account...' });
        try {
          await dash.register(a.user, value);
          print(`Account '${a.user}' created.`);
          openApp('dashboard');
        } catch {
          print('dashboard: could not save the account (is storage disabled?)');
        }
        return setAuth(null);
    }
  };

  // Take keyboard focus whenever the window is focused (incl. on open)
  useEffect(() => {
    if (focused) inputRef.current?.focus();
  }, [focused]);

  useEffect(() => {
    if (!showGhost) {
      setGhost('');
      return;
    }
    const word = 'help';
    let timer: number;
    // Type a character at a time, hold the full word, clear, repeat
    const tick = (idx: number) => {
      setGhost(word.slice(0, idx));
      if (idx < word.length) {
        timer = window.setTimeout(() => tick(idx + 1), 260);
      } else {
        timer = window.setTimeout(() => tick(0), 2200);
      }
    };
    timer = window.setTimeout(() => tick(1), 900);
    return () => clearTimeout(timer);
  }, [showGhost]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const submit = () => {
    const value = input;
    setInput('');
    setHistoryIdx(-1);
    setShowGhost(false);
    if (auth) {
      void runAuth(auth, value);
      return;
    }
    if (value.trim()) setHistory((h) => [value, ...h]);

    const result = executeCommand(value, { openApp });
    if ('dashboard' in result) {
      setLines((ls) => [...ls, { type: 'input', text: value }]);
      startDashboard(result.dashboard);
      return;
    }
    if ('clear' in result) {
      setLines([]);
      return;
    }
    if ('neofetch' in result) {
      setLines((ls) => [
        ...ls,
        { type: 'input', text: value },
        { type: 'neofetch', text: '' },
      ]);
      return;
    }
    setLines((ls) => [
      ...ls,
      { type: 'input', text: value },
      ...result.lines.map((text): Line => ({ type: 'output', text })),
    ]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (auth) {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Tab') e.preventDefault();
      else if ((e.key === 'c' && e.ctrlKey) || e.key === 'Escape') {
        // ^C abandons the login
        e.preventDefault();
        print(`${AUTH_PROMPT[auth.step]}^C`);
        setInput('');
        setAuth(null);
      }
      return;
    }
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab on the empty prompt accepts the ghost hint
      if (input === '' && showGhost) {
        setInput('help');
        setShowGhost(false);
        return;
      }
      const { value, options } = complete(input);
      setInput(value);
      setShowGhost(false);
      // Ambiguous: list the candidates under the prompt, like bash
      if (options.length > 1) {
        setLines((ls) => [
          ...ls,
          { type: 'input', text: input },
          { type: 'output', text: options.join('  ') },
        ]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(historyIdx + 1, history.length - 1);
      if (idx >= 0 && history[idx] !== undefined) {
        setHistoryIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setInput(idx >= 0 ? history[idx] : '');
    }
  };

  return (
    <div
      ref={scrollRef}
      className="h-full cursor-text overflow-y-auto p-3 text-[13px] leading-relaxed"
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((line, i) =>
        line.type === 'neofetch' ? (
          <Neofetch key={i} />
        ) : line.type === 'input' ? (
          <div key={i} className="whitespace-pre-wrap break-words">
            <span className="text-term-green">jordan@portfolio</span>
            <span className="text-body-muted">:</span>
            <span className="text-term-pink">~</span>
            <span className="text-body-muted">$ </span>
            {line.text}
          </div>
        ) : (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words ${
              line.type === 'boot' ? 'text-accent-soft' : ''
            }`}
          >
            {line.text || ' '}
          </div>
        ),
      )}
      <div className="flex">
        {auth ? (
          <span className="shrink-0 whitespace-pre">
            {auth.step === 'busy' ? (
              <span className="text-body-muted">{auth.label}</span>
            ) : (
              AUTH_PROMPT[auth.step]
            )}
          </span>
        ) : (
          <span className="shrink-0">
            <span className="text-term-green">jordan@portfolio</span>
            <span className="text-body-muted">:</span>
            <span className="text-term-pink">~</span>
            <span className="text-body-muted">$&nbsp;</span>
          </span>
        )}
        <span className="relative min-w-0 flex-1">
          {isSecret(auth) && focused && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 h-[1.1em] w-[0.55em] -translate-y-1/2 animate-pulse bg-term-pink/70"
            />
          )}
          {!auth && input === '' && ghost && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 select-none text-body-muted opacity-50"
            >
              {ghost}
            </span>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            // Passwords: nothing echoes, not even a moving caret (like sudo);
            // a fixed cursor block stands in for it
            type={isSecret(auth) ? 'password' : 'text'}
            disabled={auth?.step === 'busy'}
            className={`w-full bg-transparent outline-none ${
              isSecret(auth) ? 'text-transparent caret-transparent' : 'caret-term-pink'
            } ${auth?.step === 'busy' ? 'hidden' : ''}`}
            spellCheck={false}
            autoComplete={isSecret(auth) ? 'new-password' : 'off'}
            aria-label={auth ? AUTH_PROMPT[auth.step].trim() : PROMPT}
          />
        </span>
      </div>
    </div>
  );
}
