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

export type KinshipLang = 'de' | 'tr';

function article(gender: Gender): string {
  return g3(gender, 'der ', 'die ', '');
}

function sharedParentIds(g: Graph, a: string, b: string): string[] {
  const pb = g.parents.get(b) ?? [];
  return (g.parents.get(a) ?? []).filter((p) => pb.includes(p));
}

/** Weg von `from` nach oben zu `to` (inklusive beider), falls `to` ein Vorfahre ist. */
function pathUp(g: Graph, from: string, to: string): string[] {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const p of g.parents.get(cur) ?? []) {
      if (!prev.has(p)) {
        prev.set(p, cur);
        queue.push(p);
      }
    }
  }
  const path = [to];
  while (prev.get(path[0])) path.unshift(prev.get(path[0])!);
  return path;
}

/** Alles, was eine Sprache braucht, um eine Blutsverwandtschaft zu benennen. */
interface BloodContext {
  g: Graph;
  a: string;
  b: string;
  rel: BloodRelation;
  /** Weg von B hoch zum gemeinsamen Vorfahren: [B, Elternteil von B, …, Vorfahre]. */
  bPath: string[];
}

interface Vocab {
  blood(c: BloodContext): string;
  partner(A: Person): string;
  parentInLaw(A: Person): string;
  childInLaw(A: Person): string;
  /** A ist Partner:in eines Geschwisters von B. */
  partnerOfSibling(A: Person): string;
  /** A ist Geschwister von Bs Partner:in P. */
  siblingOfPartner(A: Person, P: Person): string;
  stepParent(A: Person): string;
  stepChild(A: Person): string;
  parentWord(A: Person): string;
  childWord(A: Person): string;
  /** Satz "A ist <term> von B". */
  is(A: Person, term: string, B: Person): string;
  select: string;
  same(a: string, b: string): string;
  married(a: string, b: string): string;
  connected(a: string, b: string): string;
  none(a: string, b: string): string;
  common(names: string[]): string;
  and: string;
}

function bloodContext(g: Graph, a: string, b: string, rel: BloodRelation): BloodContext {
  return { g, a, b, rel, bPath: pathUp(g, b, rel.common[0]) };
}

const DE: Vocab = {
  blood({ g, a, b, rel }) {
    const A = g.byId.get(a)!;
    let half = false;
    if (rel.up === 1 && rel.down === 1) {
      const both = (g.parents.get(a)?.length ?? 0) === 2 && (g.parents.get(b)?.length ?? 0) === 2;
      half = sharedParentIds(g, a, b).length === 1 && both;
    }
    return bloodTerm(rel.up, rel.down, A.gender, half);
  },
  partner: (A) => g3(A.gender, 'Partner', 'Partnerin', 'Partner:in'),
  parentInLaw: (A) => g3(A.gender, 'Schwiegervater', 'Schwiegermutter', 'Schwiegerelternteil'),
  childInLaw: (A) => g3(A.gender, 'Schwiegersohn', 'Schwiegertochter', 'Schwiegerkind'),
  partnerOfSibling: (A) => g3(A.gender, 'Schwager', 'Schwägerin', 'Schwager/Schwägerin'),
  siblingOfPartner: (A) => g3(A.gender, 'Schwager', 'Schwägerin', 'Schwager/Schwägerin'),
  stepParent: (A) => g3(A.gender, 'Stiefvater', 'Stiefmutter', 'Stiefelternteil'),
  stepChild: (A) => g3(A.gender, 'Stiefsohn', 'Stieftochter', 'Stiefkind'),
  parentWord: (A) => g3(A.gender, 'Vater', 'Mutter', 'Elternteil'),
  childWord: (A) => g3(A.gender, 'Sohn', 'Tochter', 'Kind'),
  is: (A, term, B) => `${fullName(A)} ist ${article(A.gender)}${term} von ${fullName(B)}`,
  select: 'Bitte zwei Personen auswählen.',
  same: (a, b) => `${a} und ${b} sind dieselbe Person.`,
  married: (a, b) => `${a} ist angeheiratet mit ${b} verwandt.`,
  connected: (a, b) => `${a} und ${b} sind über Partnerschaften miteinander verbunden.`,
  none: (a, b) => `Zwischen ${a} und ${b} ist keine Verbindung eingetragen.`,
  common: (names) => `Gemeinsame Vorfahren: ${joinNames(names, 'und')}`,
  and: ', und ',
};

