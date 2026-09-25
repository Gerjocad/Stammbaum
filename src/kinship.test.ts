import { describe, expect, it } from 'vitest';
import { describeKinship } from './kinship';
import type { FamilyData, Gender, Person, Relationship } from './types';

function person(id: string, gender: Gender): Person {
  return {
    id,
    first_name: id,
    last_name: '',
    birth_date: null,
    death_date: null,
    gender,
    photo_url: null,
    notes: null,
  };
}

let n = 0;
const parent = (a: string, b: string): Relationship => ({ id: `r${n++}`, type: 'parent', person_a: a, person_b: b });
const partner = (a: string, b: string): Relationship => ({ id: `r${n++}`, type: 'partner', person_a: a, person_b: b });

// Opa ⚭ Oma
//  ├─ Vater ⚭ Mutter
//  │    ├─ Ich
//  │    └─ Schwester ⚭ Schwager ── Nichte
//  └─ Tante ⚭ Onkel
//       └─ Cousin ── Cousinkind
// Halbbruder: Vater + Ex
const data: FamilyData = {
  persons: [
    person('Opa', 'm'),
    person('Oma', 'w'),
    person('Vater', 'm'),
    person('Mutter', 'w'),
    person('Ex', 'w'),
    person('Ich', 'd'),
    person('Schwester', 'w'),
    person('Schwager', 'm'),
    person('Nichte', 'w'),
    person('Halbbruder', 'm'),
    person('Tante', 'w'),
    person('Onkel', 'm'),
    person('Cousin', 'm'),
    person('Cousinkind', 'w'),
  ],
  relationships: [
    partner('Opa', 'Oma'),
    parent('Opa', 'Vater'),
    parent('Oma', 'Vater'),
    parent('Opa', 'Tante'),
    parent('Oma', 'Tante'),
    partner('Vater', 'Mutter'),
    parent('Vater', 'Ich'),
    parent('Mutter', 'Ich'),
    parent('Vater', 'Schwester'),
    parent('Mutter', 'Schwester'),
    parent('Vater', 'Halbbruder'),
    parent('Ex', 'Halbbruder'),
    partner('Schwester', 'Schwager'),
    parent('Schwester', 'Nichte'),
    parent('Schwager', 'Nichte'),
    partner('Tante', 'Onkel'),
    parent('Tante', 'Cousin'),
    parent('Onkel', 'Cousin'),
    parent('Cousin', 'Cousinkind'),
  ],
};

const s = (a: string, b: string) => describeKinship(data, a, b).sentence;

describe('describeKinship', () => {
  it('names direct lines', () => {
    expect(s('Vater', 'Ich')).toBe('Vater ist der Vater von Ich.');
    expect(s('Oma', 'Ich')).toBe('Oma ist die Großmutter von Ich.');
    expect(s('Opa', 'Nichte')).toBe('Opa ist der Urgroßvater von Nichte.');
    expect(s('Ich', 'Vater')).toBe('Ich ist Kind von Vater.');
    expect(s('Nichte', 'Oma')).toBe('Nichte ist die Urenkelin von Oma.');
  });

  it('names siblings, aunts and cousins', () => {
    expect(s('Schwester', 'Ich')).toBe('Schwester ist die Schwester von Ich.');
    expect(s('Halbbruder', 'Schwester')).toBe('Halbbruder ist der Halbbruder von Schwester.');
    expect(s('Tante', 'Ich')).toBe('Tante ist die Tante von Ich.');
    expect(s('Tante', 'Nichte')).toBe('Tante ist die Großtante von Nichte.');
    expect(s('Nichte', 'Ich')).toBe('Nichte ist die Nichte von Ich.');
    expect(s('Cousin', 'Ich')).toBe('Cousin ist der Cousin 1. Grades von Ich.');
    expect(s('Cousinkind', 'Ich')).toBe('Cousinkind ist die Cousine 1. Grades, eine Generation versetzt von Ich.');
    expect(s('Cousinkind', 'Nichte')).toBe('Cousinkind ist die Cousine 2. Grades von Nichte.');
  });

  it('names partners and in-laws', () => {
    expect(s('Mutter', 'Vater')).toBe('Mutter ist die Partnerin von Vater.');
    expect(s('Schwager', 'Ich')).toBe('Schwager ist der Schwager von Ich.');
    expect(s('Vater', 'Schwager')).toBe('Vater ist der Schwiegervater von Schwager.');
    expect(s('Schwager', 'Mutter')).toBe('Schwager ist der Schwiegersohn von Mutter.');
    expect(s('Mutter', 'Halbbruder')).toBe('Mutter ist die Stiefmutter von Halbbruder.');
    expect(s('Onkel', 'Ich')).toBe('Onkel ist angeheiratet mit Ich verwandt.');
    expect(describeKinship(data, 'Onkel', 'Ich').detail).toBe(
      'Onkel ist der Partner von Tante, und Tante ist die Tante von Ich.',
    );
  });

  it('explains distant connections through partnerships', () => {
    const r = describeKinship(data, 'Ex', 'Onkel');
    expect(r.sentence).toBe('Ex und Onkel sind über Partnerschaften miteinander verbunden.');
    expect(r.detail).toBe(
      'Ex ist die Mutter von Halbbruder; Halbbruder ist der Sohn von Vater; Vater ist der Sohn von Opa; Opa ist der Vater von Tante; Tante ist die Partnerin von Onkel.',
    );
  });

  it('reports unconnected people', () => {
    const lonely = { ...data, persons: [...data.persons, person('Fremd', 'm')] };
    expect(describeKinship(lonely, 'Fremd', 'Ich').sentence).toBe(
      'Zwischen Fremd und Ich ist keine Verbindung eingetragen.',
    );
  });
});

