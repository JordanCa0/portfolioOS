import {
  FileText,
  FolderOpen,
  HelpCircle,
  Mail,
  Music,
  NotebookPen,
  NotepadText,
  Palette,
  Terminal,
  User,
  Zap,
} from 'lucide-react';
import type { AppDefinition, AppId } from './types';

export const APPS: AppDefinition[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'about', label: 'About', icon: User },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'spotify', label: 'Spotify', icon: Music },
  { id: 'blog', label: 'Blog', icon: NotebookPen },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

/** Opened from the Blog app with a file, so it isn't in the launcher. */
export const NOTEPAD_APP: AppDefinition = { id: 'notepad', label: 'Notepad', icon: NotepadText };

export const APP_MAP: Record<AppId, AppDefinition> = Object.fromEntries(
  [...APPS, NOTEPAD_APP].map((a) => [a.id, a]),
) as Record<AppId, AppDefinition>;

export const OWNER_NAME = 'Jordan Cao';
export const GITHUB_URL = 'https://github.com/JordanCa0';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/jordan-cao-585a76204/';
export const EMAIL = 'jordancao77@gmail.com';
export const PHONE = '647-383-8878';

// Paste any Spotify share link (track/album/playlist); the Spotify app
// converts it to the embeddable form automatically
export const SPOTIFY_URL =
  'https://open.spotify.com/playlist/4uP8UHzQN8LRLNBdL7RpWr?si=e3653b79e03342a4';
