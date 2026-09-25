import type { Person } from './types';

export interface Occasion {
  person: Person;
  /** birthday = Geburtstag (lebende Personen), memorial = Todestag (verstorbene Personen) */
  kind: 'birthday' | 'memorial';
  /** Nächstes Datum als ISO-Datum (YYYY-MM-DD). */
  date: string;
  /** Tage bis dahin, 0 = heute. */
  days: number;
  /** Wievielter Geburtstag bzw. Todestag. */
  years: number;
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Nächster Jahrestag ab `today`; der 29. Februar fällt in anderen Jahren auf den 28. */
function next(dateIso: string, today: Date) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const on = (year: number) => {
    const leap = new Date(year, 1, 29).getMonth() === 1;
    return new Date(year, m - 1, m === 2 && d === 29 && !leap ? 28 : d);
  };
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let year = start.getFullYear();
  if (on(year) < start) year++;
  const date = on(year);
  return { date: iso(date), days: Math.round((date.getTime() - start.getTime()) / DAY), years: year - y };
}

/** Kommende Geburtstage und Todestage innerhalb eines Jahres, nach Datum sortiert. */
export function upcomingOccasions(persons: Person[], today = new Date()): Occasion[] {
  const out: Occasion[] = [];
  for (const person of persons) {
    if (!person.death_date && person.birth_date) out.push({ person, kind: 'birthday', ...next(person.birth_date, today) });
    if (person.death_date) out.push({ person, kind: 'memorial', ...next(person.death_date, today) });
  }
  return out.filter((o) => o.years > 0).sort((a, b) => a.days - b.days || a.person.first_name.localeCompare(b.person.first_name));
}
