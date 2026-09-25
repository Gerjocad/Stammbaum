import { describe, expect, it } from 'vitest';
import { upcomingOccasions } from './dates';
import type { Person } from './types';

const person = (id: string, birth: string | null, death: string | null = null): Person => ({
  id,
  first_name: id,
  last_name: '',
  birth_date: birth,
  death_date: death,
  gender: 'd',
  photo_url: null,
  notes: null,
});

describe('upcomingOccasions', () => {
  const today = new Date(2026, 8, 25); // 25.09.2026

  it('sortiert Geburtstage ab heute und berechnet das Alter', () => {
    const list = upcomingOccasions([person('A', '1990-01-05'), person('B', '1995-09-25'), person('C', '2000-10-01')], today);
    expect(list.map((o) => [o.person.id, o.days, o.years, o.date])).toEqual([
      ['B', 0, 31, '2026-09-25'],
      ['C', 6, 26, '2026-10-01'],
      ['A', 102, 37, '2027-01-05'],
    ]);
  });

  it('zeigt bei Verstorbenen den Todestag statt des Geburtstags', () => {
    const list = upcomingOccasions([person('D', '1930-09-26', '2010-09-30')], today);
    expect(list.map((o) => [o.kind, o.date, o.years])).toEqual([['memorial', '2026-09-30', 16]]);
  });

  it('feiert den 29. Februar in anderen Jahren am 28.', () => {
    const [o] = upcomingOccasions([person('E', '2000-02-29')], today);
    expect(o.date).toBe('2027-02-28');
  });
});
