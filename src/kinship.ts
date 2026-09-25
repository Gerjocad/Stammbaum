import { fullName, type FamilyData, type Gender, type Person } from './types';

export interface Graph {
  byId: Map<string, Person>;
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  partners: Map<string, string[]>;
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else {
    map.set(key, [value]);
  }
}

export function buildGraph(data: FamilyData): Graph {
  const byId = new Map(data.persons.map((p) => [p.id, p]));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const r of data.relationships) {
    if (!byId.has(r.person_a) || !byId.has(r.person_b)) continue;
    if (r.type === 'parent') {
      push(parents, r.person_b, r.person_a);
      push(children, r.person_a, r.person_b);
    } else {
      push(partners, r.person_a, r.person_b);
      push(partners, r.person_b, r.person_a);
    }
  }
  return { byId, parents, children, partners };
}

/** Alle Vorfahren (inkl. der Person selbst mit Tiefe 0) mit kürzestem Abstand. */
export function ancestors(g: Graph, id: string): Map<string, number> {
  const depth = new Map<string, number>([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const p of g.parents.get(cur) ?? []) {
      if (!depth.has(p)) {
        depth.set(p, depth.get(cur)! + 1);
        queue.push(p);
      }
    }
  }
  return depth;
}

/** True, wenn `ancestorId` ein Vorfahre von `id` ist (oder dieselbe Person). */
export function isAncestor(g: Graph, ancestorId: string, id: string): boolean {
  return ancestors(g, id).has(ancestorId);
}

export interface BloodRelation {
  up: number; // Generationen von A hoch zum gemeinsamen Vorfahren
  down: number; // Generationen von B hoch zum gemeinsamen Vorfahren
  common: string[]; // nächste gemeinsame Vorfahren
}

export function bloodRelation(g: Graph, a: string, b: string): BloodRelation | null {
  const ancA = ancestors(g, a);
  const ancB = ancestors(g, b);
  let best: BloodRelation | null = null;
  for (const [id, dA] of ancA) {
    const dB = ancB.get(id);
    if (dB === undefined) continue;
    const better =
      !best ||
      dA + dB < best.up + best.down ||
      (dA + dB === best.up + best.down && Math.min(dA, dB) < Math.min(best.up, best.down));
    if (better) best = { up: dA, down: dB, common: [id] };
    else if (best && dA === best.up && dB === best.down) best.common.push(id);
  }
  return best;
}

function g3(gender: Gender, m: string, w: string, d: string): string {
  return gender === 'm' ? m : gender === 'w' ? w : d;
}

function ur(n: number): string {
  return 'Ur'.repeat(n);
}

/** Capitalise only the first letter ("urgroß…" → "Urgroß…"). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bezeichnung dafür, was A für B ist, bei Blutsverwandtschaft. */
export function bloodTerm(up: number, down: number, gender: Gender, half = false): string {
  if (up === 0 && down === 0) return 'dieselbe Person';
  if (up === 0) {
    // A ist Vorfahre von B
    if (down === 1) return g3(gender, 'Vater', 'Mutter', 'Elternteil');
    const base = g3(gender, 'großvater', 'großmutter', 'großelternteil');
    return cap(ur(down - 2) + base);
  }
  if (down === 0) {
    // A ist Nachkomme von B
    if (up === 1) return g3(gender, 'Sohn', 'Tochter', 'Kind');
    const base = up === 2 ? g3(gender, 'Enkel', 'Enkelin', 'Enkelkind') : g3(gender, 'enkel', 'enkelin', 'enkelkind');
    return up === 2 ? base : cap(ur(up - 2) + base);
  }
  if (up === 1 && down === 1) {
    const t = g3(gender, 'Bruder', 'Schwester', 'Geschwister');
    return half ? 'Halb' + t.toLowerCase() : t;
  }
  if (up === 1) {
    // A ist Geschwister eines Vorfahren von B
    if (down === 2) return g3(gender, 'Onkel', 'Tante', 'Onkel/Tante');
    const base = g3(gender, 'großonkel', 'großtante', 'großonkel/-tante');
    return cap(ur(down - 3) + base);
  }
  if (down === 1) {
    // A ist Nachkomme eines Geschwisters von B
    if (up === 2) return g3(gender, 'Neffe', 'Nichte', 'Neffe/Nichte');
    const base = g3(gender, 'großneffe', 'großnichte', 'großneffe/-nichte');
    return cap(ur(up - 3) + base);
  }
  const degree = Math.min(up, down) - 1;
  const diff = Math.abs(up - down);
  const t = `${g3(gender, 'Cousin', 'Cousine', 'Cousin/Cousine')} ${degree}. Grades`;
  if (diff === 0) return t;
  return `${t}, ${diff === 1 ? 'eine Generation' : `${diff} Generationen`} versetzt`;
}

export interface KinshipResult {
  /** z. B. "Anna ist die Tante von Ben." */
  sentence: string;
  /** Zusätzliche Erklärung, z. B. gemeinsame Vorfahren. */
  detail?: string;
}

function article(gender: Gender): string {
  return g3(gender, 'der ', 'die ', '');
}

function names(g: Graph, ids: string[]): string {
  const list = ids.map((id) => fullName(g.byId.get(id)!));
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1];
}

function sharedParents(g: Graph, a: string, b: string): number {
  const pb = g.parents.get(b) ?? [];
  return (g.parents.get(a) ?? []).filter((p) => pb.includes(p)).length;
}