describe('describeKinship auf Türkisch', () => {
  const t = (a: string, b: string) => describeKinship(data, a, b, 'tr').sentence;
  // Väterliche und mütterliche Seite unterscheiden: Mutter bekommt eine eigene Schwester.
  const withMaternal: FamilyData = {
    persons: [...data.persons, person('Oma2', 'w'), person('Teyze', 'w'), person('Dayi', 'm')],
    relationships: [
      ...data.relationships,
      parent('Oma2', 'Mutter'),
      parent('Oma2', 'Teyze'),
      parent('Oma2', 'Dayi'),
    ],
  };
  const tm = (a: string, b: string) => describeKinship(withMaternal, a, b, 'tr').sentence;

  it('unterscheidet väterliche und mütterliche Seite', () => {
    expect(t('Tante', 'Ich')).toBe('Tante, Ich için: Hala.');
    expect(tm('Teyze', 'Ich')).toBe('Teyze, Ich için: Teyze.');
    expect(tm('Dayi', 'Ich')).toBe('Dayi, Ich için: Dayı.');
    expect(t('Oma', 'Ich')).toBe('Oma, Ich için: Babaanne.');
    expect(tm('Oma2', 'Ich')).toBe('Oma2, Ich için: Anneanne.');
    expect(t('Opa', 'Ich')).toBe('Opa, Ich için: Dede.');
    expect(t('Tante', 'Nichte')).toBe('Tante, Nichte için: Dedenin kardeşi.');
  });

  it('benennt Kinder, Geschwister, Cousins und Angeheiratete', () => {
    expect(t('Ich', 'Vater')).toBe('Ich, Vater için: Çocuk.');
    expect(t('Nichte', 'Oma')).toBe('Nichte, Oma için: Torunun çocuğu.');
    expect(t('Schwester', 'Ich')).toBe('Schwester, Ich için: Kız kardeş.');
    expect(t('Halbbruder', 'Schwester')).toBe('Halbbruder, Schwester için: Baba bir kardeş.');
    expect(t('Nichte', 'Ich')).toBe('Nichte, Ich için: Yeğen.');
    expect(t('Cousin', 'Ich')).toBe('Cousin, Ich için: Kuzen.');
    expect(t('Onkel', 'Ich')).toBe('Onkel, Ich için: Enişte.');
    expect(t('Schwager', 'Ich')).toBe('Schwager, Ich için: Enişte.');
    expect(t('Vater', 'Schwager')).toBe('Vater, Schwager için: Kayınpeder.');
    expect(t('Schwager', 'Mutter')).toBe('Schwager, Mutter için: Damat.');
    expect(t('Mutter', 'Vater')).toBe('Mutter, Vater için: Eş.');
    expect(t('Mutter', 'Halbbruder')).toBe('Mutter, Halbbruder için: Üvey anne.');
  });

  it('nutzt Ağabey und Abla, wenn das Alter bekannt ist', () => {
    const aged: FamilyData = {
      ...data,
      persons: data.persons.map((p) =>
        p.id === 'Schwester' ? { ...p, birth_date: '1980-01-01' } : p.id === 'Ich' ? { ...p, birth_date: '1985-01-01' } : p,
      ),
    };
    expect(describeKinship(aged, 'Schwester', 'Ich', 'tr').sentence).toBe('Schwester, Ich için: Abla.');
  });
});
