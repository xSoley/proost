import { useMemo } from "react";
import { Link } from "react-router-dom";
import { beer as cat } from "../categories/beer";
import { useStore } from "../lib/store";
import { beersOf, colorOf, litersOf, spentOf, strongestOf, topCount } from "../lib/aggregate";
import { fmt, num } from "../lib/utils";
import { Glass } from "../components/Glass";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";

export function Stats() {
  const { mine: T, loaded } = useStore();
  const beers = useMemo(() => beersOf(cat, T), [T]);
  if (!loaded) return <Loading text="Ouverture de la cave…" />;

  let html = <><h2>Mes stats</h2><p className="sub">Tes chiffres de dégustateur, depuis le début</p></>;
  if (!T.length) return <>{html}<EmptyState title="Pas encore de chiffres" text="Ils arrivent avec la première fiche." /></>;

  const avg = T.reduce((a, t) => a + t.score, 0) / T.length;
  const topStyle = topCount(T.map(t => t.style).filter(Boolean) as string[]);
  const topAroma = topCount(T.flatMap(t => t.attributes?.aromas || []));
  const strongest = strongestOf(T);
  const places = new Set(T.map(t => (t.place || "").trim().toLowerCase()).filter(Boolean)).size;
  const awards: [string, string, string][] = [];
  if (topStyle) awards.push(["🏷️", "Style favori", `${topStyle[0]} (${topStyle[1]} fois)`]);
  if (topAroma) awards.push(["👃", "Arôme le plus cité", `${topAroma[0]} (${topAroma[1]} fois)`]);
  if (strongest) awards.push(["🔥", "La plus costaude", `${strongest.item_name}, ${fmt(num(strongest.abv), 1)} %`]);
  if (places) awards.push(["📍", "Lieux visités", `${places} endroit${places > 1 ? "s" : ""}`]);
  const top = beers.slice().sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 10);

  html = <>
    {html}
    <div className="kpis">
      <div className="kpi"><b>{beers.length}</b><span>bières différentes</span></div>
      <div className="kpi"><b>{fmt(litersOf(T), 1)} L</b><span>bus au total</span></div>
      <div className="kpi"><b>{T.length}</b><span>dégustations</span></div>
      <div className="kpi"><b>{fmt(avg)}</b><span>ma note moyenne</span></div>
    </div>
    {awards.length > 0 && <div className="card" style={{ marginBottom: 22 }}>{awards.map(a =>
      <div key={a[1]} className="award"><span className="ic">{a[0]}</span><div><b>{a[1]}</b><span>{a[2]}</span></div></div>)}</div>}
    <h2 style={{ fontSize: 20, marginBottom: 10 }}>Mon top 10</h2>
    <div className="list">{top.map((b, i) => (
      <div key={b.key} className="card"><Link className="row" to={`/beer/${encodeURIComponent(b.key)}`}>
        <span className="pos">{i + 1}</span><Glass score={b.avg} color={colorOf(cat, b.color)} h={48} />
        <span className="body"><span className="title">{b.name}</span>
          <span className="meta" style={{ display: "block" }}>{[b.producer, b.style].filter(Boolean).join(", ") || " "}</span></span>
        <span className="score"><b>{fmt(b.avg)}</b><small>/100, {b.n} fois</small></span>
      </Link></div>))}</div>
    {spentOf(T) > 0 && <p className="sub" style={{ marginTop: 16 }}>{fmt(spentOf(T), 0)} € dépensés au comptoir, au total.</p>}
  </>;
  return html;
}
