import { buildGraph, type Graph } from './kinship';
import type { FamilyData } from './types';

export const CARD_W = 150;
export const CARD_H = 150;
const PARTNER_GAP = 30;
const UNIT_GAP = 50;
const ROW_GAP = 90;
const MARGIN = 40;

export interface NodePos {
  id: string;
  x: number; // linke Kante
  y: number; // obere Kante
}

export interface Line {
  d: string; // SVG-Pfad
  kind: 'partner' | 'child';
  dashed?: boolean;
}

export interface Layout {
  nodes: NodePos[];
  lines: Line[];
  width: number;
  height: number;
  /** Mitte der obersten Einheit des größten Teilbaums, dort startet die Ansicht. */
  focusX: number;
}

function byBirth(g: Graph) {
  return (a: string, b: string) =>
    (g.byId.get(a)!.birth_date ?? '9999').localeCompare(g.byId.get(b)!.birth_date ?? '9999');
}

/** Generation je Person: Kinder eine Zeile unter den Eltern, Partner in derselben Zeile. */
function generations(g: Graph): Map<string, number> {
  const ids = [...g.byId.keys()];
  const gen = new Map(ids.map((id) => [id, 0]));
  const limit = ids.length * 4 + 10; // schützt vor Zyklen in fehlerhaften Daten

  const pushDown = () => {
    for (let i = 0, changed = true; changed && i < limit; i++) {
      changed = false;
      for (const id of ids) {
        for (const c of g.children.get(id) ?? []) {
          if (gen.get(c)! < gen.get(id)! + 1) {
            gen.set(c, gen.get(id)! + 1);
            changed = true;
          }
        }
        for (const p of g.partners.get(id) ?? []) {
          if (gen.get(p)! < gen.get(id)!) {
            gen.set(p, gen.get(id)!);
            changed = true;
          }
        }
      }
    }
  };

  pushDown();
  // Personen ohne eingetragene Eltern (z. B. Schwiegereltern) direkt über ihre Kinder ziehen.
  for (let round = 0; round < 3; round++) {
    let moved = false;
    for (const id of ids) {
      if ((g.parents.get(id) ?? []).length) continue;
      const kids = g.children.get(id) ?? [];
      if (!kids.length) continue;
      const target = Math.min(...kids.map((k) => gen.get(k)!)) - 1;
      if (target > gen.get(id)!) {
        gen.set(id, target);
        moved = true;
      }
    }
    if (!moved) break;
    pushDown();
  }
  return gen;
}

/** Eine Einheit ist eine Person mit ihren Partner:innen, die nebeneinander stehen. */
interface Unit {
  members: string[];
  row: number;
}

/** Wie ein Teilbaum aussieht: Mitte jeder Einheit und belegte Breite je Zeile (relativ). */
interface Shape {
  center: Map<number, number>;
  contour: Map<number, [number, number]>;
}

const unitWidth = (u: Unit) => u.members.length * CARD_W + (u.members.length - 1) * PARTNER_GAP;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Fasst Partner:innen zu Einheiten zusammen, als Kette nebeneinander (z. B. Ex – Person – Partnerin). */
function buildUnits(g: Graph, gen: Map<string, number>): { units: Unit[]; unitOf: Map<string, number> } {
  const units: Unit[] = [];
  const unitOf = new Map<string, number>();
  const ids = [...g.byId.keys()].sort(byBirth(g));
  const hasParents = (id: string) => (g.parents.get(id) ?? []).length > 0;
  for (const id of ids) {
    if (unitOf.has(id)) continue;
    const comp: string[] = [id];
    const inComp = new Set(comp);
    for (let i = 0; i < comp.length; i++) {
      for (const p of g.partners.get(comp[i]) ?? []) {
        if (!inComp.has(p) && gen.get(p) === gen.get(id)) {
          inComp.add(p);
          comp.push(p);
        }
      }
    }
    const partnersIn = (m: string) => (g.partners.get(m) ?? []).filter((p) => inComp.has(p));
    let members: string[];
    if (comp.length === 2) {
      // Wer Eltern im Baum hat, steht links; angeheiratete Personen außen rechts.
      members = hasParents(comp[1]) && !hasParents(comp[0]) ? [comp[1], comp[0]] : comp;
    } else {
      // Als Kette anordnen, beginnend bei einem Ende.
      const start = [...comp].sort((a, b) => partnersIn(a).length - partnersIn(b).length)[0];
      members = [start];
      const used = new Set(members);
      for (let cur = start; ; ) {
        const next = partnersIn(cur).find((p) => !used.has(p));
        if (!next) break;
        members.push(next);
        used.add(next);
        cur = next;
      }
      for (const m of comp) if (!used.has(m)) members.push(m);
    }
    members.forEach((m) => unitOf.set(m, units.length));
    units.push({ members, row: gen.get(id)! });
  }
  return { units, unitOf };
}

