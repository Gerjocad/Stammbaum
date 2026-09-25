import { useMemo, useState } from 'react';
import { CARD_H, CARD_W, computeLayout } from '../layout';
import { fullName, lifeSpan, type FamilyData } from '../types';

interface Props {
  data: FamilyData;
  selectedId: string | null;
  marked: string[];
  onSelect: (id: string) => void;
}

export function Tree({ data, selectedId, marked, onSelect }: Props) {
  const layout = useMemo(() => computeLayout(data), [data]);
  const [zoom, setZoom] = useState(1);
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data]);

  if (!layout.nodes.length) {
    return (
      <div className="empty">
        <p>Noch keine Personen eingetragen.</p>
        <p>Beginne mit „Person hinzufügen“, zum Beispiel mit dir selbst.</p>
      </div>
    );
  }

  return (
    <div className="tree-wrap">
      <div className="zoom">
        <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} aria-label="Verkleinern">
          −
        </button>
        <span>{Math.round(zoom * 100)} %</span>
        <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label="Vergrößern">
          +
        </button>
      </div>
      <div className="tree-scroll">
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
