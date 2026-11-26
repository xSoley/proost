import type { CategoryConfig } from "../categories/types";

/** Barres des critères, comme dans le prototype */
export function CritBars({ cat, crit }: { cat: CategoryConfig; crit: Record<string, number> }) {
  return (
    <div className="bars">{cat.criteria.map(c =>
      <div key={c.k}>{c.n.replace("Impression générale", "Général")}<i><span style={{ width: `${Math.round((crit[c.k] || 0) * 10)}%` }} /></i></div>
    )}</div>
  );
}