/**
 * Ordnet den Baum von oben nach unten an: Jede Einheit steht mittig über ihren Kindern,
 * die sich darunter aufteilen. Angeheiratete Familien werden möglichst nah daneben platziert.
 */
export function computeLayout(data: FamilyData): Layout {
  const g = buildGraph(data);
  if (!g.byId.size) return { nodes: [], lines: [], width: 0, height: 0, focusX: 0 };
  const gen = generations(g);
  const { units, unitOf } = buildUnits(g, gen);
  const sort = byBirth(g);

  const childUnits = (u: number) => {
    const out = new Set<number>();
    for (const m of units[u].members)
      for (const c of g.children.get(m) ?? []) if (units[unitOf.get(c)!].row > units[u].row) out.add(unitOf.get(c)!);
    return [...out];
  };
  const parentUnits = (u: number) => {
    const out = new Set<number>();
    for (const m of units[u].members)
      for (const p of g.parents.get(m) ?? []) if (units[unitOf.get(p)!].row < units[u].row) out.add(unitOf.get(p)!);
    return [...out];
  };

  /** Kinder links, deren Eltern links in der Einheit stehen; sonst nach Geburtsdatum. */
  const orderedChildUnits = (u: number) => {
    const members = units[u].members;
    const info = childUnits(u).map((c) => {
      const kids = units[c].members.filter((m) => (g.parents.get(m) ?? []).some((p) => members.includes(p)));
      const side = mean(kids.flatMap((k) => (g.parents.get(k) ?? []).map((p) => members.indexOf(p)).filter((i) => i >= 0)));
      return { c, side, kid: [...kids].sort(sort)[0] };
    });
    info.sort((a, b) => a.side - b.side || sort(a.kid, b.kid));
    return info.map((i) => i.c);
  };

  // Jede Einheit hängt genau unter einer Eltern-Einheit (der zuerst gefundenen).
  const reach = (u: number, seen = new Set<number>()): number => {
    if (seen.has(u)) return 0;
    seen.add(u);
    return units[u].members.length + childUnits(u).reduce((s, c) => s + reach(c, seen), 0);
  };
  const size = units.map((_, u) => reach(u));
  const primaryKids = new Map<number, number[]>();
  const claimed = new Set<number>();
  const roots: number[] = [];
  const claim = (u: number) => {
    const kids = orderedChildUnits(u).filter((c) => !claimed.has(c));
    kids.forEach((c) => claimed.add(c));
    primaryKids.set(u, kids);
    kids.forEach(claim);
  };
  const byRootOrder = [...units.keys()].sort((a, b) => units[a].row - units[b].row || size[b] - size[a]);
  for (const u of [...byRootOrder.filter((u) => !parentUnits(u).length), ...byRootOrder]) {
    if (claimed.has(u)) continue;
    claimed.add(u);
    roots.push(u);
    claim(u);
  }

  const layoutUnit = (u: number): Shape => {
    const half = unitWidth(units[u]) / 2;
    let acc: Shape | null = null;
    for (const c of primaryKids.get(u)!) {
      const s = layoutUnit(c);
      if (!acc) {
        acc = s;
        continue;
      }
      let shift = -Infinity;
      for (const [row, [l]] of s.contour) {
        const a = acc.contour.get(row);
        if (a) shift = Math.max(shift, a[1] + UNIT_GAP - l);
      }
      if (shift === -Infinity) shift = 0;
      for (const [k, x] of s.center) acc.center.set(k, x + shift);
      for (const [row, [l, r]] of s.contour) {
        const a = acc.contour.get(row);
        acc.contour.set(row, a ? [Math.min(a[0], l + shift), Math.max(a[1], r + shift)] : [l + shift, r + shift]);
      }
    }
    if (!acc) return { center: new Map([[u, 0]]), contour: new Map([[units[u].row, [-half, half]]]) };
    const kidXs = primaryKids.get(u)!.map((c) => acc!.center.get(c)!);
    const mid = (Math.min(...kidXs) + Math.max(...kidXs)) / 2;
    const out: Shape = { center: new Map([[u, 0]]), contour: new Map([[units[u].row, [-half, half]]]) };
    for (const [k, x] of acc.center) out.center.set(k, x - mid);
    for (const [row, [l, r]] of acc.contour) out.contour.set(row, [l - mid, r - mid]);
    return out;
  };

  // Teilbäume nacheinander einsetzen, jeweils so nah wie möglich an ihrer Wunschposition.
  const unitX = new Map<number, number>();
  const occupied = new Map<number, [number, number][]>();
  const fits = (s: Shape, shift: number) => {
    for (const [row, [l, r]] of s.contour)
      for (const [a, b] of occupied.get(row) ?? []) if (l + shift < b + UNIT_GAP && r + shift > a - UNIT_GAP) return false;
    return true;
  };
  const place = (s: Shape, desired: number) => {
    const candidates = [desired];
    for (const [row, [l, r]] of s.contour)
      for (const [a, b] of occupied.get(row) ?? []) candidates.push(b + UNIT_GAP - l, a - UNIT_GAP - r);
    const best = candidates.filter((c) => fits(s, c)).sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))[0];
    for (const [k, x] of s.center) unitX.set(k, x + best);
    for (const [row, [l, r]] of s.contour) (occupied.get(row) ?? occupied.set(row, []).get(row)!).push([l + best, r + best]);
  };
  const personX = (id: string) => {
    const u = unitOf.get(id)!;
    const i = units[u].members.indexOf(id);
    return unitX.get(u)! - unitWidth(units[u]) / 2 + i * (CARD_W + PARTNER_GAP) + CARD_W / 2;
  };
  /** Wunsch-Verschiebung eines Teilbaums: Eltern über bereits platzierte Kinder und umgekehrt. */
  const desiredShift = (s: Shape): number | null => {
    const wants: number[] = [];
    for (const [u, rel] of s.center) {
      const members = units[u].members;
      const offset = (id: string) => rel - unitWidth(units[u]) / 2 + members.indexOf(id) * (CARD_W + PARTNER_GAP) + CARD_W / 2;
      for (const m of members) {
        for (const c of g.children.get(m) ?? []) if (unitX.has(unitOf.get(c)!)) wants.push(personX(c) - offset(m));
        for (const p of g.parents.get(m) ?? []) if (unitX.has(unitOf.get(p)!)) wants.push(personX(p) - offset(m));
      }
    }
    return wants.length ? mean(wants) : null;
  };

  let mainRoot = roots[0];
  const arrange = () => {
    unitX.clear();
    occupied.clear();
    const shapes = new Map(roots.map((r) => [r, layoutUnit(r)]));
    const treeSize = (r: number) => [...shapes.get(r)!.center.keys()].reduce((s, u) => s + units[u].members.length, 0);
    const pending = [...roots].sort((a, b) => treeSize(b) - treeSize(a));
    mainRoot = pending[0];
    while (pending.length) {
      let pick = pending.findIndex((r) => desiredShift(shapes.get(r)!) !== null);
      if (pick < 0) pick = 0;
      const [r] = pending.splice(pick, 1);
      const s = shapes.get(r)!;
      let desired = desiredShift(s);
      if (desired === null) {
        const right = Math.max(0, ...[...occupied.values()].flat().map(([, b]) => b));
        const left = Math.min(...[...s.contour.values()].map(([l]) => l));
        desired = occupied.size ? right + UNIT_GAP - left : 0;
      }
      place(s, desired);
    }
  };
  arrange();
  // Angeheiratete Personen auf die Seite stellen, auf der ihre eigenen Eltern stehen, damit sich
  // die Linien nicht kreuzen. Danach neu anordnen.
  let swapped = false;
  for (const u of units.keys()) {
    const members = units[u].members;
    if (members.length !== 2) continue;
    const primaryParent = [...primaryKids].find(([, kids]) => kids.includes(u))?.[0];
    for (const [i, m] of members.entries()) {
      const own = (g.parents.get(m) ?? []).filter((p) => unitOf.get(p) !== primaryParent);
      if (!own.length || own.length !== (g.parents.get(m) ?? []).length) continue;
      const parentX = mean(own.map(personX));
      const wantLeft = parentX < unitX.get(u)!;
      if (wantLeft !== (i === 0)) {
        members.reverse();
        swapped = true;
      }
      break;
    }
  }
  if (swapped) arrange();

  // Zeilen ohne Lücken durchnummerieren.
  const rowIndex = new Map([...new Set(units.map((u) => u.row))].sort((a, b) => a - b).map((r, i) => [r, i]));
  const minX = Math.min(...[...g.byId.keys()].map(personX)) - CARD_W / 2;
  const shift = MARGIN - minX;
  const top = (r: number) => MARGIN + r * (CARD_H + ROW_GAP);
  const nodes: NodePos[] = [...g.byId.keys()].map((id) => ({
    id,
    x: personX(id) + shift - CARD_W / 2,
    y: top(rowIndex.get(units[unitOf.get(id)!].row)!),
  }));
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const cx = (id: string) => pos.get(id)!.x + CARD_W / 2;
  const isPartner = (a: string, b: string) => (g.partners.get(a) ?? []).includes(b);
  const adjacent = (a: string, b: string) =>
    pos.get(a)!.y === pos.get(b)!.y && Math.abs(cx(a) - cx(b)) <= CARD_W + PARTNER_GAP + 1;

  const lines: Line[] = [];

  // Partnerlinien
  const seen = new Set<string>();
  for (const [a, list] of g.partners) {
    for (const b of list) {
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const [l, r] = cx(a) < cx(b) ? [a, b] : [b, a];
      const y = pos.get(l)!.y + CARD_H / 2;
      if (adjacent(l, r)) {
        lines.push({ kind: 'partner', d: `M ${cx(l) + CARD_W / 2} ${y} H ${cx(r) - CARD_W / 2}` });
      } else {
        const y1 = pos.get(l)!.y;
        const y2 = pos.get(r)!.y;
        const lift = Math.min(y1, y2) - 25;
        lines.push({
          kind: 'partner',
          dashed: true,
          d: `M ${cx(l)} ${y1} C ${cx(l)} ${lift}, ${cx(r)} ${lift}, ${cx(r)} ${y2}`,
        });
      }
    }
  }

  // Eltern-Kind-Linien, gebündelt je Elternpaar
  const families = new Map<string, string[]>();
  for (const id of g.byId.keys()) {
    const parents = g.parents.get(id) ?? [];
    if (!parents.length) continue;
    const key = [...parents].sort().join('|');
    (families.get(key) ?? families.set(key, []).get(key)!).push(id);
  }
  const buses = [...families].map(([key, kids]) => {
    const parents = key.split('|');
    const sx = mean(parents.map(cx));
    const pairOnLine = parents.length === 2 && isPartner(parents[0], parents[1]) && adjacent(parents[0], parents[1]);
    const sy = pairOnLine
      ? pos.get(parents[0])!.y + CARD_H / 2
      : Math.max(...parents.map((p) => pos.get(p)!.y)) + CARD_H;
    const childTop = Math.min(...kids.map((k) => pos.get(k)!.y));
    const xs = [sx, ...kids.map(cx)];
    return { kids, sx, sy, childTop, from: Math.min(...xs), to: Math.max(...xs), level: 0, levels: 1 };
  });
  // Querlinien, die sich überlappen würden, auf verschiedene Höhen legen.
  const byGap = new Map<number, typeof buses>();
  for (const b of buses) (byGap.get(b.childTop) ?? byGap.set(b.childTop, []).get(b.childTop)!).push(b);
  for (const group of byGap.values()) {
    group.sort((a, b) => a.from - b.from);
    const ends: number[] = [];
    for (const b of group) {
      let lvl = ends.findIndex((end) => end + 12 < b.from);
      if (lvl < 0) lvl = ends.push(b.to) - 1;
      else ends[lvl] = b.to;
      b.level = lvl;
    }
    for (const b of group) b.levels = ends.length;
  }
  const step = Math.min(14, (ROW_GAP - 30) / 2);
  for (const b of buses) {
    const offset = (b.level - (b.levels - 1) / 2) * step;
    const busY = b.childTop - ROW_GAP / 2 + Math.max(-ROW_GAP / 2 + 12, Math.min(ROW_GAP / 2 - 12, offset));
    let d = `M ${b.sx} ${b.sy} V ${busY} M ${b.from} ${busY} H ${b.to}`;
    for (const k of b.kids) d += ` M ${cx(k)} ${busY} V ${pos.get(k)!.y}`;
    lines.push({ kind: 'child', d });
  }

  const width = Math.max(...nodes.map((n) => n.x)) + CARD_W + MARGIN;
  const height = Math.max(...nodes.map((n) => n.y)) + CARD_H + MARGIN;
  return { nodes, lines, width, height, focusX: unitX.get(mainRoot)! + shift };
}
