import { useCallback, useEffect, useMemo, useState } from 'react';
import { KinshipPanel } from './components/KinshipPanel';
import { Login } from './components/Login';
import { PersonDetails, type RelationKind } from './components/PersonDetails';
import { PersonForm } from './components/PersonForm';
import { CakeIcon, CloseIcon, KinshipIcon, LogOutIcon, ShieldIcon, UserPlusIcon } from './components/Icons';
import { MembersPanel } from './components/MembersPanel';
import { OccasionsPanel } from './components/OccasionsPanel';
import { Settings } from './components/Settings';
import { Tree } from './components/Tree';
import { errorText, useLang, type Strings } from './i18n';
import { upcomingOccasions } from './dates';
import { checkPersonDates, checkRelationship, suggestions, type Findings } from './checks';
import { createStore } from './store';
import { fullName, type FamilyData, type NewPerson, type NewRelationship, type Person, type Profile } from './types';

type Panel =
  | { kind: 'none' }
  | { kind: 'view'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'new'; linkTo?: { relation: RelationKind; personId: string } }
  | { kind: 'kinship' }
  | { kind: 'occasions' }
  | { kind: 'members' };

/** Baut die Beziehung "other ist <relation> von person". */
function toRelationship(relation: RelationKind, personId: string, otherId: string): NewRelationship {
  if (relation === 'parent') return { type: 'parent', person_a: otherId, person_b: personId };
  if (relation === 'child') return { type: 'parent', person_a: personId, person_b: otherId };
  return { type: 'partner', person_a: personId, person_b: otherId };
}

const DISMISSED_KEY = 'stammbaum-dismissed';

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Fehler brechen ab, Hinweise muss man bestätigen. */
function confirmFindings(f: Findings, t: Strings) {
  if (f.errors.length) throw new Error(f.errors[0]);
  if (f.warnings.length && !confirm(`${f.warnings.join('\n')}\n\n${t.saveAnyway}`)) throw new Error('cancelled');
}

