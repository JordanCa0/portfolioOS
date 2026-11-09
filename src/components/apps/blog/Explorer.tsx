import {
  ArrowUp,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  LayoutGrid,
  List,
  Lock,
  Pencil,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { contentUrl } from '../../../lib/blog/github';
import {
  basename,
  children,
  dirname,
  displayName,
  exists,
  formatDate,
  isHidden,
  isImage,
  sortEntries,
  type Entry,
} from '../../../lib/blog/fs';
import type { Blog } from '../../../lib/blog/useBlog';
import { useBlogContext } from './BlogContext';
import { errorMessage } from './ui';

function EntryIcon({ entry, size, blog }: { entry: Entry; size: number; blog: Blog }) {
  if (entry.type === 'folder') return <Folder size={size} className="text-accent" fill="currentColor" fillOpacity={0.25} />;
  if (isImage(entry.path)) {
    return (
      <img
        src={blog.localImages.get(entry.path) ?? contentUrl(entry.path, !!blog.author)}
        alt=""
        loading="lazy"
        className="rounded border border-edge object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <FileText size={size} className="text-accent-soft" />;
}

function FolderTree({ blog, cwd, setCwd, dir, depth }: { blog: Blog; cwd: string; setCwd: (d: string) => void; dir: string; depth: number }) {
  const folders = sortEntries(children(blog.manifest!, dir, !!blog.author), 'name').filter((e) => e.type === 'folder');
  return (
    <>
      {folders.map((f) => {
        const open = cwd === f.path || cwd.startsWith(`${f.path}/`);
        return (
          <div key={f.path}>
            <button
              onClick={() => setCwd(f.path)}
              className={`flex w-full items-center gap-1.5 truncate rounded py-1 pr-2 text-left text-xs hover:bg-accent/15 ${
                cwd === f.path ? 'bg-accent/20 text-body' : 'text-body-muted'
              }`}
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              {open ? <FolderOpen size={13} className="shrink-0 text-accent" /> : <Folder size={13} className="shrink-0 text-accent" />}
              <span className="truncate">{basename(f.path)}</span>
            </button>
            {open && <FolderTree blog={blog} cwd={cwd} setCwd={setCwd} dir={f.path} depth={depth + 1} />}
          </div>
        );
      })}
    </>
  );
}

export default function Explorer() {
  const { blog, ui, compact, openFile: onOpen } = useBlogContext();
  const [cwd, setCwd] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'name' | 'date'>('date');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const author = !!blog.author;
  const m = blog.manifest;

  const dir = m && exists(m, cwd) ? cwd : '';
  const items = useMemo(() => {
    if (!m) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? m.entries.filter((e) => !isHidden(e.path, author) && basename(e.path).toLowerCase().includes(q))
      : children(m, dir, author);
    return sortEntries(list, sort);
  }, [m, dir, query, sort, author]);

  const go = (d: string) => {
    setCwd(d);
    setQuery('');
    setSelected(null);
  };

  const open = (e: Entry) => (e.type === 'folder' ? go(e.path) : onOpen(e.path));

  const attempt = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) ui.toast(done);
    } catch (e) {
      ui.toast(errorMessage(e), 'error');
    }
  };

  const newNote = async () => {
    const name = await ui.prompt('New note', { initial: 'untitled', confirm: 'Create' });
    if (name) await attempt(async () => onOpen(await blog.createNote(dir, name), true), 'Note created');
  };
  const newFolder = async () => {
    const name = await ui.prompt('New folder', { initial: 'new folder', confirm: 'Create' });
    if (name) await attempt(() => blog.createFolder(dir, name), 'Folder created');
  };
  const upload = (files: File[]) =>
    attempt(async () => {
      const paths = await blog.uploadImages(dir, files);
      setSelected(paths[0]);
      ui.toast(`Uploaded ${paths.length} photo${paths.length > 1 ? 's' : ''}`);
    });
  const rename = async (path: string) => {
    const name = await ui.prompt(`Rename ${basename(path)}`, { initial: basename(path), confirm: 'Rename' });
    if (name) await attempt(async () => setSelected(await blog.rename(path, name)), 'Renamed');
  };
  const remove = async (path: string) => {
    const isFolder = blog.manifest?.entries.find((e) => e.path === path)?.type === 'folder';
    const ok = await ui.confirm(
      `Delete ${basename(path)}?`,
      isFolder ? 'This deletes the folder and everything in it.' : 'This removes the file from your blog.',
      'Delete',
    );
    if (ok) await attempt(() => blog.remove(path), 'Deleted');
    setSelected(null);
  };

  const crumbs = dir ? dir.split('/') : [];

  const toolButton = 'flex h-7 items-center gap-1.5 rounded px-2 text-xs text-body-muted hover:bg-accent/15 hover:text-body disabled:opacity-40';

  return (
    <div className="flex h-full flex-col text-sm" onClick={() => setMenu(null)}>
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-edge bg-chrome/60 px-2 py-1.5">
        <button className={toolButton} aria-label="Up one folder" disabled={!dir} onClick={() => go(dirname(dir))}>
          <ArrowUp size={14} />
        </button>
        <nav aria-label="Path" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded border border-edge bg-glass px-2 py-1 text-xs">
          <button onClick={() => go('')} className="shrink-0 text-body-muted hover:text-accent">~/notes</button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex shrink-0 items-center gap-0.5">
              <ChevronRight size={12} className="text-body-muted" />
              <button onClick={() => go(crumbs.slice(0, i + 1).join('/'))} className="hover:text-accent">
                {c}
              </button>
            </span>
          ))}
        </nav>
        <label className="flex h-7 w-36 items-center gap-1.5 rounded border border-edge bg-glass px-2 text-xs focus-within:border-accent">
          <Search size={12} className="shrink-0 text-body-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search notes"
            className="w-full bg-transparent outline-none placeholder:text-body-muted"
          />
        </label>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-edge px-2 py-1">
        {author ? (
          <>
            <button className={toolButton} onClick={newNote}>
              <FilePlus size={14} /> New note
            </button>
            <button className={toolButton} onClick={newFolder}>
              <FolderPlus size={14} /> New folder
            </button>
            <button className={toolButton} onClick={() => fileInput.current?.click()}>
              <ImagePlus size={14} /> Add photos
            </button>
            {selected && (
              <>
                <span className="mx-1 h-4 w-px bg-edge" />
                <button className={toolButton} onClick={() => rename(selected)}>
                  <Pencil size={13} /> Rename
                </button>
                <button className={toolButton} onClick={() => remove(selected)}>
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) upload([...e.target.files]);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <button className={toolButton} onClick={() => setSort(sort === 'date' ? 'name' : 'date')} title="Change sort">
            {sort === 'date' ? 'Newest' : 'A–Z'}
          </button>
          <button className={toolButton} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
            <LayoutGrid size={14} className={view === 'grid' ? 'text-accent' : ''} />
          </button>
          <button className={toolButton} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <List size={14} className={view === 'list' ? 'text-accent' : ''} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="hidden w-44 shrink-0 overflow-y-auto border-r border-edge p-1.5 sm:block">
          <button
            onClick={() => go('')}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent/15 ${
              dir === '' && !query ? 'bg-accent/20' : 'text-body-muted'
            }`}
          >
            <FolderOpen size={13} className="text-accent" /> notes
          </button>
          {m && <FolderTree blog={blog} cwd={dir} setCwd={go} dir="" depth={1} />}
        </aside>

        {/* Files */}
        <section
          aria-label="Files"
          className={`relative min-w-0 flex-1 overflow-y-auto p-3 ${dragOver ? 'bg-accent/10 outline-dashed outline-2 -outline-offset-8 outline-accent' : ''}`}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
          onContextMenu={(e) => {
            if (!author) return;
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, path: null });
          }}
          onDragOver={(e) => {
            if (!author || !e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (author && e.dataTransfer.files.length) upload([...e.dataTransfer.files]);
          }}
        >
          {!m && !blog.loadError && <p className="p-4 text-xs text-body-muted">Loading notes…</p>}
          {blog.loadError && <p className="p-4 text-xs text-term-close">{blog.loadError}</p>}
          {m && items.length === 0 && (
            <div className="grid h-full place-items-center text-center text-xs text-body-muted">
              <div>
                <p>{query ? `Nothing matches “${query}”.` : 'This folder is empty.'}</p>
                {author && !query && (
                  <button onClick={newNote} className="mt-3 rounded bg-accent px-3 py-1.5 text-accent-contrast hover:bg-accent-hover">
                    Write a note
                  </button>
                )}
              </div>
            </div>
          )}

          {view === 'grid' ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {items.map((e) => (
                <li key={e.path}>
                  <button
                    onClick={() => (compact ? open(e) : setSelected(e.path))}
                    onDoubleClick={() => open(e)}
                    onKeyDown={(k) => k.key === 'Enter' && open(e)}
                    onContextMenu={(ev) => {
                      if (!author) return;
                      ev.preventDefault();
                      ev.stopPropagation();
                      setSelected(e.path);
                      setMenu({ x: ev.clientX, y: ev.clientY, path: e.path });
                    }}
                    title={e.path}
                    className={`flex w-full flex-col items-center gap-1.5 rounded-md p-2 text-center text-xs transition-colors ${
                      selected === e.path ? 'bg-accent/25' : 'hover:bg-accent/10'
                    }`}
                  >
                    <EntryIcon entry={e} size={44} blog={blog} />
                    <span className="line-clamp-2 break-words leading-tight">{e.type === 'folder' ? basename(e.path) : displayName(e.path)}</span>
                    {query && <span className="truncate text-[10px] text-body-muted">{dirname(e.path) || '~'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            items.length > 0 && (
              <table className="w-full text-left text-xs">
                <thead className="text-body-muted">
                  <tr>
                    <th className="px-2 py-1 font-normal">Name</th>
                    <th className="hidden px-2 py-1 font-normal sm:table-cell">Modified</th>
                    <th className="hidden px-2 py-1 font-normal md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr
                      key={e.path}
                      tabIndex={0}
                      onClick={() => (compact ? open(e) : setSelected(e.path))}
                      onDoubleClick={() => open(e)}
                      onKeyDown={(k) => k.key === 'Enter' && open(e)}
                      onContextMenu={(ev) => {
                        if (!author) return;
                        ev.preventDefault();
                        ev.stopPropagation();
                        setSelected(e.path);
                        setMenu({ x: ev.clientX, y: ev.clientY, path: e.path });
                      }}
                      className={`cursor-default ${selected === e.path ? 'bg-accent/25' : 'hover:bg-accent/10'}`}
                    >
                      <td className="flex items-center gap-2 px-2 py-1.5">
                        <EntryIcon entry={e} size={16} blog={blog} />
                        <span className="truncate">{query ? e.path : basename(e.path)}</span>
                      </td>
                      <td className="hidden px-2 py-1.5 text-body-muted sm:table-cell">{e.type === 'file' ? formatDate(e.updated) : '—'}</td>
                      <td className="hidden px-2 py-1.5 text-body-muted md:table-cell">{formatDate(e.created)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </section>
      </div>

      {/* Status bar */}
      <footer className="flex h-7 shrink-0 items-center gap-2 border-t border-edge bg-chrome/60 px-3 text-[11px] text-body-muted">
        <span>
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        {blog.busy && <span className="animate-pulse text-accent">saving…</span>}
        <button
          onClick={() => (author ? blog.lock() : ui.openUnlock())}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent/15 hover:text-body"
          title={author ? 'Leave author mode' : 'Unlock author mode'}
        >
          {author ? <Unlock size={11} className="text-accent" /> : <Lock size={11} />}
          {author ? `author: ${blog.author}` : 'read-only'}
        </button>
      </footer>

      {/* Context menu */}
      {menu && (
        <div
          role="menu"
          className="fixed z-[10000] min-w-40 rounded-md border border-edge bg-glass p-1 text-xs shadow-2xl backdrop-blur-glass"
          style={{ left: Math.min(menu.x, window.innerWidth - 170), top: Math.min(menu.y, window.innerHeight - 160) }}
        >
          {(menu.path
            ? [
                { label: 'Open', run: () => { const e = m?.entries.find((x) => x.path === menu.path); if (e) open(e); } },
                { label: 'Rename…', run: () => rename(menu.path!) },
                { label: 'Delete', run: () => remove(menu.path!) },
              ]
            : [
                { label: 'New note', run: newNote },
                { label: 'New folder', run: newFolder },
                { label: 'Add photos…', run: () => fileInput.current?.click() },
              ]
          ).map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setMenu(null);
                item.run();
              }}
              className="block w-full rounded px-3 py-1.5 text-left hover:bg-accent hover:text-accent-contrast"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
