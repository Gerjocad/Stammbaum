import { describe, expect, it } from 'vitest';
import { sampleFamily } from './fixtures';
import { CARD_W, computeLayout } from './layout';

describe('computeLayout', () => {
  const layout = computeLayout(sampleFamily());
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const cx = (id: string) => pos.get(id)!.x + CARD_W / 2;

  it('lässt keine Karten überlappen', () => {
    for (const a of layout.nodes)
      for (const b of layout.nodes)
        if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(CARD_W);
  });

  it('stellt Eltern mittig über ihre Kinder', () => {
    const parents = (cx('Mehmet') + cx('Fatma')) / 2;
    const kids = ['Ali', 'Ayse', 'Hasan'].map(cx);
    expect(parents).toBeGreaterThan(Math.min(...kids));
    expect(parents).toBeLessThan(Math.max(...kids));
    expect(pos.get('Mehmet')!.y).toBeLessThan(pos.get('Ali')!.y);
  });

  it('stellt Partner nebeneinander und Kinder unter die Eltern', () => {
    expect(pos.get('Ali')!.y).toBe(pos.get('Zeynep')!.y);
    expect(Math.abs(cx('Ali') - cx('Zeynep'))).toBeLessThan(CARD_W * 1.5);
    const parents = (cx('Ali') + cx('Zeynep')) / 2;
    expect(Math.abs((cx('Cemre') + cx('Emre')) / 2 - parents)).toBeLessThan(CARD_W);
  });

  it('legt sich überlappende Querlinien auf verschiedene Höhen', () => {
    const buses = layout.lines
      .filter((l) => l.kind === 'child')
      .map((l) => {
        const m = /M [\d.-]+ [\d.-]+ V ([\d.-]+) M ([\d.-]+) [\d.-]+ H ([\d.-]+)/.exec(l.d)!;
        return { y: +m[1], from: +m[2], to: +m[3] };
      });
    for (const a of buses)
      for (const b of buses)
        if (a !== b && a.y === b.y) expect(a.to < b.from || b.to < a.from).toBe(true);
  });
});