export default function App() {
  const { t } = useLang();
  const store = useMemo(createStore, []);
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<FamilyData>({ persons: [], relationships: [] });
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [kinA, setKinA] = useState('');
  const [kinB, setKinB] = useState('');
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [profile, setProfile] = useState<Profile | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await store.load());
      setError(null);
    } catch (err) {
      setError(errorText(err, t));
    }
  }, [store, t]);

  useEffect(() => {
    const check = () => store.getUserEmail().then(setEmail);
    void check();
    return store.onAuthChange(check);
  }, [store]);

  useEffect(() => {
    if (email) void reload();
  }, [email, reload]);

  useEffect(() => {
    if (!email) return setProfile(null);
    store
      .getProfile()
      .then(setProfile)
      .catch((err) => {
        // Ohne Profil-Tabelle (Skript noch nicht ausgeführt) gelten die alten Regeln: alle dürfen bearbeiten.
        setProfile({ id: '', email, name: '', role: 'editor' });
        setError(errorText(err, t));
      });
  }, [email, store, t]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  const closePanel = () => setPanel({ kind: 'none' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel({ kind: 'none' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (email === undefined) return <div className="loading">{t.loading}</div>;
  if (email === null) return <Login onSignIn={(e) => store.signIn(e)} onRegister={(e, n) => store.register(e, n)} />;
  if (!profile) return <div className="loading">{t.loading}</div>;
  const canEdit = profile.role !== 'viewer';
  const isAdmin = profile.role === 'admin';

  const byId = new Map(data.persons.map((p) => [p.id, p]));
  const selectedId = panel.kind === 'view' || panel.kind === 'edit' ? panel.id : null;

  function selectInTree(id: string) {
    if (panel.kind === 'kinship') {
      if (!kinA || (kinA && kinB)) {
        setKinA(id);
        setKinB('');
      } else setKinB(id);
      return;
    }
    setPanel({ kind: 'view', id });
  }

  async function savePerson(person: NewPerson & { id?: string }, photo: Blob | null) {
    let rel: NewRelationship | null = null;
    if (panel.kind === 'new' && panel.linkTo) {
      // Vor dem Speichern prüfen, mit einer vorläufigen ID für die neue Person.
      const draft: Person = { ...person, id: '__new__' };
      rel = toRelationship(panel.linkTo.relation, panel.linkTo.personId, draft.id);
      confirmFindings(checkRelationship({ ...data, persons: [...data.persons, draft] }, rel, t), t);
    } else if (person.id) {
      confirmFindings({ errors: [], warnings: checkPersonDates(data, person as Person, t) }, t);
    }
    // Das Foto ist bereits zugeschnitten und verkleinert (siehe CropDialog).
    if (photo) person.photo_url = await store.uploadPhoto(photo);
    const saved = await store.savePerson(person);
    if (rel) {
      await store.addRelationship({
        ...rel,
        person_a: rel.person_a === '__new__' ? saved.id : rel.person_a,
        person_b: rel.person_b === '__new__' ? saved.id : rel.person_b,
      });
    }
    await reload();
    setPanel({ kind: 'view', id: saved.id });
  }

  const pending = (canEdit ? suggestions(data, t) : []).filter((s) => !dismissed.has(s.key));
  // Vorschläge zur gerade geöffneten Person zuerst.
  pending.sort(
    (a, b) =>
      Number([b.rel.person_a, b.rel.person_b].includes(selectedId ?? '')) -
      Number([a.rel.person_a, a.rel.person_b].includes(selectedId ?? '')),
  );
  const suggestion = pending[0];
  const dismiss = (key: string) => {
    const next = new Set(dismissed).add(key);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
      // ignorieren
    }
  };

  // Beim Hinzufügen eines Partners das andere Geschlecht vorauswählen.
  const partnerGender = (p: Extract<Panel, { kind: 'new' }>) => {
    if (p.linkTo?.relation !== 'partner') return undefined;
    const g = byId.get(p.linkTo.personId)?.gender;
    return g === 'w' ? 'm' : g === 'm' ? 'w' : undefined;
  };

  const newTitle = (p: Extract<Panel, { kind: 'new' }>) => {
    if (!p.linkTo) return t.newPerson;
    const name = byId.get(p.linkTo.personId)?.first_name ?? '';
    return { parent: t.newParentOf, child: t.newChildOf, partner: t.newPartnerOf }[p.linkTo.relation](name);
  };

  let side = null;
  if (panel.kind === 'view' && byId.has(panel.id)) {
    const person = byId.get(panel.id)!;
    side = (
      <PersonDetails
        key={person.id}
        person={person}
        data={data}
        canEdit={canEdit}
        onEdit={() => setPanel({ kind: 'edit', id: person.id })}
        onSelect={(id) => setPanel({ kind: 'view', id })}
        onAddNew={(relation) => setPanel({ kind: 'new', linkTo: { relation, personId: person.id } })}
        onLink={async (relation, otherId) => {
          const rel = toRelationship(relation, person.id, otherId);
          confirmFindings(checkRelationship(data, rel, t), t);
          await store.addRelationship(rel);
          await reload();
        }}
        onUnlink={(rel) => run(() => store.deleteRelationship(rel.id))}
        onDelete={() =>
          run(async () => {
            await store.deletePerson(person.id);
            setPanel({ kind: 'none' });
          })
        }
      />
    );
  } else if (panel.kind === 'edit' && canEdit && byId.has(panel.id)) {
    const person = byId.get(panel.id)!;
    side = (
      <PersonForm
        key={person.id}
        title={t.editPerson(fullName(person))}
        initial={person}
        onSave={savePerson}
        onCancel={() => setPanel({ kind: 'view', id: person.id })}
      />
    );
  } else if (panel.kind === 'new' && canEdit) {
    side = (
      <PersonForm
        key={JSON.stringify(panel.linkTo ?? null)}
        title={newTitle(panel)}
        defaultGender={partnerGender(panel)}
        onSave={savePerson}
        onCancel={() => setPanel(panel.linkTo ? { kind: 'view', id: panel.linkTo.personId } : { kind: 'none' })}
      />
    );
  } else if (panel.kind === 'kinship') {
    side = (
      <KinshipPanel
        data={data}
        a={kinA}
        b={kinB}
        setA={setKinA}
        setB={setKinB}
        onClose={() => setPanel({ kind: 'none' })}
      />
    );
  } else if (panel.kind === 'occasions') {
    side = <OccasionsPanel persons={data.persons} onSelect={(id) => setPanel({ kind: 'view', id })} />;
  } else if (panel.kind === 'members' && isAdmin) {
    side = <MembersPanel store={store} me={profile} />;
  }
  const toggle = (kind: 'new' | 'kinship' | 'occasions' | 'members') =>
    panel.kind === kind ? closePanel() : setPanel({ kind });
  const birthdaysToday = upcomingOccasions(data.persons).filter((o) => o.kind === 'birthday' && o.days === 0);

  return (
    <div className="app">
      <header>
        <h1>{t.appTitle}</h1>
        <div className="header-actions">
          {canEdit && (
            <button className="icon" onClick={() => toggle('new')} title={t.addPerson} aria-label={t.addPerson}>
              <UserPlusIcon />
            </button>
          )}
          <button className="secondary icon" onClick={() => toggle('occasions')} title={t.occasions} aria-label={t.occasions}>
            <CakeIcon />
          </button>
          <button
            className="secondary icon"
            onClick={() => toggle('kinship')}
            disabled={data.persons.length < 2}
            title={t.kinship}
            aria-label={t.kinship}
          >
            <KinshipIcon />
          </button>
          {isAdmin && store.mode === 'supabase' && (
            <button className="secondary icon" onClick={() => toggle('members')} title={t.members} aria-label={t.members}>
              <ShieldIcon />
            </button>
          )}
          <Settings />
          {store.mode === 'supabase' && (
            <button
              className="secondary icon"
              onClick={() => store.signOut()}
              title={`${t.signOut} (${email})`}
              aria-label={t.signOut}
            >
              <LogOutIcon />
            </button>
          )}
        </div>
      </header>
      {store.mode === 'local' && (
        <div className="notice">
          {t.demoNotice}
        </div>
      )}
      {!canEdit && <div className="notice">{t.viewerNotice}</div>}
      {birthdaysToday.map((o) => (
        <div key={o.person.id} className="notice birthday">
          <CakeIcon /> {t.birthdayToday(fullName(o.person), o.years)}
        </div>
      ))}
      {error && (
        <div className="notice error" onClick={() => setError(null)}>
          {error} <span className="muted">{t.hide}</span>
        </div>
      )}
      {suggestion && (
        <div className="notice suggestion">
          <span>
            {pending.length > 1 && <span className="muted">{t.suggestCount(1, pending.length)} · </span>}
            {suggestion.text}
          </span>
          <span className="suggestion-actions">
            <button className="small" onClick={() => run(() => store.addRelationship(suggestion.rel))}>
              {t.suggestYes}
            </button>
            <button className="secondary small" onClick={() => dismiss(suggestion.key)}>
              {t.suggestNo}
            </button>
          </span>
        </div>
      )}
      <main className={side ? 'with-side' : ''}>
        <Tree
          data={data}
          selectedId={selectedId}
          marked={panel.kind === 'kinship' ? [kinA, kinB].filter(Boolean) : []}
          onSelect={selectInTree}
        />
        {side && (
          <aside>
            <button className="secondary icon close-side" onClick={closePanel} title={t.close} aria-label={t.close}>
              <CloseIcon />
            </button>
            {side}
          </aside>
        )}
      </main>
    </div>
  );
}