function bloodTermFor(g: Graph, a: string, b: string, rel: BloodRelation): string {
  const A = g.byId.get(a)!;
  let half = false;
  if (rel.up === 1 && rel.down === 1) {
    const shared = sharedParents(g, a, b);
    const both = (g.parents.get(a)?.length ?? 0) === 2 && (g.parents.get(b)?.length ?? 0) === 2;
    half = shared === 1 && both;
  }
  return bloodTerm(rel.up, rel.down, A.gender, half);
}

/** Was ist A für B? */
export function describeKinship(data: FamilyData, a: string, b: string): KinshipResult {
  const g = buildGraph(data);
  const A = g.byId.get(a);
  const B = g.byId.get(b);
  if (!A || !B) return { sentence: 'Bitte zwei Personen auswählen.' };
  const nameA = fullName(A);
  const nameB = fullName(B);
  if (a === b) return { sentence: `${nameA} und ${nameB} sind dieselbe Person.` };

  const say = (term: string, detail?: string): KinshipResult => ({
    sentence: `${nameA} ist ${article(A.gender)}${term} von ${nameB}.`,
    detail,
  });

  // 1. Blutsverwandtschaft
  const rel = bloodRelation(g, a, b);
  if (rel) {
    const term = bloodTermFor(g, a, b, rel);
    const detail =
      rel.up > 0 && rel.down > 0 ? `Gemeinsame Vorfahren: ${names(g, rel.common)}` : undefined;
    return say(term, detail);
  }

  const partnersOf = (id: string) => g.partners.get(id) ?? [];
  const parentsOf = (id: string) => g.parents.get(id) ?? [];
  const childrenOf = (id: string) => g.children.get(id) ?? [];
  const siblingsOf = (id: string) => {
    const s = new Set<string>();
    for (const p of parentsOf(id)) for (const c of childrenOf(p)) if (c !== id) s.add(c);
    return [...s];
  };

  // 2. Direkte Partnerschaft
  if (partnersOf(a).includes(b)) return say(g3(A.gender, 'Partner', 'Partnerin', 'Partner:in'));

  // 3. Bekannte Schwieger- und Stiefbeziehungen
  if (partnersOf(b).some((p) => parentsOf(p).includes(a)))
    return say(g3(A.gender, 'Schwiegervater', 'Schwiegermutter', 'Schwiegerelternteil'));
  if (childrenOf(b).some((c) => partnersOf(c).includes(a)))
    return say(g3(A.gender, 'Schwiegersohn', 'Schwiegertochter', 'Schwiegerkind'));
  if (
    partnersOf(b).some((p) => siblingsOf(p).includes(a)) ||
    siblingsOf(b).some((s) => partnersOf(s).includes(a))
  )
    return say(g3(A.gender, 'Schwager', 'Schwägerin', 'Schwager/Schwägerin'));
  if (parentsOf(b).some((p) => partnersOf(p).includes(a)))
    return say(g3(A.gender, 'Stiefvater', 'Stiefmutter', 'Stiefelternteil'));
  if (parentsOf(a).some((p) => partnersOf(p).includes(b)))
    return say(g3(A.gender, 'Stiefsohn', 'Stieftochter', 'Stiefkind'));

  // 4. Angeheiratet über eine Partnerschaft
  for (const p of partnersOf(a)) {
    const r = bloodRelation(g, p, b);
    if (r) {
      const P = g.byId.get(p)!;
      return {
        sentence: `${nameA} ist angeheiratet mit ${nameB} verwandt.`,
        detail: `${nameA} ist ${article(A.gender)}${g3(A.gender, 'Partner', 'Partnerin', 'Partner:in')} von ${fullName(P)}, und ${fullName(P)} ist ${article(P.gender)}${bloodTermFor(g, p, b, r)} von ${nameB}.`,
      };
    }
  }
  for (const p of partnersOf(b)) {
    const r = bloodRelation(g, a, p);
    if (r) {
      const P = g.byId.get(p)!;
      return {
        sentence: `${nameA} ist angeheiratet mit ${nameB} verwandt.`,
        detail: `${nameA} ist ${article(A.gender)}${bloodTermFor(g, a, p, r)} von ${fullName(P)}, und ${fullName(P)} ist ${article(P.gender)}${g3(P.gender, 'Partner', 'Partnerin', 'Partner:in')} von ${nameB}.`,
      };
    }
  }

  // 5. Irgendeine Verbindung über mehrere Ehen/Partnerschaften
  const path = shortestPath(g, a, b);
  if (path) {
    const steps: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const x = g.byId.get(path[i])!;
      const y = path[i + 1];
      const term = parentsOf(y).includes(x.id)
        ? g3(x.gender, 'Vater', 'Mutter', 'Elternteil')
        : childrenOf(y).includes(x.id)
          ? g3(x.gender, 'Sohn', 'Tochter', 'Kind')
          : g3(x.gender, 'Partner', 'Partnerin', 'Partner:in');
      steps.push(`${fullName(x)} ist ${article(x.gender)}${term} von ${fullName(g.byId.get(y)!)}`);
    }
    return {
      sentence: `${nameA} und ${nameB} sind über Partnerschaften miteinander verbunden.`,
      detail: steps.join('; ') + '.',
    };
  }

  return { sentence: `Zwischen ${nameA} und ${nameB} ist keine Verbindung eingetragen.` };
}

/** Kürzester Weg über Eltern-, Kind- und Partnerbeziehungen. */
function shortestPath(g: Graph, a: string, b: string): string[] | null {
  const prev = new Map<string, string | null>([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === b) break;
    for (const next of [...(g.parents.get(cur) ?? []), ...(g.children.get(cur) ?? []), ...(g.partners.get(cur) ?? [])]) {
      if (!prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(b)) return null;
  const path = [b];
  while (prev.get(path[0])) path.unshift(prev.get(path[0])!);
  return path;
}
