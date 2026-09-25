import type { FamilyData, Gender, Person, Relationship } from './types';

/** Beispielfamilie für Tests: drei Generationen, mit angeheirateter Familie. */
export function sampleFamily(): FamilyData {
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  const add = (id: string, gender: Gender, year: number) =>
    persons.push({
      id,
      first_name: id,
      last_name: '',
      birth_date: `${year}-01-01`,
      death_date: null,
      gender,
      photo_url: null,
      notes: null,
    });
  const partner = (a: string, b: string) =>
    relationships.push({ id: `p-${a}-${b}`, type: 'partner', person_a: a, person_b: b });
  const child = (parents: string[], kid: string) =>
    parents.forEach((p) => relationships.push({ id: `c-${p}-${kid}`, type: 'parent', person_a: p, person_b: kid }));

  add('Mehmet', 'm', 1940);
  add('Fatma', 'w', 1945);
  add('Ali', 'm', 1965);
  add('Ayse', 'w', 1968);
  add('Hasan', 'm', 1972);
  add('Osman', 'm', 1942);
  add('Hatice', 'w', 1946);
  add('Zeynep', 'w', 1967);
  add('Murat', 'm', 1970);
  add('Elif', 'w', 1972);
  add('Deniz', 'm', 2001);
  add('Klaus', 'm', 1966);
  add('Cemre', 'w', 1995);
  add('Emre', 'm', 1998);
  add('Lena', 'w', 2000);
  add('Jonas', 'm', 1994);
  add('Mia', 'w', 2022);

  partner('Mehmet', 'Fatma');
  child(['Mehmet', 'Fatma'], 'Ali');
  child(['Mehmet', 'Fatma'], 'Ayse');
  child(['Mehmet', 'Fatma'], 'Hasan');
  partner('Osman', 'Hatice');
  child(['Osman', 'Hatice'], 'Zeynep');
  child(['Osman', 'Hatice'], 'Murat');
  partner('Ali', 'Zeynep');
  child(['Ali', 'Zeynep'], 'Cemre');
  child(['Ali', 'Zeynep'], 'Emre');
  partner('Ayse', 'Klaus');
  child(['Ayse', 'Klaus'], 'Lena');
  partner('Murat', 'Elif');
  child(['Murat', 'Elif'], 'Deniz');
  partner('Cemre', 'Jonas');
  child(['Cemre', 'Jonas'], 'Mia');
  return { persons, relationships };
}
