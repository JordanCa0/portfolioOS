/** App-level dialogs and toasts, passed to every window. */
export interface UI {
  prompt: (title: string, opts?: { initial?: string; confirm?: string }) => Promise<string | null>;
  confirm: (title: string, body: string, confirmLabel?: string) => Promise<boolean>;
  toast: (message: string, kind?: 'ok' | 'error') => void;
  openUnlock: () => void;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
