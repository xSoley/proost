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

export type Person = { uid: string; name: string; list: Tasting[]; n: number; avg: number; fav: Tasting; spent: number };

/** Statistiques par dégustateur (écran Équipe du prototype) */
export function peopleOf(T: Tasting[], names: Record<string, string> = {}): Person[] {
  const m = new Map<string, Tasting[]>();
  for (const t of T) { if (!m.has(t.user_id)) m.set(t.user_id, []); m.get(t.user_id)!.push(t); }
  return [...m.entries()].map(([uid, list]) => ({
    uid, list, n: list.length,
    name: names[uid] || list.find(t => t.profiles?.display_name)?.profiles?.display_name || "Anonyme",
    avg: list.reduce((a, t) => a + t.score, 0) / list.length,
    fav: list.slice().sort((a, b) => b.score - a.score)[0],
    spent: list.reduce((a, t) => a + num(t.price), 0)
  }));
}

export type Award = { ic: string; title: string; text: string; t?: Tasting };

/** Palmarès du groupe (prototype + meilleur bar et meilleure affaire pour le récap) */
export function awardsOf(cat: CategoryConfig, T: Tasting[], P: Person[], extended = false): Award[] {
  const fmt0 = (n: number) => Math.round(n).toLocaleString("fr-FR");
  const fmt1 = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const awards: Award[] = [];
  if (P.length > 1) {
    const big = P.slice().sort((a, b) => b.n - a.n)[0];
    const kind = P.slice().sort((a, b) => b.avg - a.avg)[0];
    const harsh = P.slice().sort((a, b) => a.avg - b.avg)[0];
    awards.push({ ic: "🍺", title: "Le plus assoiffé", text: `${big.name} avec ${big.n} bières` });
    awards.push({ ic: "😇", title: "Le plus généreux", text: `${kind.name}, ${fmt0(kind.avg)}/100 en moyenne` });
    awards.push({ ic: "🧐", title: "Le juge le plus sévère", text: `${harsh.name}, ${fmt0(harsh.avg)}/100 en moyenne` });
  }
  const topStyle = topCount(T.map(t => t.style).filter(Boolean) as string[]);
  const topAroma = topCount(T.flatMap(t => t.attributes?.aromas || []));
  const strongest = strongestOf(T);
  if (topStyle) awards.push({ ic: "🏷️", title: "Style le plus goûté", text: `${topStyle[0]} (${topStyle[1]} fois)` });
  if (topAroma) awards.push({ ic: "👃", title: "Arôme le plus cité", text: `${topAroma[0]} (${topAroma[1]} fois)` });
  if (strongest) awards.push({ ic: "🔥", title: "La plus costaude", text: `${strongest.item_name}, ${fmt1(num(strongest.abv))} %`, t: strongest });
  if (extended) {
    const bar = barsOf(T)[0];
    if (bar) awards.push({ ic: "📍", title: "Le meilleur bar", text: `${bar.name}${bar.amb ? `, ${fmt1(bar.amb)}★` : ""}` });
    const deal = beersOf(cat, T).filter(b => b.value != null).sort((a, b) => b.value! - a.value!)[0];
    if (deal) awards.push({ ic: "💶", title: "La meilleure affaire", text: `${deal.name}, ${fmt1(deal.value!)} pts par €` });
  }
  return awards;
}
