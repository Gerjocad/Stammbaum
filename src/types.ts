export type Gender = 'm' | 'w' | 'd';

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  /** Geburts- bzw. Mädchenname, falls anders als der heutige Nachname. */
  birth_name?: string | null;
  birth_date: string | null; // ISO-Datum, z. B. "1950-03-21"
  death_date: string | null;
  gender: Gender;
  photo_url: string | null;
  notes: string | null;
}

export type NewPerson = Omit<Person, 'id'>;

/**
 * Eine Beziehung zwischen zwei Personen.
 * - "parent": person_a ist Elternteil von person_b
 * - "partner": person_a und person_b sind Partner (Richtung egal)
 */
export interface Relationship {
  id: string;
  type: 'parent' | 'partner';
  person_a: string;
  person_b: string;
}

export type NewRelationship = Omit<Relationship, 'id'>;

export interface FamilyData {
  persons: Person[];
  relationships: Relationship[];
}

export function fullName(p: Person): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ');
}

export function lifeSpan(p: Person): string {
  const year = (d: string | null) => (d ? d.slice(0, 4) : '');
  const b = year(p.birth_date);
  const d = year(p.death_date);
  if (!b && !d) return '';
  if (!d) return `* ${b}`;
  return `${b || '?'} – † ${d}`;
}
