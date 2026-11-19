import { useEffect, useRef, useState } from 'react';
import { agendaFor, isTimed } from '../shared';
import type { DragHandlers } from './useCalendarDrag';
import {
  addDays,
  DAY_SHORT,
  formatTime,
  fromKey,
  startOfWeek,
  todayKey,
  WEEKDAYS_MON,
  type DashData,
  type Todo,
} from '../../../../lib/dashboard/model';

interface Props {
  data: DashData;
  selected: string;
  onSelect: (k: string) => void;
  drag: DragHandlers;
}

const CHIP_PX = 17;

export default function MonthGrid({ data, selected, onSelect, drag }: Props) {
  const sel = fromKey(selected);
  const gridStart = startOfWeek(`${selected.slice(0, 8)}01`);
  const today = todayKey();
  // Always 6 rows so the grid doesn't jump between months
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const { preview } = drag;

  // Fit as many chips as the cell height allows (a big window shows more)
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rowH = (el.clientHeight - 24) / 6;
      setFit(Math.max(1, Math.floor((rowH - 26) / CHIP_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="grid h-full min-h-[360px] select-none grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-px overflow-hidden rounded-lg border border-edge bg-edge"
    >
      {WEEKDAYS_MON.map((d) => (
        <div key={d} className="bg-chrome py-1 text-center text-[10px] uppercase tracking-wide text-body-muted">
          {DAY_SHORT[d]}
        </div>
      ))}
      {days.map((key) => {
        const items = agendaFor(data, key);
        const inMonth = fromKey(key).getMonth() === sel.getMonth();
        const done = items.filter((i) => i.done).length;
        const over = preview?.zone === 'month' && preview.date === key;
        // Keep one line for "+N more" when it doesn't all fit
        const shown = items.length > fit ? fit - 1 : fit;
        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            data-drop-date={key}
            data-drop-zone="month"
            onClick={() => onSelect(key)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(key)}
            aria-label={`${fromKey(key).toDateString()}, ${items.length} items`}
            aria-current={key === selected ? 'date' : undefined}
            className={`flex min-h-0 cursor-pointer flex-col gap-px overflow-hidden p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              over ? 'bg-accent/30' : key === selected ? 'bg-accent/20' : 'bg-chrome hover:bg-accent/10'
            } ${inMonth ? '' : 'opacity-45'}`}
          >
            <span className="mb-0.5 flex items-center justify-between">
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                  key === today ? 'bg-accent font-bold text-accent-contrast' : ''
                }`}
              >
                {fromKey(key).getDate()}
              </span>
              {items.length > 0 && (
                <span className="text-[9px] text-body-muted">
                  {done}/{items.length}
                </span>
              )}
            </span>
            {items.slice(0, Math.max(shown, 0)).map((i) => {
              const todo: Todo | undefined = i.kind === 'todo' ? data.todos.find((t) => t.id === i.id) : undefined;
              return (
                <span
                  key={i.id}
                  onPointerDown={todo ? (e) => drag.startMove(e, todo) : undefined}
                  className={`flex shrink-0 items-center gap-1 truncate rounded px-1 text-[10px] leading-4 ${
                    i.done ? 'text-body-muted line-through' : i.kind === 'todo' ? 'bg-accent/25' : 'bg-accent/10'
                  } ${todo ? 'cursor-grab' : ''} ${preview?.id === i.id ? 'opacity-40' : ''}`}
                  title={i.text}
                >
                  {isTimed(i) && <span className="shrink-0 tabular-nums opacity-70">{formatTime(i.start!)}</span>}
                  <span className="truncate">{i.text}</span>
                </span>
              );
            })}
            {items.length > shown && shown >= 0 && (
              <span className="px-1 text-[9px] text-body-muted">+{items.length - Math.max(shown, 0)} more</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
