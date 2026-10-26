import { useEffect, useRef, useState } from 'react';
import type { AppId } from '../../types';
import { complete, executeCommand } from './commands';
import Neofetch from './Neofetch';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (value.trim()) setHistory((h) => [value, ...h]);

    const result = executeCommand(value, { openApp });
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
        <span className="shrink-0">
          <span className="text-term-green">jordan@portfolio</span>
          <span className="text-body-muted">:</span>
          <span className="text-term-pink">~</span>
          <span className="text-body-muted">$&nbsp;</span>
        </span>
        <span className="relative min-w-0 flex-1">
          {input === '' && ghost && (
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
            className="w-full bg-transparent caret-term-pink outline-none"
            spellCheck={false}
            autoComplete="off"
            aria-label={PROMPT}
          />
        </span>
      </div>
    </div>
  );
}
