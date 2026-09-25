import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { CARD_H, CARD_W, computeLayout } from '../layout';
import { fullName, lifeSpan, type FamilyData } from '../types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

interface Props {
  data: FamilyData;
  selectedId: string | null;
  marked: string[];
  onSelect: (id: string) => void;
}

export function Tree({ data, selectedId, marked, onSelect }: Props) {
  const layout = useMemo(() => computeLayout(data), [data]);
  const [zoom, setZoom] = useState(1);
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Nach einer Zoom-Änderung so scrollen, dass der Punkt unter den Fingern stehen bleibt.
  const anchor = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  /** Zoomt auf `next`, wobei der Bildschirmpunkt (px, py) im Scrollbereich fest bleibt. */
  const zoomAt = (next: number, px: number, py: number) => {
    const el = scrollRef.current;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (!el || z === zoomRef.current) return;
    anchor.current = {
      x: px,
      y: py,
      cx: (el.scrollLeft + px) / zoomRef.current,
      cy: (el.scrollTop + py) / zoomRef.current,
    };
    zoomRef.current = z;
    setZoom(z);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.cx * zoom - a.x;
    el.scrollTop = a.cy * zoom - a.y;
    anchor.current = null;
  }, [zoom]);

  const hasNodes = layout.nodes.length > 0;
  // Beim ersten Anzeigen die oberste Generation in die Mitte holen.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !hasNodes) return;
    el.scrollLeft = layout.focusX * zoomRef.current - el.clientWidth / 2;
  }, [hasNodes]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let start: { dist: number; zoom: number } | null = null;
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return [x - r.left, y - r.top] as const;
    };
    const pinch = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const [mx, my] = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      return { dist, mx, my };
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { dist: pinch(e).dist, zoom: zoomRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start) return;
      e.preventDefault();
      const p = pinch(e);
      zoomAt(start.zoom * (p.dist / start.dist), p.mx, p.my);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    // Mausrad (und Trackpad-Pinch, der als Rad mit Strg ankommt) zoomt um den Mauszeiger.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = local(e.clientX, e.clientY);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(zoomRef.current * Math.exp(-dy / (e.ctrlKey ? 100 : 400)), x, y);
    };

    // Mit gedrückter linker Maustaste ziehen verschiebt den Baum.
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        el.classList.add('dragging');
      }
      e.preventDefault();
      el.scrollLeft = drag.left - dx;
      el.scrollTop = drag.top - dy;
    };
    const onMouseUp = () => {
      if (drag?.moved) {
        el.classList.remove('dragging');
        // Den Klick nach dem Ziehen schlucken, damit keine Person ausgewählt wird.
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      }
      drag = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [hasNodes]);

  const zoomButton = (factor: number) => {
    const el = scrollRef.current;
    zoomAt(zoomRef.current * factor, (el?.clientWidth ?? 0) / 2, (el?.clientHeight ?? 0) / 2);
  };
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data]);

  if (!layout.nodes.length) {
    return (
      <div className="empty">
        <p>{t.emptyTitle}</p>
        <p>{t.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="tree-wrap">
      <div className="zoom">
        <button onClick={() => zoomButton(1 / 1.2)} aria-label={t.zoomOut}>
          −
        </button>
        <span>{Math.round(zoom * 100)} %</span>
        <button onClick={() => zoomButton(1.2)} aria-label={t.zoomIn}>
          +
        </button>
      </div>
      <div className="tree-scroll" ref={scrollRef}>
        <div
          className="tree"
          style={{ width: layout.width * zoom, height: layout.height * zoom }}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: layout.width, height: layout.height, position: 'relative' }}>
            <svg width={layout.width} height={layout.height} className="lines">
              {layout.lines.map((l, i) => (
                <path key={i} d={l.d} className={`line-${l.kind}`} strokeDasharray={l.dashed ? '6 5' : undefined} />
              ))}
            </svg>
            {layout.nodes.map((n) => {
              const p = byId.get(n.id)!;
              const cls = ['card', `g-${p.gender}`];
              if (n.id === selectedId) cls.push('selected');
              if (marked.includes(n.id)) cls.push('marked');
              if (p.death_date) cls.push('deceased');
              return (
                <button
                  key={n.id}
                  className={cls.join(' ')}
                  style={{ left: n.x, top: n.y, width: CARD_W, height: CARD_H }}
                  onClick={() => onSelect(n.id)}
                >
                  <div className="avatar">
                    {p.photo_url ? <img src={p.photo_url} alt="" /> : <span>{initials(p.first_name, p.last_name)}</span>}
                  </div>
                  <div className="name">{fullName(p)}</div>
                  <div className="dates">{lifeSpan(p)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function initials(first: string, last: string) {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}
