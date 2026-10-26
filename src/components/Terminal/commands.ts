import { EMAIL, GITHUB_URL, LINKEDIN_URL, PHONE } from '../../apps';
import type { AppId } from '../../types';

export interface CommandContext {
  openApp: (appId: AppId) => void;
}

export type CommandResult = { lines: string[] } | { clear: true } | { neofetch: true };

export const COMMAND_DESCRIPTIONS: Array<{ cmd: string; desc: string }> = [
  { cmd: 'help', desc: 'List all available commands' },
  { cmd: 'neofetch', desc: 'System info' },
  { cmd: 'ls', desc: 'List files' },
  { cmd: 'cat <file>', desc: 'Print a file, e.g. cat contact.txt' },
  { cmd: 'open <app>', desc: 'Open an app, e.g. open projects' },
  { cmd: 'about', desc: 'Open About' },
  { cmd: 'resume', desc: 'Open Resume' },
  { cmd: 'projects', desc: 'Open Projects' },
  { cmd: 'skills', desc: 'Open Skills' },
  { cmd: 'contact', desc: 'Open Contact' },
  { cmd: 'themes', desc: 'Open the theme picker' },
  { cmd: 'spotify', desc: 'Open the music player' },
  { cmd: 'whoami', desc: 'Print the current user' },
  { cmd: 'email', desc: 'Print my email' },
  { cmd: 'github', desc: 'Print my GitHub URL' },
  { cmd: 'linkedin', desc: 'Print my LinkedIn URL' },
  { cmd: 'clear', desc: 'Clear the terminal' },
];

const OPENABLE: AppId[] = [
  'about',
  'resume',
  'projects',
  'skills',
  'contact',
  'themes',
  'spotify',
  'help',
];

const FILES = ['about/', 'projects/', 'skills/', 'resume.pdf', 'contact.txt', 'help.md'];

/** Command names offered by Tab completion */
const COMMANDS = [
  ...new Set(COMMAND_DESCRIPTIONS.map(({ cmd }) => cmd.split(' ')[0])),
  'cd',
];

/** Commands whose argument completes against FILES */
const FILE_ARG_COMMANDS = ['cat', 'open', 'cd'];

function helpLines(): string[] {
  return [
    'Available commands:',
    '',
    ...COMMAND_DESCRIPTIONS.map(({ cmd, desc }) => `  ${cmd.padEnd(12)} ${desc}`),
    '',
    'Tab completes commands and file names.',
  ];
}

/** `about/`, `resume.pdf`, `Contact.txt` → the app they belong to */
function toAppId(target: string): AppId | null {
  const name = target.toLowerCase().replace(/\/$/, '').replace(/\.\w+$/, '');
  return (OPENABLE as string[]).includes(name) ? (name as AppId) : null;
}

function openTarget(cmd: string, target: string | undefined, ctx: CommandContext): CommandResult {
  if (!target) return { lines: [`${cmd}: missing operand. Try: ${cmd} projects`] };
  const appId = toAppId(target);
  if (!appId) return { lines: [`${cmd}: ${target}: No such file or directory`] };
  ctx.openApp(appId);
  return { lines: [`Opening ${appId}...`] };
}

function cat(file: string | undefined): CommandResult {
  if (!file) return { lines: ['cat: missing operand. Try: cat contact.txt'] };
  switch (file.toLowerCase()) {
    case 'contact.txt':
      return {
        lines: [
          `email     ${EMAIL}`,
          `phone     ${PHONE}`,
          `github    ${GITHUB_URL}`,
          `linkedin  ${LINKEDIN_URL}`,
        ],
      };
    case 'help.md':
      return { lines: helpLines() };
    case 'resume.pdf':
      return { lines: ['cat: resume.pdf: binary file. Try: open resume'] };
  }
  if (FILES.includes(file) || FILES.includes(`${file}/`)) {
    return { lines: [`cat: ${file}: Is a directory. Try: open ${file}`] };
  }
  return { lines: [`cat: ${file}: No such file or directory`] };
}

export function executeCommand(input: string, ctx: CommandContext): CommandResult {
  const [name = '', ...args] = input.trim().split(/\s+/);
  const cmd = name.toLowerCase();

  if (cmd === '') return { lines: [] };
  if (cmd === 'clear') return { clear: true };
  if (cmd === 'neofetch') return { neofetch: true };

  if (args.length === 0 && (OPENABLE as string[]).includes(cmd) && cmd !== 'help') {
    ctx.openApp(cmd as AppId);
    return { lines: [`Opening ${cmd}...`] };
  }

  switch (cmd) {
    case 'help':
      return { lines: helpLines() };
    case 'open':
    case 'cd':
      return openTarget(cmd, args[0], ctx);
    case 'cat':
      return cat(args[0]);
    case 'ls':
      return {
        lines: [
          'drwxr-xr-x  about/',
          'drwxr-xr-x  projects/',
          'drwxr-xr-x  skills/',
          '-rw-r--r--  resume.pdf',
          '-rw-r--r--  contact.txt',
          '-rw-r--r--  help.md',
        ],
      };
    case 'whoami':
      return { lines: ['jordan'] };
    case 'github':
      return { lines: [GITHUB_URL] };
    case 'linkedin':
      return { lines: [LINKEDIN_URL] };
    case 'email':
      return { lines: [EMAIL] };
    case 'sudo':
      return { lines: ['jordan is not in the sudoers file. This incident will be reported.'] };
    case 'rm':
      return { lines: ['rm: permission denied. Nice try.'] };
    case 'vim':
    case 'nvim':
      return { lines: ["Don't kid, no one knows how to use vim"] };
    case 'exit':
      return { lines: ['There is no exit. Close the window instead.'] };
    default:
      return {
        lines: [`command not found: ${name}. Type 'help' for available commands.`],
      };
  }
}

function commonPrefix(words: string[]): string {
  return words.reduce((prefix, w) => {
    let i = 0;
    while (i < prefix.length && prefix[i] === w[i]) i++;
    return prefix.slice(0, i);
  });
}

/**
 * Bash-style Tab completion. Returns the new input value, plus the
 * candidates when the input is ambiguous so the terminal can list them.
 */
export function complete(input: string): { value: string; options: string[] } {
  const parts = input.split(' ');
  const word = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(' ');
  const pool =
    parts.length === 1
      ? COMMANDS
      : FILE_ARG_COMMANDS.includes(parts[0].toLowerCase())
        ? FILES
        : [];
  const matches = pool.filter((c) => c.startsWith(word.toLowerCase()));
  if (matches.length === 0) return { value: input, options: [] };

  const prefix = head ? `${head} ` : '';
  if (matches.length === 1) {
    const done = matches[0];
    // Commands get a trailing space; directories already end in '/'
    const suffix = parts.length === 1 || !done.endsWith('/') ? ' ' : '';
    return { value: `${prefix}${done}${suffix}`, options: [] };
  }
  return { value: `${prefix}${commonPrefix(matches)}`, options: matches };
}
