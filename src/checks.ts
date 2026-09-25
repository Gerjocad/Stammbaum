import type { Strings } from './i18n';
import { ancestors, buildGraph, isAncestor, type Graph } from './kinship';
import type { FamilyData, NewRelationship, Person } from './types';

/**
 * Plausibilitätsprüfungen für Verbindungen und Daten.
 * Fehler verhindern das Speichern, Hinweise muss man nur bestätigen.
 */
export interface Findings {
  errors: string[];
  warnings: string[];
}

const MIN_PARENT_AGE = 12;
const year = (d: string) => Number(d.slice(0, 4));

/** Prüft Geburts- und Todesdaten eines Elternteils gegenüber einem Kind. */
function parentDates(parent: Person, child: Person, t: Strings): string[] {
  const out: string[] = [];
  if (parent.birth_date && child.birth_date) {
    if (parent.birth_date >= child.birth_date) out.push(t.warnParentYounger(parent.first_name, child.first_name));
    else if (year(child.birth_date) - year(parent.birth_date) < MIN_PARENT_AGE)
      out.push(t.warnParentTooYoung(parent.first_name, year(child.birth_date) - year(parent.birth_date), child.first_name));
  }
  if (parent.death_date && child.birth_date) {
    // Ein Vater kann bis zu etwa neun Monate vor der Geburt sterben.
    const limit = new Date(child.birth_date);
    limit.setMonth(limit.getMonth() - (parent.gender === 'w' ? 0 : 10));
    if (new Date(parent.death_date) < limit) out.push(t.warnParentDead(parent.first_name, child.first_name));
  }
  return out;
}

function areSiblings(g: Graph, a: string, b: string) {
  const pa = g.parents.get(a) ?? [];
  return pa.length > 0 && pa.some((p) => (g.parents.get(b) ?? []).includes(p));
}

export function checkRelationship(data: FamilyData, rel: NewRelationship, t: Strings): Findings {
  const g = buildGraph(data);
  const errors: string[] = [];
  const warnings: string[] = [];
  const a = g.byId.get(rel.person_a);
  const b = g.byId.get(rel.person_b);
  if (!a || !b) return { errors, warnings };
  if (a.id === b.id) return { errors: [t.errSelf], warnings };

  const exists = data.relationships.some(
    (r) =>
      r.type === rel.type &&
      ((r.person_a === rel.person_a && r.person_b === rel.person_b) ||
        (r.type === 'partner' && r.person_a === rel.person_b && r.person_b === rel.person_a)),
  );
  if (exists) return { errors: [t.errExists], warnings };

  if (rel.type === 'parent') {
    if ((g.parents.get(b.id) ?? []).length >= 2) errors.push(t.errTwoParents);
    // z. B. kann der Vater nicht gleichzeitig der Sohn (oder Enkel) sein.
    if (isAncestor(g, b.id, a.id)) {
      const depth = ancestors(g, a.id).get(b.id)!;
      errors.push(depth === 1 ? t.errParentIsChild(a.first_name, b.first_name) : t.errCycle);
    }
    if ((g.partners.get(a.id) ?? []).includes(b.id)) errors.push(t.errPartnerAsParent(a.first_name, b.first_name));
    else if (areSiblings(g, a.id, b.id)) errors.push(t.errSiblingAsParent(a.first_name, b.first_name));
    warnings.push(...parentDates(a, b, t));
  } else {
    if (isAncestor(g, a.id, b.id) || isAncestor(g, b.id, a.id))
      errors.push(t.errAncestorAsPartner(a.first_name, b.first_name));
    else if (areSiblings(g, a.id, b.id)) warnings.push(t.warnSiblingsAsPartners(a.first_name, b.first_name));
  }
  return { errors, warnings };
}

/** Prüft geänderte Daten einer Person gegen ihre vorhandenen Eltern und Kinder. */
export function checkPersonDates(data: FamilyData, person: Person, t: Strings): string[] {
  const g = buildGraph({ ...data, persons: data.persons.map((p) => (p.id === person.id ? person : p)) });
  const out: string[] = [];
  for (const p of g.parents.get(person.id) ?? []) out.push(...parentDates(g.byId.get(p)!, person, t));
  for (const c of g.children.get(person.id) ?? []) out.push(...parentDates(person, g.byId.get(c)!, t));
  return out;
}

export interface Suggestion {
  key: string;
  text: string;
  rel: NewRelationship;
}

/**
 * Vorschläge, die man bestätigen oder ablehnen kann:
 * - Zwei Elternteile eines Kindes, die noch nicht als Partner verbunden sind.
 * - Ein Kind mit nur einem Elternteil, dessen einzige:r Partner:in wohl der andere Elternteil ist.
 */
export function suggestions(data: FamilyData, t: Strings): Suggestion[] {
  const g = buildGraph(data);
  const out = new Map<string, Suggestion>();
  const name = (id: string) => g.byId.get(id)!.first_name;
  const ok = (rel: NewRelationship) => !checkRelationship(data, rel, t).errors.length;
  for (const child of g.byId.keys()) {
    const parents = g.parents.get(child) ?? [];
    if (parents.length === 2) {
      const [a, b] = [...parents].sort();
      const rel: NewRelationship = { type: 'partner', person_a: a, person_b: b };
      if (!(g.partners.get(a) ?? []).includes(b) && ok(rel))
        out.set(`partner:${a}:${b}`, { key: `partner:${a}:${b}`, text: t.suggestPartners(name(a), name(b), name(child)), rel });
    } else if (parents.length === 1) {
      const partners = g.partners.get(parents[0]) ?? [];
      if (partners.length !== 1) continue;
      const rel: NewRelationship = { type: 'parent', person_a: partners[0], person_b: child };
      const key = `parent:${partners[0]}:${child}`;
      if (ok(rel) && !checkRelationship(data, rel, t).warnings.length)
        out.set(key, { key, text: t.suggestParent(name(partners[0]), name(child)), rel });
    }
  }
  return [...out.values()];
}
