import { describe, expect, it } from 'vitest';
import { checkPersonDates, checkRelationship, suggestions } from './checks';
import { sampleFamily } from './fixtures';
import { STRINGS } from './i18n';
import type { FamilyData } from './types';

const t = STRINGS.de;
const person = (data: FamilyData, id: string) => data.persons.find((p) => p.id === id)!;

describe('checkRelationship', () => {
  it('verhindert, dass der Vater gleichzeitig der Sohn ist', () => {
    const f = checkRelationship(sampleFamily(), { type: 'parent', person_a: 'Ali', person_b: 'Mehmet' }, t);
    expect(f.errors).toEqual([t.errParentIsChild('Ali', 'Mehmet')]);
  });

  it('verhindert Partner zwischen Eltern und Kind', () => {
    const f = checkRelationship(sampleFamily(), { type: 'partner', person_a: 'Cemre', person_b: 'Ali' }, t);
    expect(f.errors).toHaveLength(1);
  });

  it('warnt bei unpassenden Geburtsdaten', () => {
    const f = checkRelationship(sampleFamily(), { type: 'parent', person_a: 'Lena', person_b: 'Hasan' }, t);
    expect(f.warnings).toEqual([t.warnParentYounger('Lena', 'Hasan')]);
  });

  it('warnt, wenn ein Elternteil vor der Geburt gestorben ist', () => {
    const data = sampleFamily();
    person(data, 'Klaus').death_date = '1990-01-01';
    expect(checkPersonDates(data, person(data, 'Klaus'), t)).toEqual([t.warnParentDead('Klaus', 'Lena')]);
  });
});

describe('suggestions', () => {
  it('schlägt die beiden Eltern eines Kindes als Partner vor', () => {
    const data = sampleFamily();
    data.relationships = data.relationships.filter((r) => r.id !== 'p-Ali-Zeynep');
    const s = suggestions(data, t);
    expect(s.map((x) => x.rel)).toContainEqual({ type: 'partner', person_a: 'Ali', person_b: 'Zeynep' });
  });

  it('schlägt die Partnerin als zweiten Elternteil vor', () => {
    const data = sampleFamily();
    data.relationships = data.relationships.filter((r) => r.id !== 'c-Elif-Deniz');
    expect(suggestions(data, t).map((x) => x.rel)).toEqual([{ type: 'parent', person_a: 'Elif', person_b: 'Deniz' }]);
  });

  it('macht bei vollständigen Daten keine Vorschläge', () => {
    expect(suggestions(sampleFamily(), t)).toEqual([]);
  });
});
