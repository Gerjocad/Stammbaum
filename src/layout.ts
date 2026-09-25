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

/** Reihenfolge der Personen je Zeile: Tiefensuche, damit Geschwister und Partner nebeneinander stehen. */
function rowOrder(g: Graph, gen: Map<string, number>): string[][] {
  const rows: string[][] = [];
  const placed = new Set<string>();
  const sort = byBirth(g);
  const place = (id: string) => {
    placed.add(id);
    (rows[gen.get(id)!] ??= []).push(id);
  };

  const visit = (id: string) => {
    if (placed.has(id)) return;
    place(id);
    const partners = (g.partners.get(id) ?? []).filter((p) => !placed.has(p) && gen.get(p) === gen.get(id));
    for (const p of partners) place(p);
    // Eltern der Partner (angeheiratete Linie) mitnehmen.
    for (const p of partners) for (const pp of g.parents.get(p) ?? []) visit(pp);
    const kids = new Set<string>();
    for (const parent of [id, ...partners]) for (const c of g.children.get(parent) ?? []) kids.add(c);
    for (const c of [...kids].sort(sort)) visit(c);
  };

  const starts = [...g.byId.keys()].sort((a, b) => gen.get(a)! - gen.get(b)! || sort(a, b));
  for (const id of starts) {
    // Mit den obersten Vorfahren beginnen, damit ganze Linien zusammenhängen.
    let top = id;
    for (let i = 0; i < 50 && (g.parents.get(top) ?? []).some((p) => !placed.has(p)); i++) {
      top = (g.parents.get(top) ?? []).find((p) => !placed.has(p))!;
    }
    visit(top);
    visit(id);
  }
  return rows.filter(Boolean);
}

export function computeLayout(data: FamilyData): Layout {
  const g = buildGraph(data);
  if (!g.byId.size) return { nodes: [], lines: [], width: 0, height: 0 };
  const gen = generations(g);
  const rows = rowOrder(g, gen);
  const rowOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((id) => rowOf.set(id, r)));

  const center = new Map<string, number>();
  const isPartner = (a: string, b: string) => (g.partners.get(a) ?? []).includes(b);

  // Einheiten = nebeneinanderstehende Paare (bzw. Einzelpersonen).
  const units: string[][][] = rows.map((row) => {
    const out: string[][] = [];
    for (const id of row) {
      const last = out[out.length - 1];
      if (last && last.some((m) => isPartner(m, id))) last.push(id);
      else out.push([id]);
    }
    return out;
  });
  const unitWidth = (u: string[]) => u.length * CARD_W + (u.length - 1) * PARTNER_GAP;

  const placeRow = (r: number, desired: (u: string[]) => number | null) => {
    let right = -Infinity;
    for (const u of units[r]) {
      const w = unitWidth(u);
      const want = desired(u);
      const current = center.has(u[0]) ? center.get(u[0])! - CARD_W / 2 : right === -Infinity ? 0 : right + UNIT_GAP;
      let left = want === null ? current : want - w / 2;
      left = Math.max(left, right + UNIT_GAP);
      u.forEach((id, i) => center.set(id, left + i * (CARD_W + PARTNER_GAP) + CARD_W / 2));
      right = left + w;
    }
  };

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const fromParents = (u: string[]) => {
    const xs = u.flatMap((id) => (g.parents.get(id) ?? []).map((p) => center.get(p)!).filter((x) => x !== undefined));
    return mean(xs);
  };
  const fromChildren = (u: string[]) => {
    const xs = u.flatMap((id) => (g.children.get(id) ?? []).map((c) => center.get(c)!).filter((x) => x !== undefined));
    return mean(xs);
  };

  for (let r = 0; r < rows.length; r++) placeRow(r, () => null);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = rows.length - 2; r >= 0; r--) placeRow(r, fromChildren);
    for (let r = 1; r < rows.length; r++) placeRow(r, fromParents);
  }
  // Oberste Paare noch über die Mitte ihrer Kinder rücken.
  const isRootUnit = (u: string[]) => u.every((id) => !(g.parents.get(id) ?? []).length);
  for (let r = rows.length - 2; r >= 0; r--) placeRow(r, (u) => (isRootUnit(u) ? fromChildren(u) : null));

  const minX = Math.min(...[...center.values()]) - CARD_W / 2;
  const shift = MARGIN - minX;
  const top = (r: number) => MARGIN + r * (CARD_H + ROW_GAP);
  const nodes: NodePos[] = [...g.byId.keys()].map((id) => ({
    id,
    x: center.get(id)! + shift - CARD_W / 2,
    y: top(rowOf.get(id)!),
  }));
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const cx = (id: string) => pos.get(id)!.x + CARD_W / 2;

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
      const adjacent = pos.get(l)!.y === pos.get(r)!.y && cx(r) - cx(l) <= CARD_W + PARTNER_GAP + 1;
      if (adjacent) {
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
  for (const [key, kids] of families) {
    const parents = key.split('|');
    const sx = mean(parents.map(cx))!;
    const pairOnLine =
      parents.length === 2 && isPartner(parents[0], parents[1]) && pos.get(parents[0])!.y === pos.get(parents[1])!.y;
    const sy = pairOnLine
      ? pos.get(parents[0])!.y + CARD_H / 2
      : Math.max(...parents.map((p) => pos.get(p)!.y)) + CARD_H;
    const childTop = Math.min(...kids.map((k) => pos.get(k)!.y));
    const busY = childTop - ROW_GAP / 2;
    const xs = [sx, ...kids.map(cx)];
    let d = `M ${sx} ${sy} V ${busY} M ${Math.min(...xs)} ${busY} H ${Math.max(...xs)}`;
    for (const k of kids) d += ` M ${cx(k)} ${busY} V ${pos.get(k)!.y}`;
    lines.push({ kind: 'child', d });
  }

  const width = Math.max(...nodes.map((n) => n.x)) + CARD_W + MARGIN;
  const height = top(rows.length - 1) + CARD_H + MARGIN;
  return { nodes, lines, width, height };
}
