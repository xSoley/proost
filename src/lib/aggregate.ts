// Agrégations reprises du prototype (classement, qualité/prix, bars, stats)
import type { Tasting } from "./types";
import type { CategoryConfig } from "../categories/types";
import { norm, num } from "./utils";

export const ts = (t: Tasting) => new Date(t.tasted_at).getTime();
export const p33Of = (t: Tasting) =>
  (num(t.price) > 0 && num(t.volume_cl) > 0) ? num(t.price) * 33 / num(t.volume_cl) : null;
export const colorOf = (cat: CategoryConfig, k: string | null | undefined) =>
  (cat.colors.find(c => c.k === k) || cat.colors[1]).c;

export type BeerAgg = {
  key: string; name: string; producer: string; style: string; color: string | null;
  list: Tasting[]; avg: number; n: number; p33: number | null; value: number | null;
  again: number; crit: Record<string, number>; abv: number | null;
  last: Tasting; lastPhoto: Tasting | null;
};

export function beersOf(cat: CategoryConfig, tastings: Tasting[]): BeerAgg[] {
  const m = new Map<string, { key: string; name: string; producer: string; style: string; color: string | null; list: Tasting[] }>();
  for (const t of tastings) {
    const k = t.item_key || norm(t.item_name); if (!k) continue;
    if (!m.has(k)) m.set(k, { key: k, name: t.item_name, producer: "", style: "", color: t.color, list: [] });
    const g = m.get(k)!; g.list.push(t);
    if (!g.producer && t.producer) g.producer = t.producer;
    if (!g.style && t.style) g.style = t.style;
  }
  return [...m.values()].map(g => {
    g.list.sort((a, b) => ts(b) - ts(a));
    const avg = g.list.reduce((a, t) => a + t.score, 0) / g.list.length;
    const prices = g.list.map(p33Of).filter((v): v is number => v != null);
    const p33 = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
    const crit: Record<string, number> = {};
    for (const c of cat.criteria) crit[c.k] = g.list.reduce((a, t) => a + num(t.scores?.[c.k]), 0) / g.list.length;
    const abv = g.list.map(t => num(t.abv)).filter(Boolean)[0] || null;
    return {
      ...g, avg, n: g.list.length, p33, value: p33 ? avg / p33 : null,
      again: g.list.filter(t => t.again).length, crit, abv,
      last: g.list[0], lastPhoto: g.list.find(t => t.photo_path || t._pending?.thumb) || null,
      color: g.list[0].color
    };
  });
}

export function barsOf(tastings: Tasting[]) {
  const m = new Map<string, { name: string; list: Tasting[] }>();
  for (const t of tastings) {
    const k = norm(t.place); if (!k) continue;
    if (!m.has(k)) m.set(k, { name: t.place!, list: [] });
    m.get(k)!.list.push(t);
  }
  return [...m.values()].map(b => {
    const rated = b.list.filter(t => num(t.ambiance) > 0);
    const amb = rated.length ? rated.reduce((a, t) => a + num(t.ambiance), 0) / rated.length : 0;
    const avg = b.list.reduce((a, t) => a + t.score, 0) / b.list.length;
    const prices = b.list.map(p33Of).filter((v): v is number => v != null);
    const p33 = prices.length ? prices.reduce((a, v) => a + v, 0) / prices.length : null;
    const best = b.list.slice().sort((x, y) => y.score - x.score)[0];
    return { ...b, amb, avg, p33, best, n: b.list.length, combo: amb * 12 + avg * 0.4 };
  }).sort((a, b) => b.combo - a.combo);
}

/** Élément le plus fréquent : [valeur, nombre] */
export function topCount(arr: string[]): [string, number] | undefined {
  const m: Record<string, number> = {};
  arr.forEach(x => { m[x] = (m[x] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1])[0];
}

export const litersOf = (T: Tasting[]) => T.reduce((a, t) => a + num(t.volume_cl), 0) / 100;
export const spentOf = (T: Tasting[]) => T.reduce((a, t) => a + num(t.price), 0);
export const strongestOf = (T: Tasting[]) => T.filter(t => num(t.abv) > 0).sort((a, b) => num(b.abv) - num(a.abv))[0];
