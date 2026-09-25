import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FamilyData, NewPerson, NewRelationship, Person, Profile, Relationship, Role } from './types';

/**
 * Datenablage. Mit gesetzten VITE_SUPABASE_*-Variablen landen Personen, Beziehungen
 * und Fotos in Supabase und sind für alle eingeloggten Familienmitglieder gleich.
 * Ohne diese Variablen läuft die App im Demo-Modus und speichert nur im Browser.
 */
export interface Store {
  mode: 'supabase' | 'local';
  load(): Promise<FamilyData>;
  savePerson(person: NewPerson & { id?: string }): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  addRelationship(rel: NewRelationship): Promise<Relationship>;
  deleteRelationship(id: string): Promise<void>;
  /** Lädt ein (bereits verkleinertes) Foto hoch und gibt die Bild-URL zurück. */
  uploadPhoto(blob: Blob): Promise<string>;
  getUserEmail(): Promise<string | null>;
  /** Profil der angemeldeten Person mit Rolle. */
  getProfile(): Promise<Profile>;
  /** Alle Profile (nur für admin). */
  listProfiles(): Promise<Profile[]>;
  setRole(id: string, role: Role): Promise<void>;
  signIn(email: string): Promise<void>;
  /** Neues Konto: Nach dem Klick auf den Link darf die Person zunächst nur ansehen. */
  register(email: string, name: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;
}

const PHOTO_BUCKET = 'photos';

/**
 * Supabase liefert Datenbankfehler als einfache Objekte statt als Error.
 * Hier wird daraus ein echter Error mit lesbarer Meldung; eine fehlende Spalte
 * bekommt einen eigenen Code, damit die Oberfläche erklären kann, was zu tun ist.
 */
export function toError(error: { message?: string; code?: string }): Error {
  const msg = error.message ?? JSON.stringify(error);
  if (
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /column .* (does not exist|in the schema cache)|could not find the table/i.test(msg)
  ) {
    return new Error('schema-outdated', { cause: error });
  }
  return new Error(msg, { cause: error });
}

class SupabaseStore implements Store {
  mode = 'supabase' as const;
  constructor(private db: SupabaseClient) {}

  async load(): Promise<FamilyData> {
    const [persons, relationships] = await Promise.all([
      this.db.from('persons').select('*').order('birth_date', { ascending: true, nullsFirst: false }),
      this.db.from('relationships').select('*'),
    ]);
    if (persons.error) throw toError(persons.error);
    if (relationships.error) throw toError(relationships.error);
    return { persons: persons.data as Person[], relationships: relationships.data as Relationship[] };
  }

  async savePerson(person: NewPerson & { id?: string }): Promise<Person> {
    const { data, error } = person.id
      ? await this.db.from('persons').update(person).eq('id', person.id).select().single()
      : await this.db.from('persons').insert(person).select().single();
    if (error) throw toError(error);
    return data as Person;
  }

  async deletePerson(id: string): Promise<void> {
    const { error } = await this.db.from('persons').delete().eq('id', id);
    if (error) throw toError(error);
  }

  async addRelationship(rel: NewRelationship): Promise<Relationship> {
    const { data, error } = await this.db.from('relationships').insert(rel).select().single();
    if (error) throw toError(error);
    return data as Relationship;
  }

  async deleteRelationship(id: string): Promise<void> {
    const { error } = await this.db.from('relationships').delete().eq('id', id);
    if (error) throw toError(error);
  }

  async uploadPhoto(blob: Blob): Promise<string> {
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await this.db.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw toError(error);
    return this.db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async getUserEmail(): Promise<string | null> {
    const { data } = await this.db.auth.getSession();
    return data.session?.user.email ?? null;
  }

  async getProfile(): Promise<Profile> {
    const { data: session } = await this.db.auth.getSession();
    const id = session.session?.user.id;
    const { data, error } = await this.db.from('profiles').select('*').eq('id', id ?? '').maybeSingle();
    if (error) throw toError(error);
    if (!data) throw new Error('schema-outdated');
    return data as Profile;
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await this.db.from('profiles').select('*').order('created_at');
    if (error) throw toError(error);
    return data as Profile[];
  }

  async setRole(id: string, role: Role): Promise<void> {
    const { error } = await this.db.from('profiles').update({ role }).eq('id', id);
    if (error) throw toError(error);
  }

  async signIn(email: string): Promise<void> {
    const { error } = await this.db.auth.signInWithOtp({
      email,
      // Anmelden nur mit vorhandenem Konto; neue Konten entstehen über register().
      options: { shouldCreateUser: false, emailRedirectTo: window.location.href.split('#')[0] },
    });
    if (error) throw toError(error);
  }

  async register(email: string, name: string): Promise<void> {
    const { error } = await this.db.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { name }, emailRedirectTo: window.location.href.split('#')[0] },
    });
    if (error) throw toError(error);
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  onAuthChange(cb: () => void): () => void {
    const { data } = this.db.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  }
}

const LOCAL_KEY = 'stammbaum-demo';

class LocalStore implements Store {
  mode = 'local' as const;

  private read(): FamilyData {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as FamilyData;
    } catch {
      // Speicher nicht verfügbar: mit leerem Stammbaum weitermachen.
    }
    return { persons: [], relationships: [] };
  }

  private write(data: FamilyData) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) {
      // Die Oberfläche übersetzt diesen Code in eine verständliche Meldung.
      throw new Error('storage-full', { cause: e });
    }
  }

  async load(): Promise<FamilyData> {
    return this.read();
  }

  async savePerson(person: NewPerson & { id?: string }): Promise<Person> {
    const data = this.read();
    const saved: Person = { ...person, id: person.id ?? crypto.randomUUID() };
    const idx = data.persons.findIndex((p) => p.id === saved.id);
    if (idx >= 0) data.persons[idx] = saved;
    else data.persons.push(saved);
    this.write(data);
    return saved;
  }

  async deletePerson(id: string): Promise<void> {
    const data = this.read();
    data.persons = data.persons.filter((p) => p.id !== id);
    data.relationships = data.relationships.filter((r) => r.person_a !== id && r.person_b !== id);
    this.write(data);
  }

  async addRelationship(rel: NewRelationship): Promise<Relationship> {
    const data = this.read();
    const saved = { ...rel, id: crypto.randomUUID() };
    data.relationships.push(saved);
    this.write(data);
    return saved;
  }

  async deleteRelationship(id: string): Promise<void> {
    const data = this.read();
    data.relationships = data.relationships.filter((r) => r.id !== id);
    this.write(data);
  }

  uploadPhoto(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async getUserEmail(): Promise<string | null> {
    return 'demo';
  }
  async getProfile(): Promise<Profile> {
    return { id: 'demo', email: 'demo', name: 'Demo', role: 'admin' };
  }
  async listProfiles(): Promise<Profile[]> {
    return [await this.getProfile()];
  }
  async setRole(): Promise<void> {}
  async signIn(): Promise<void> {}
  async register(): Promise<void> {}
  async signOut(): Promise<void> {}
  onAuthChange(): () => void {
    return () => {};
  }
}

export function createStore(): Store {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return new SupabaseStore(createClient(url, key));
  return new LocalStore();
}
