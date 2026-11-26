export type Criterion = { k: string; n: string; w: number; h: string };
export type ColorOption = { k: string; n: string; c: string };

export type CategoryConfig = {
  key: string;
  label: string;
  producerLabel: string;
  criteria: Criterion[];
  colors: ColorOption[];
  styles: string[];
  /** Listes d'attributs libres stockés dans `tastings.attributes` */
  attributes: Record<string, { label: string; options: string[]; multi: boolean }>;
  volumes: number[];
};

/** Note sur 100 : somme des critères (0 à 10) pondérés */
export function computeScore(cat: CategoryConfig, scores: Record<string, number>): number {
  return Math.round(cat.criteria.reduce((s, c) => s + (Number(scores[c.k]) || 0) / 10 * c.w, 0));
}
