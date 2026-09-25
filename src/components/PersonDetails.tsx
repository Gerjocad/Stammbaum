import { useState } from 'react';
import { fullName, lifeSpan, type FamilyData, type Person, type Relationship } from '../types';

export type RelationKind = 'parent' | 'child' | 'partner';

const LABELS: Record<RelationKind, { list: string; add: string }> = {
  parent: { list: 'Eltern', add: 'Elternteil' },
  partner: { list: 'Partner:innen', add: 'Partner:in' },
  child: { list: 'Kinder', add: 'Kind' },
};

interface Props {
  person: Person;
  data: FamilyData;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: (id: string) => void;
  onAddNew: (kind: RelationKind) => void;
  onLink: (kind: RelationKind, otherId: string) => Promise<void>;
  onUnlink: (rel: Relationship) => Promise<void>;
}

/** Beziehungen einer Person, gruppiert nach Art. */
function relationsOf(person: Person, data: FamilyData) {
  const out: Record<RelationKind, { rel: Relationship; other: Person }[]> = { parent: [], partner: [], child: [] };
  const byId = new Map(data.persons.map((p) => [p.id, p]));
  for (const rel of data.relationships) {
    if (rel.type === 'parent' && rel.person_b === person.id) out.parent.push({ rel, other: byId.get(rel.person_a)! });
    else if (rel.type === 'parent' && rel.person_a === person.id) out.child.push({ rel, other: byId.get(rel.person_b)! });
    else if (rel.type === 'partner' && (rel.person_a === person.id || rel.person_b === person.id))
      out.partner.push({ rel, other: byId.get(rel.person_a === person.id ? rel.person_b : rel.person_a)! });
  }
  return out;
}

export function PersonDetails({ person, data, onEdit, onDelete, onSelect, onAddNew, onLink, onUnlink }: Props) {
  const relations = relationsOf(person, data);
  const [linkKind, setLinkKind] = useState<RelationKind>('parent');
  const [linkId, setLinkId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const others = data.persons
    .filter((p) => p.id !== person.id)
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'de'));

  async function link() {
    if (!linkId) return;
    setError(null);
    try {
      await onLink(linkKind, linkId);
      setLinkId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="panel">
      <div className="photo-row">
        <div className="avatar big">
          {person.photo_url ? <img src={person.photo_url} alt="" /> : <span>{person.first_name[0]}</span>}
        </div>
        <div>
          <h2>{fullName(person)}</h2>
          <p className="muted">{lifeSpan(person)}</p>
        </div>
      </div>
      <dl>
        {person.birth_date && (
          <>
            <dt>Geboren</dt>
            <dd>{formatDate(person.birth_date)}</dd>
          </>
        )}
        {person.death_date && (
          <>
            <dt>Gestorben</dt>
            <dd>{formatDate(person.death_date)}</dd>
          </>
        )}
      </dl>
      {person.notes && <p className="notes">{person.notes}</p>}
      <div className="actions">
        <button onClick={onEdit}>Bearbeiten</button>
      </div>

      {(Object.keys(LABELS) as RelationKind[]).map((kind) => (
        <section key={kind}>
          <h3>{LABELS[kind].list}</h3>
          {relations[kind].length === 0 && <p className="muted small">Keine eingetragen.</p>}
          <ul className="relations">
            {relations[kind].map(({ rel, other }) => (
              <li key={rel.id}>
                <button className="link" onClick={() => onSelect(other.id)}>
                  {fullName(other)}
                </button>
                <button
                  className="link danger small"
                  title="Verbindung entfernen"
                  onClick={() => {
                    if (confirm(`Verbindung zu ${fullName(other)} entfernen? Die Person selbst bleibt erhalten.`))
                      void onUnlink(rel);
                  }}
                >
                  entfernen
                </button>
              </li>
            ))}
          </ul>
          {!(kind === 'parent' && relations.parent.length >= 2) && (
            <button className="secondary small" onClick={() => onAddNew(kind)}>
              + Neue Person als {LABELS[kind].add}
            </button>
          )}
        </section>
      ))}

      {others.length > 0 && (
        <section>
          <h3>Mit vorhandener Person verbinden</h3>
          <div className="link-row">
            <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as RelationKind)}>
              <option value="parent">ist Elternteil von {person.first_name}</option>
              <option value="child">ist Kind von {person.first_name}</option>
              <option value="partner">ist Partner:in von {person.first_name}</option>
            </select>
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Person wählen …</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)} {lifeSpan(p) && `(${lifeSpan(p)})`}
                </option>
              ))}
            </select>
            <button onClick={link} disabled={!linkId}>
              Verbinden
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      <div className="actions end">
        <button
          className="danger"
          onClick={() => {
            if (confirm(`${fullName(person)} und alle Verbindungen dieser Person wirklich löschen?`)) onDelete();
          }}
        >
          Person löschen
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
