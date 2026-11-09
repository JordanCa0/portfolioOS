import { Bold, Code, Eye, Heading, ImagePlus, Italic, Link, Pencil, Save, Columns2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OWNER_NAME } from '../../../apps';
import { ASSET_FOLDER } from '../../../lib/blog/config';
import { find, formatDate, isImage, renderMarkdown } from '../../../lib/blog/fs';
import { useBlogContext } from './BlogContext';
import ImageViewer from './ImageViewer';
import { errorMessage } from './ui';

type Mode = 'read' | 'edit' | 'split';

interface NotepadProps {
  /** File to show; undefined when Notepad was opened without one */
  path?: string;
  /** Window id, for unsaved-changes tracking */
  windowId: string;
  startInEdit?: boolean;
}

export default function Notepad({ path, windowId, startInEdit = false }: NotepadProps) {
  const { blog } = useBlogContext();
  if (!path) {
    return (
      <p className="grid h-full place-items-center p-6 text-center text-xs text-body-muted">
        Open a note from the Blog app.
      </p>
    );
  }
  if (isImage(path)) return <ImageViewer path={path} />;
  return <NoteEditor key={path} path={path} windowId={windowId} startInEdit={startInEdit} blog={blog} />;
}

function NoteEditor({ path, windowId, startInEdit, blog }: Required<NotepadProps> & { blog: ReturnType<typeof useBlogContext>['blog'] }) {
  const { ui, compact, setDirty } = useBlogContext();
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(startInEdit ? 'edit' : 'read');
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const area = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const author = !!blog.author;
  const effectiveMode: Mode = author ? mode : 'read';
  const dirty = text !== null && text !== saved;
  const entry = blog.manifest ? find(blog.manifest, path) : undefined;

  useEffect(() => {
    let live = true;
    setText(null);
    setError(null);
    blog.loadNote(path).then(
      (t) => live && (setText(t), setSaved(t)),
      (e) => live && setError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    setDirty(windowId, dirty);
  }, [dirty, windowId, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const html = useMemo(
    () => (text === null ? '' : renderMarkdown(text, path, blog.localImages, !!blog.author)),
    // localImages is a stable Map that only grows; re-render follows text changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, path, blog.author],
  );

  const save = async () => {
    if (text === null || !dirty || !author) return;
    try {
      await blog.saveNote(path, text);
      setSaved(text);
      ui.toast('Saved');
    } catch (e) {
      ui.toast(errorMessage(e), 'error');
    }
  };

  /** Replace the textarea selection, keeping undo history where the browser allows it. */
  const insert = (before: string, after = '', placeholder = '') => {
    const el = area.current;
    if (!el || text === null) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const chosen = text.slice(s, e) || placeholder;
    const snippet = `${before}${chosen}${after}`;
    el.focus();
    if (!document.execCommand?.('insertText', false, snippet)) {
      setText(text.slice(0, s) + snippet + text.slice(e));
    }
    requestAnimationFrame(() => el.setSelectionRange(s + before.length, s + before.length + chosen.length));
  };

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    if (effectiveMode === 'read') setMode('split');
    ui.toast('Uploading photo…');
    try {
      const paths = await blog.uploadImages(ASSET_FOLDER, files);
      insert(paths.map((p) => `![${p.split('/').pop()!.replace(/\.[^.]+$/, '')}](/${encodeURI(p)})`).join('\n') + '\n');
      ui.toast('Photo added — save to publish it in the note');
    } catch (e) {
      ui.toast(errorMessage(e), 'error');
    }
  };

  const updateCursor = () => {
    const el = area.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const line = before.split('\n').length;
    setCursor({ line, col: before.length - before.lastIndexOf('\n') });
  };

  const words = text ? (text.match(/\S+/g)?.length ?? 0) : 0;
  const tab = (m: Mode, label: string, Icon: typeof Eye) => (
    <button
      onClick={() => setMode(m)}
      aria-pressed={effectiveMode === m}
      className={`flex h-6 items-center gap-1 rounded px-2 ${effectiveMode === m ? 'bg-accent text-accent-contrast' : 'hover:bg-accent/15'}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
  const fmt = 'grid h-6 w-6 place-items-center rounded hover:bg-accent/15';

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          save();
        }
      }}
    >
      {author && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-edge bg-chrome/60 px-2 py-1 text-xs text-body-muted">
          {tab('read', 'Read', Eye)}
          {tab('edit', 'Edit', Pencil)}
          {!compact && tab('split', 'Split', Columns2)}
          {effectiveMode !== 'read' && (
            <>
              <span className="mx-1 h-4 w-px bg-edge" />
              <button className={fmt} aria-label="Heading" onClick={() => insert('## ', '', 'Heading')}><Heading size={13} /></button>
              <button className={fmt} aria-label="Bold" onClick={() => insert('**', '**', 'bold')}><Bold size={13} /></button>
              <button className={fmt} aria-label="Italic" onClick={() => insert('_', '_', 'italic')}><Italic size={13} /></button>
              <button className={fmt} aria-label="Code" onClick={() => insert('`', '`', 'code')}><Code size={13} /></button>
              <button className={fmt} aria-label="Link" onClick={() => insert('[', '](https://)', 'link text')}><Link size={13} /></button>
            </>
          )}
          <button className="flex h-6 items-center gap-1 rounded px-2 hover:bg-accent/15" onClick={() => photoInput.current?.click()}>
            <ImagePlus size={13} /> Photo
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addPhotos([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          <button
            onClick={save}
            disabled={!dirty || blog.busy}
            className="ml-auto flex h-6 items-center gap-1 rounded bg-accent px-2.5 text-accent-contrast hover:bg-accent-hover disabled:opacity-40"
          >
            <Save size={12} /> {blog.busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {error && <p className="p-6 text-sm text-term-close">{error}</p>}
        {!error && text === null && <p className="p-6 text-sm text-body-muted">Opening…</p>}
        {!error && text !== null && (
          <>
            {effectiveMode !== 'read' && (
              <textarea
                ref={area}
                value={text}
                spellCheck
                autoFocus
                aria-label="Note text (Markdown)"
                onChange={(e) => {
                  setText(e.target.value);
                  updateCursor();
                }}
                onSelect={updateCursor}
                onPaste={(e) => {
                  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
                  if (files.length) {
                    e.preventDefault();
                    addPhotos(files);
                  }
                }}
                onDrop={(e) => {
                  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
                  if (files.length) {
                    e.preventDefault();
                    addPhotos(files);
                  }
                }}
                className={`min-w-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none ${
                  effectiveMode === 'split' ? 'border-r border-edge' : ''
                }`}
              />
            )}
            {effectiveMode !== 'edit' && (
              <article className="min-w-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
                <div className="prose-note mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: html }} />
                {effectiveMode === 'read' && entry && (
                  <p className="mx-auto mt-10 max-w-2xl border-t border-edge pt-3 text-[11px] text-body-muted">
                    {OWNER_NAME} · written {formatDate(entry.created)}
                    {entry.updated.slice(0, 10) !== entry.created.slice(0, 10) && ` · updated ${formatDate(entry.updated)}`}
                  </p>
                )}
              </article>
            )}
          </>
        )}
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-edge bg-chrome/60 px-3 text-[11px] text-body-muted">
        {effectiveMode !== 'read' && <span>Ln {cursor.line}, Col {cursor.col}</span>}
        <span>{words} words</span>
        <span>~{Math.max(1, Math.round(words / 230))} min read</span>
        {dirty && <span className="text-accent">● unsaved</span>}
        <span className="ml-auto hidden sm:inline">Markdown · UTF-8</span>
      </footer>
    </div>
  );
}