/** Türkische Vorfahrenbezeichnung; `side` ist das Geschlecht des Elternteils von B auf dieser Linie. */
function trAncestor(level: number, gender: Gender, side: Gender | undefined, withCount = true): string {
  if (level === 1) return g3(gender, 'Baba', 'Anne', 'Ebeveyn');
  if (level === 2) {
    if (gender === 'm') return 'Dede';
    if (gender === 'w') return side === 'm' ? 'Babaanne' : side === 'w' ? 'Anneanne' : 'Büyükanne';
    return 'Büyük ebeveyn';
  }
  const base = g3(gender, 'Büyük dede', 'Büyük nine', 'Büyük ebeveyn');
  return withCount && level > 3 ? `${base} (${level} kuşak)` : base;
}

/** Türkischer Genitiv für die Wörter aus trAncestor ("Babaanne" → "Babaannenin"). */
function trGenitive(word: string): string {
  return word.endsWith('ebeveyn') ? `${word}inin` : `${word}nin`;
}

const TR: Vocab = {
  blood({ g, a, b, rel, bPath }) {
    const A = g.byId.get(a)!;
    const B = g.byId.get(b)!;
    const gA = A.gender;
    const side = bPath[1] ? g.byId.get(bPath[1])!.gender : undefined;
    const { up, down } = rel;
    if (up === 0 && down === 0) return 'aynı kişi';
    if (up === 0) return trAncestor(down, gA, side);
    if (down === 0) {
      if (up === 1) return g3(gA, 'Oğul', 'Kız', 'Çocuk');
      if (up === 2) return 'Torun';
      if (up === 3) return 'Torunun çocuğu';
      if (up === 4) return 'Torunun torunu';
      return `Torun (${up} kuşak)`;
    }
    if (up === 1 && down === 1) {
      const shared = sharedParentIds(g, a, b);
      const both = (g.parents.get(a)?.length ?? 0) === 2 && (g.parents.get(b)?.length ?? 0) === 2;
      if (shared.length === 1 && both) {
        const pg = g.byId.get(shared[0])!.gender;
        return pg === 'm' ? 'Baba bir kardeş' : pg === 'w' ? 'Anne bir kardeş' : 'Yarı kardeş';
      }
      if (A.birth_date && B.birth_date && A.birth_date < B.birth_date) {
        if (gA === 'm') return 'Ağabey';
        if (gA === 'w') return 'Abla';
      }
      return g3(gA, 'Erkek kardeş', 'Kız kardeş', 'Kardeş');
    }
    if (up === 1) {
      if (down === 2) {
        if (gA === 'd') return 'Ebeveyninin kardeşi';
        if (side === 'm') return gA === 'm' ? 'Amca' : 'Hala';
        if (side === 'w') return gA === 'm' ? 'Dayı' : 'Teyze';
        return gA === 'm' ? 'Amca/Dayı' : 'Hala/Teyze';
      }
      const ancestor = g.byId.get(bPath[down - 1])!;
      return `${trGenitive(trAncestor(down - 1, ancestor.gender, side, false))} kardeşi`;
    }
    if (down === 1) {
      if (up === 2) return 'Yeğen';
      if (up === 3) return 'Yeğenin çocuğu';
      if (up === 4) return 'Yeğenin torunu';
      return `Yeğen (${up - 1} kuşak)`;
    }
    const degree = Math.min(up, down) - 1;
    const diff = Math.abs(up - down);
    const base = degree === 1 ? 'Kuzen' : `${degree}. dereceden kuzen`;
    return diff ? `${base}, ${diff} kuşak farkla` : base;
  },
  partner: () => 'Eş',
  parentInLaw: (A) => g3(A.gender, 'Kayınpeder', 'Kayınvalide', 'Eşinin ebeveyni'),
  childInLaw: (A) => g3(A.gender, 'Damat', 'Gelin', 'Çocuğunun eşi'),
  partnerOfSibling: (A) => g3(A.gender, 'Enişte', 'Yenge', 'Kardeşinin eşi'),
  siblingOfPartner: (A, P) => {
    if (A.gender === 'm') return 'Kayınbirader';
    if (A.gender === 'w') return P.gender === 'w' ? 'Baldız' : P.gender === 'm' ? 'Görümce' : 'Eşinin kız kardeşi';
    return 'Eşinin kardeşi';
  },
  stepParent: (A) => g3(A.gender, 'Üvey baba', 'Üvey anne', 'Üvey ebeveyn'),
  stepChild: (A) => g3(A.gender, 'Üvey oğul', 'Üvey kız', 'Üvey çocuk'),
  parentWord: (A) => g3(A.gender, 'Baba', 'Anne', 'Ebeveyn'),
  childWord: (A) => g3(A.gender, 'Oğul', 'Kız', 'Çocuk'),
  is: (A, term, B) => `${fullName(A)}, ${fullName(B)} için: ${term}`,
  select: 'Lütfen iki kişi seç.',
  same: (a, b) => `${a} ve ${b} aynı kişi.`,
  married: (a, b) => `${a} ile ${b} evlilik yoluyla akraba.`,
  connected: (a, b) => `${a} ile ${b} evlilikler üzerinden birbirine bağlı.`,
  none: (a, b) => `${a} ile ${b} arasında kayıtlı bir bağ yok.`,
  common: (names) => `Ortak atalar: ${joinNames(names, 've')}`,
  and: '; ',
};

