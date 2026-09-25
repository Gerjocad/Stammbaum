import { useCallback, useEffect, useMemo, useState } from 'react';
import { KinshipPanel } from './components/KinshipPanel';
import { Login } from './components/Login';
import { PersonDetails, type RelationKind } from './components/PersonDetails';
import { PersonForm } from './components/PersonForm';
import { KinshipIcon, LogOutIcon, UserPlusIcon } from './components/Icons';
import { Settings } from './components/Settings';
import { Tree } from './components/Tree';
import { useLang, type Strings } from './i18n';
import { resizeImage } from './image';
import { buildGraph, isAncestor } from './kinship';
import { createStore } from './store';
import { fullName, type FamilyData, type NewPerson, type NewRelationship } from './types';

type Panel =
  | { kind: 'none' }
  | { kind: 'view'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'new'; linkTo?: { relation: RelationKind; personId: string } }
  | { kind: 'kinship' };

/** Baut die Beziehung "other ist <relation> von person". */
function toRelationship(relation: RelationKind, personId: string, otherId: string): NewRelationship {
  if (relation === 'parent') return { type: 'parent', person_a: otherId, person_b: personId };
  if (relation === 'child') return { type: 'parent', person_a: personId, person_b: otherId };
  return { type: 'partner', person_a: personId, person_b: otherId };
}

/** Prüft eine neue Beziehung und gibt eine Fehlermeldung zurück, wenn sie nicht passt. */
function validate(data: FamilyData, rel: NewRelationship, t: Strings): string | null {
  if (rel.person_a === rel.person_b) return t.errSelf;
  const exists = data.relationships.some(
    (r) =>
      r.type === rel.type &&
      ((r.person_a === rel.person_a && r.person_b === rel.person_b) ||
        (r.type === 'partner' && r.person_a === rel.person_b && r.person_b === rel.person_a)),
  );
  if (exists) return t.errExists;
  if (rel.type === 'parent') {
    const parents = data.relationships.filter((r) => r.type === 'parent' && r.person_b === rel.person_b);
    if (parents.length >= 2) return t.errTwoParents;
    if (isAncestor(buildGraph(data), rel.person_b, rel.person_a))
      return t.errCycle;
  }
  return null;
}

/** Übersetzt technische Fehlercodes aus Speicher und Bildverarbeitung. */
function errorText(err: unknown, t: Strings): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'storage-full') return t.errStorageFull;
  if (msg === 'image-failed') return t.errImage;
  return msg;
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

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  if (email === undefined) return <div className="loading">{t.loading}</div>;
  if (email === null) return <Login onSignIn={(e) => store.signIn(e)} />;

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

  async function savePerson(person: NewPerson & { id?: string }, photo: File | null) {
    if (photo) person.photo_url = await store.uploadPhoto(await resizeImage(photo));
    const saved = await store.savePerson(person);
    if (panel.kind === 'new' && panel.linkTo) {
      const rel = toRelationship(panel.linkTo.relation, panel.linkTo.personId, saved.id);
      const problem = validate(data, rel, t);
      if (problem) setError(problem);
      else await store.addRelationship(rel);
    }
    await reload();
    setPanel({ kind: 'view', id: saved.id });
  }

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
        onEdit={() => setPanel({ kind: 'edit', id: person.id })}
        onSelect={(id) => setPanel({ kind: 'view', id })}
        onAddNew={(relation) => setPanel({ kind: 'new', linkTo: { relation, personId: person.id } })}
        onLink={async (relation, otherId) => {
          const rel = toRelationship(relation, person.id, otherId);
          const problem = validate(data, rel, t);
          if (problem) throw new Error(problem);
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
  } else if (panel.kind === 'edit' && byId.has(panel.id)) {
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
  } else if (panel.kind === 'new') {
    side = (
      <PersonForm
        key={JSON.stringify(panel.linkTo ?? null)}
        title={newTitle(panel)}
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
  }

  return (
    <div className="app">
      <header>
        <h1>{t.appTitle}</h1>
        <div className="header-actions">
          <button className="icon" onClick={() => setPanel({ kind: 'new' })} title={t.addPerson} aria-label={t.addPerson}>
            <UserPlusIcon />
          </button>
          <button
            className="secondary icon"
            onClick={() => setPanel({ kind: 'kinship' })}
            disabled={data.persons.length < 2}
            title={t.kinship}
            aria-label={t.kinship}
          >
            <KinshipIcon />
          </button>
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
      {error && (
        <div className="notice error" onClick={() => setError(null)}>
          {error} <span className="muted">{t.hide}</span>
        </div>
      )}
      <main className={side ? 'with-side' : ''}>
        <Tree
          data={data}
          selectedId={selectedId}
          marked={panel.kind === 'kinship' ? [kinA, kinB].filter(Boolean) : []}
          onSelect={selectInTree}
        />
        {side && <aside>{side}</aside>}
      </main>
    </div>
  );
}
