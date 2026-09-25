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
