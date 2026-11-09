import { KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OWNER, REPO } from '../../../lib/blog/config';
import { errorMessage } from './ui';

export type DialogState =
  | { kind: 'prompt'; title: string; initial: string; confirm: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; body: string; confirm: string; resolve: (v: boolean) => void }
  | { kind: 'unlock' };

function Shell({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[20000] grid place-items-center bg-black/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-modal aria-label={title} className="window-in w-full max-w-md overflow-hidden rounded-lg border border-accent/60 bg-glass shadow-2xl backdrop-blur-glass">
        <h2 className="border-b border-edge bg-chrome px-4 py-2.5 text-xs">{title}</h2>
        <div className="p-4 text-sm">{children}</div>
      </div>
    </div>
  );
}

const btn = 'rounded px-3 py-1.5 text-xs';
const primary = `${btn} bg-accent text-accent-contrast hover:bg-accent-hover disabled:opacity-50`;
const secondary = `${btn} text-body-muted hover:bg-accent/15 hover:text-body`;

export default function Dialogs({
  dialog,
  close,
  unlock,
}: {
  dialog: DialogState | null;
  close: () => void;
  unlock: (token: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
    setWorking(false);
    setValue(dialog?.kind === 'prompt' ? dialog.initial : '');
    // Select the name without its extension, like a file manager
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      const dot = el.value.lastIndexOf('.');
      el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
    });
  }, [dialog]);

  if (!dialog) return null;

  if (dialog.kind === 'prompt') {
    const cancel = () => {
      dialog.resolve(null);
      close();
    };
    return (
      <Shell title={dialog.title} onCancel={cancel}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            dialog.resolve(value);
            close();
          }}
        >
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Name"
            className="w-full rounded border border-edge bg-desktop/60 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={secondary} onClick={cancel}>Cancel</button>
            <button type="submit" className={primary} disabled={!value.trim()}>{dialog.confirm}</button>
          </div>
        </form>
      </Shell>
    );
  }

  if (dialog.kind === 'confirm') {
    const answer = (v: boolean) => {
      dialog.resolve(v);
      close();
    };
    return (
      <Shell title={dialog.title} onCancel={() => answer(false)}>
        <p className="text-body-muted">{dialog.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className={secondary} onClick={() => answer(false)}>Cancel</button>
          <button className={`${btn} bg-term-close text-accent-contrast hover:opacity-90`} autoFocus onClick={() => answer(true)}>
            {dialog.confirm}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Unlock author mode" onCancel={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setWorking(true);
          setError(null);
          try {
            await unlock(value);
            close();
          } catch (err) {
            setError(errorMessage(err));
            setWorking(false);
          }
        }}
      >
        <p className="text-xs leading-relaxed text-body-muted">
          Notes are saved as commits to <span className="text-body">{OWNER}/{REPO}</span>. Paste a GitHub token that can write
          to it. It stays in this browser only.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-body-muted">
          <li>
            Open{' '}
            <a className="text-accent underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              new fine-grained token
            </a>
          </li>
          <li>Repository access → Only select → <span className="text-body">{REPO}</span></li>
          <li>Permissions → Contents → <span className="text-body">Read and write</span></li>
          <li>Generate, copy, paste below</li>
        </ol>
        <label className="mt-4 flex items-center gap-2 rounded border border-edge bg-desktop/60 px-3 py-2 focus-within:border-accent">
          <KeyRound size={14} className="text-body-muted" />
          <input
            ref={input}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="github_pat_…"
            aria-label="GitHub token"
            autoComplete="off"
            className="w-full bg-transparent text-xs outline-none"
          />
        </label>
        {error && <p className="mt-2 text-xs text-term-close">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={secondary} onClick={close}>Cancel</button>
          <button type="submit" className={primary} disabled={!value.trim() || working}>
            {working ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </Shell>
  );
}
