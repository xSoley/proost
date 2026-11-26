import { useState } from "react";
import type { Tasting } from "../lib/types";
import { fmtDate } from "../lib/utils";

/** Évolution de ma note sur une bière (une seule série, survol = détail) */
export function ScoreTrend({ list }: { list: Tasting[] }) {
  const pts = list.slice().sort((a, b) => a.tasted_at.localeCompare(b.tasted_at));
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return null;
  const W = 320, H = 120, L = 30, R = 14, T = 14, B = 22;
  const scores = pts.map(t => t.score);
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 10) / 10) * 10);
  const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (s: number) => T + (1 - (s - lo) / (hi - lo || 1)) * (H - T - B);
  const d = pts.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(t.score).toFixed(1)}`).join(" ");
  const last = pts.length - 1;
  const h = hover ?? last;
  return (
    <figure className="trend">
      <figcaption className="trend-cap">
        <b>{pts[h].score}</b><span>/100 · {fmtDate(pts[h].tasted_at, { day: "numeric", month: "short", year: "numeric" })}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution de ma note : ${pts.map(t => t.score).join(", ")}`}
        onMouseLeave={() => setHover(null)}>
        {[lo, hi].map(v => <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text>
        </g>)}
        <text x={L} y={H - 4} fontSize="11" fill="var(--muted)">{fmtDate(pts[0].tasted_at, { month: "short", year: "2-digit" })}</text>
        <text x={W - R} y={H - 4} fontSize="11" fill="var(--muted)" textAnchor="end">{fmtDate(pts[last].tasted_at, { month: "short", year: "2-digit" })}</text>
        <path d={d} fill="none" stroke="var(--hop)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((t, i) => <g key={t.id}>
          <circle cx={x(i)} cy={y(t.score)} r={i === h ? 5 : 4} fill={i === h ? "var(--hop)" : "var(--surface)"} stroke="var(--hop)" strokeWidth="2" />
          <circle cx={x(i)} cy={y(t.score)} r="16" fill="transparent" style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        </g>)}
      </svg>
    </figure>
  );
}
