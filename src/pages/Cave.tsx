import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { beer as cat } from "../categories/beer";
import { useStore } from "../lib/store";
import { beersOf, colorOf, type BeerAgg } from "../lib/aggregate";
import { fmt, fmtDate, norm } from "../lib/utils";
import { Glass } from "../components/Glass";
import { Photo } from "../components/Photo";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";

type Sort = "note" | "recent" | "value" | "pop";
const LABELS: Record<Sort, string> = { note: "Meilleure note", recent: "Plus récentes", value: "Qualité/prix", pop: "Les plus bues" };
const SORTERS: Record<Sort, (a: BeerAgg, b: BeerAgg) => number> = {
  note: (a, b) => b.avg - a.avg || b.n - a.n,
  recent: (a, b) => b.last.tasted_at.localeCompare(a.last.tasted_at),
  value: (a, b) => (b.value ?? -1) - (a.value ?? -1),
  pop: (a, b) => b.n - a.n || b.avg - a.avg
};

const pref = { get: (k: string, d: string) => { try { return sessionStorage.getItem(k) || d; } catch { return d; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* */ } } };

function BeerRow({ b, sort }: { b: BeerAgg; sort: Sort }) {
  const val = sort === "value" ? (b.value != null ? fmt(b.value, 1) : "–") : fmt(b.avg);
  const unit = sort === "value" ? "pts par €" : "/100";
  return (
    <div className="card">
      <Link className="row" to={`/beer/${encodeURIComponent(b.key)}`}>
        <Glass score={b.avg} color={colorOf(cat, b.color)} h={48} />
        <span className="body">
          <span className="title">{b.name}</span>
          <span className="meta" style={{ display: "block" }}>
            {b.n} dégustation{b.n > 1 ? "s" : ""}, dernière le {fmtDate(b.last.tasted_at, { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {(b.producer || b.style) && <span className="meta" style={{ display: "block" }}>{[b.producer, b.style].filter(Boolean).join(", ")}</span>}
        </span>
        {b.lastPhoto && <Photo t={b.lastPhoto} thumb className="thumb" />}
        <span className="score"><b>{val}</b><small>{unit}</small></span>
      </Link>
    </div>
  );
}

export function Cave() {
  const { mine, loaded } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSortState] = useState<Sort>(() => pref.get("cave-sort", "note") as Sort);
  const [style, setStyle] = useState("");
  const [color, setColor] = useState("");
  const [again, setAgain] = useState(false);
  const setSort = (s: Sort) => { setSortState(s); pref.set("cave-sort", s); };

  const beers = useMemo(() => beersOf(cat, mine), [mine]);
  const styles = useMemo(() => cat.styles.filter(s => beers.some(b => b.style === s)), [beers]);
  const colors = useMemo(() => cat.colors.filter(c => beers.some(b => b.color === c.k)), [beers]);

  const nq = norm(q);
  const hits = useMemo(() => nq
    ? beers.filter(b => norm(b.name).includes(nq) || norm(b.producer).includes(nq)).sort((a, b) => b.avg - a.avg)
    : [], [beers, nq]);

  const list = useMemo(() => beers
    .filter(b => !style || b.style === style)
    .filter(b => !color || b.color === color)
    .filter(b => !again || b.again > 0)
    .sort(SORTERS[sort]), [beers, style, color, again, sort]);

  if (!loaded) return <Loading text="Ouverture de la cave…" />;

  return (
    <>
      <div className="search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
        <input className="in" type="search" placeholder="Tu l’as déjà goûtée ?" aria-label="Chercher une bière dans ma cave" value={q} onChange={e => setQ(e.target.value)} enterKeyHint="search" />
      </div>

      {nq ? (
        hits.length ? (
          <>
            <p className="sub">Oui ! {hits.length > 1 ? `${hits.length} bières correspondent` : "Tu l’as déjà goûtée"}</p>
            <div className="list">{hits.map(b => (
              <Link key={b.key} className="card hit" to={`/beer/${encodeURIComponent(b.key)}`}>
                {b.lastPhoto && <Photo t={b.lastPhoto} className="hit-photo" alt={`Photo de ${b.name}`} />}
                <div className="row">
                  <Glass score={b.avg} color={colorOf(cat, b.color)} h={56} />
                  <span className="body">
                    <span className="title">{b.name}</span>
                    <span className="meta" style={{ display: "block" }}>{b.n} fois, la dernière le {fmtDate(b.last.tasted_at, { day: "numeric", month: "long", year: "numeric" })}{b.last.place ? `, ${b.last.place}` : ""}</span>
                    {b.again > 0 && <span className="meta" style={{ display: "block" }}>Tu en reprendrais</span>}
                  </span>
                  <span className="score"><b>{fmt(b.avg)}</b><small>/100</small></span>
                </div>
                {b.list.find(t => t.comment) && <p className="hit-memo">« {b.list.find(t => t.comment)!.comment} »</p>}
              </Link>
            ))}</div>
          </>
        ) : (
          <EmptyState title="Jamais goûtée… pour l’instant" text={`« ${q.trim()} » n’est pas encore dans ta cave.`}
            cta="La noter maintenant" to={`/new?name=${encodeURIComponent(q.trim())}`} />
        )
      ) : (
        <>
          <h2>Ma cave</h2>
          {!beers.length ? (
            <EmptyState title="Ta cave est vide" text="Chaque bière goûtée mérite sa fiche. La première gorgée ouvre ta cave." />
          ) : (
            <>
              <p className="sub">{beers.length} bière{beers.length > 1 ? "s" : ""}, {mine.length} dégustation{mine.length > 1 ? "s" : ""}</p>
              <div className="seg" role="group" aria-label="Trier">{(Object.keys(LABELS) as Sort[]).map(k =>
                <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{LABELS[k]}</button>)}</div>
              <div className="filters">
                <div className="chips scroll" role="group" aria-label="Filtrer">
                  <button className="chip" aria-pressed={again} onClick={() => setAgain(!again)}>J’en reprendrais</button>
                  {styles.length > 1 && styles.map(s => <button key={s} className="chip" aria-pressed={style === s} onClick={() => setStyle(style === s ? "" : s)}>{s}</button>)}
                </div>
                {colors.length > 1 && <div className="chips scroll" role="group" aria-label="Couleur">{colors.map(c =>
                  <button key={c.k} className="chip color" aria-pressed={color === c.k} onClick={() => setColor(color === c.k ? "" : c.k)}>
                    <i style={{ background: c.c }} />{c.n}</button>)}</div>}
              </div>
              {list.length
                ? <div className="list">{list.map(b => <BeerRow key={b.key} b={b} sort={sort} />)}</div>
                : <div className="empty"><b>Aucune bière avec ces filtres</b>
                  <button className="ghost" onClick={() => { setStyle(""); setColor(""); setAgain(false); }}>Tout afficher</button></div>}
            </>
          )}
        </>
      )}
      {nq && hits.length === 1 && <div style={{ marginTop: 14 }}><button className="btn wide secondary" onClick={() => navigate(`/new?name=${encodeURIComponent(hits[0].name)}`)}>La regoûter</button></div>}
    </>
  );
}
