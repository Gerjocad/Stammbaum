import { useEffect, useState } from 'react';
import { errorText, useLang } from '../i18n';
import type { Store } from '../store';
import type { Profile, Role } from '../types';

interface Props {
  store: Store;
  me: Profile;
}

export function MembersPanel({ store, me }: Props) {
  const { t } = useLang();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    store
      .listProfiles()
      .then(setProfiles)
      .catch((err) => setError(errorText(err, t)));
  useEffect(() => {
    void load();
  }, [store]);

  async function change(id: string, role: Role) {
    setError(null);
    try {
      await store.setRole(id, role);
      await load();
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  return (
    <div className="panel">
      <h2>{t.members}</h2>
      <p className="muted small">{t.membersHint}</p>
      {error && <p className="error">{error}</p>}
      <ul className="members">
        {profiles.map((p) => (
          <li key={p.id}>
            <div>
              <div>
                {p.name || t.noName} {p.id === me.id && <span className="muted">{t.you}</span>}
              </div>
              <div className="muted small">{p.email}</div>
            </div>
            <select
              value={p.role}
              disabled={p.id === me.id}
              onChange={(e) => change(p.id, e.target.value as Role)}
              aria-label={p.name || p.email}
            >
              <option value="viewer">{t.roleViewer}</option>
              <option value="editor">{t.roleEditor}</option>
              <option value="admin">{t.roleAdmin}</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