function joinNames(list: string[], and: string): string {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ` ${and} ` + list[list.length - 1];
}

/** Was ist A für B? */
export function describeKinship(data: FamilyData, a: string, b: string, lang: KinshipLang = 'de'): KinshipResult {
  const v = lang === 'tr' ? TR : DE;
  const g = buildGraph(data);
  const A = g.byId.get(a);
  const B = g.byId.get(b);
  if (!A || !B) return { sentence: v.select };
  const nameA = fullName(A);
  const nameB = fullName(B);
  if (a === b) return { sentence: v.same(nameA, nameB) };

  const say = (term: string, detail?: string): KinshipResult => ({ sentence: v.is(A, term, B) + '.', detail });

  // 1. Blutsverwandtschaft
  const rel = bloodRelation(g, a, b);
  if (rel) {
    const term = v.blood(bloodContext(g, a, b, rel));
    const detail =
      rel.up > 0 && rel.down > 0 ? v.common(rel.common.map((id) => fullName(g.byId.get(id)!))) : undefined;
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
  if (partnersOf(a).includes(b)) return say(v.partner(A));

  // 3. Bekannte Schwieger- und Stiefbeziehungen
  if (partnersOf(b).some((p) => parentsOf(p).includes(a))) return say(v.parentInLaw(A));
  if (childrenOf(b).some((c) => partnersOf(c).includes(a))) return say(v.childInLaw(A));
  if (siblingsOf(b).some((s) => partnersOf(s).includes(a))) return say(v.partnerOfSibling(A));
  const partnerWithSibling = partnersOf(b).find((p) => siblingsOf(p).includes(a));
  if (partnerWithSibling) return say(v.siblingOfPartner(A, g.byId.get(partnerWithSibling)!));
  if (parentsOf(b).some((p) => partnersOf(p).includes(a))) return say(v.stepParent(A));
  if (parentsOf(a).some((p) => partnersOf(p).includes(b))) return say(v.stepChild(A));

  // 4. Angeheiratet über eine Partnerschaft
  for (const p of partnersOf(a)) {
    const r = bloodRelation(g, p, b);
    if (r) {
      const P = g.byId.get(p)!;
      const pTerm = v.blood(bloodContext(g, p, b, r));
      // Im Türkischen heißt der Partner von Onkel/Tante "Enişte" bzw. "Yenge".
      if (lang === 'tr' && r.up === 1 && r.down === 2 && A.gender !== 'd')
        return say(A.gender === 'm' ? 'Enişte' : 'Yenge', v.is(A, v.partner(A), P) + v.and + v.is(P, pTerm, B) + '.');
      return {
        sentence: v.married(nameA, nameB),
        detail: v.is(A, v.partner(A), P) + v.and + v.is(P, pTerm, B) + '.',
      };
    }
  }
  for (const p of partnersOf(b)) {
    const r = bloodRelation(g, a, p);
    if (r) {
      const P = g.byId.get(p)!;
      return {
        sentence: v.married(nameA, nameB),
        detail: v.is(A, v.blood(bloodContext(g, a, p, r)), P) + v.and + v.is(P, v.partner(P), B) + '.',
      };
    }
  }

  // 5. Irgendeine Verbindung über mehrere Ehen/Partnerschaften
  const path = shortestPath(g, a, b);
  if (path) {
    const steps: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const x = g.byId.get(path[i])!;
      const y = g.byId.get(path[i + 1])!;
      const term = parentsOf(y.id).includes(x.id)
        ? v.parentWord(x)
        : childrenOf(y.id).includes(x.id)
          ? v.childWord(x)
          : v.partner(x);
      steps.push(v.is(x, term, y));
    }
    return { sentence: v.connected(nameA, nameB), detail: steps.join('; ') + '.' };
  }

  return { sentence: v.none(nameA, nameB) };
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
