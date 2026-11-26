// Écrans du prototype, filtrés sur les fiches d'un groupe
import { useMemo, useState } from "react";
import { beer as cat } from "../categories/beer";
import { awardsOf, barsOf, beersOf, colorOf, litersOf, peopleOf, spentOf, type BeerAgg } from "../lib/aggregate";
import type { Tasting } from "../lib/types";
import { useStore } from "../lib/store";
import { useToast } from "./Toast";
import { fmt, num } from "../lib/utils";
import { Glass } from "./Glass";
import { Entry } from "./Entry";
import { CritBars } from "./CritBars";
import { EmptyState } from "./EmptyState";
import { Avatar } from "./Avatar";

type Sort = "note" | "value" | "pop" | "again";
const SORTERS: Record<Sort, (a: BeerAgg, b: BeerAgg) => number> = {
  note: (a, b) => b.avg - a.avg || b.n - a.n,
  value: (a, b) => (b.value ?? -1) - (a.value ?? -1),
  pop: (a, b) => b.n - a.n || b.avg - a.avg,
  again: (a, b) => b.again / b.n - a.again / a.n || b.avg - a.avg
};
const LABEL: Record<Sort, string> = { note: "Note du groupe", value: "Rapport qualité/prix", pop: "Les plus goûtées", again: "Celles qu’on reprendrait" };

/** Podium (2e, 1re, 3e) avec verres qui se remplissent */
export function Podium({ list, val, onOpen }: { list: BeerAgg[]; val: (b: BeerAgg) => string; onOpen?: (k: string) => void }) {
  if (list.length < 3) return null;
  const [a, b, c] = list;
  const pod = (x: BeerAgg, cls: string, r: string, h: number) => (
    <button className={`pod ${cls}`} onClick={() => onOpen?.(x.key)}>
      <Glass score={x.avg} color={colorOf(cat, x.color)} h={h} />
      <div className="nm">{x.name}</div>
      <div className="plinth"><div className="rank">{r}</div><div className="sc">{val(x)}</div></div>
    </button>
  );
  return <div className="podium">{pod(b, "second", "2e", 70)}{pod(a, "first", "1re", 96)}{pod(c, "third", "3e", 60)}</div>;
}

export function Ranking({ T }: { T: Tasting[] }) {
  const [sort, setSort] = useState<Sort>("note");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const list = useMemo(() => beersOf(cat, T).sort(SORTERS[sort]), [T, sort]);
  if (!list.length) return <><h2>Classement</h2><EmptyState title="Aucune bière notée" text="La première gorgée ouvre le classement." /></>;
  const val = (b: BeerAgg) => sort === "value" ? (b.value != null ? fmt(b.value, 1) : "–") : sort === "again" ? Math.round(b.again / b.n * 100) + "%" : fmt(b.avg);
  const unit = (b: BeerAgg) => sort === "value" ? "pts par €" : sort === "again" ? "en reprendraient" : `/100, ${b.n} avis`;
  const toggle = (k: string) => setOpen(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const openFromPodium = (k: string) => {
    setOpen(s => new Set(s).add(k));
    setTimeout(() => document.querySelector(`.row[data-open="${CSS.escape(k)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  return (
    <>
      <h2>Classement</h2>
      <p className="sub">{list.length} bière{list.length > 1 ? "s" : ""}, {T.length} dégustation{T.length > 1 ? "s" : ""}</p>
      <div className="seg" role="group" aria-label="Trier">{(Object.keys(LABEL) as Sort[]).map(k =>
        <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{LABEL[k]}</button>)}</div>
      <Podium list={list} val={val} onOpen={openFromPodium} />
      <div className="list">{list.map((b, i) => {
        const isOpen = open.has(b.key);
        const meta = [b.producer, b.style, b.abv ? fmt(b.abv, 1) + " %" : "", b.p33 != null ? `${fmt(b.p33, 2)} € les 33 cl` : ""].filter(Boolean).join(", ");
        return (
          <div key={b.key} className="card">
            <button className="row" data-open={b.key} aria-expanded={isOpen} onClick={() => toggle(b.key)}>
              <span className="pos">{i + 1}</span><Glass score={b.avg} color={colorOf(cat, b.color)} h={48} />
              <span className="body"><span className="title">{b.name}</span><span className="meta" style={{ display: "block" }}>{meta || " "}</span></span>
              <span className="score"><b>{val(b)}</b><small>{unit(b)}</small></span>
            </button>
            {isOpen && <div className="details"><CritBars cat={cat} crit={b.crit} />
              {b.list.map(t => <Entry key={t.id} t={t} author showPhoto={false} />)}</div>}
          </div>
        );
      })}</div>
    </>
  );
}

export function Feed({ T, uid }: { T: Tasting[]; uid: string }) {
  const [mineOnly, setMineOnly] = useState(false);
  const { remove } = useStore();
  const toast = useToast();
  const list = mineOnly ? T.filter(t => t.user_id === uid) : T;
  async function onDelete(t: Tasting) {
    if (!confirm(`Supprimer ta fiche « ${t.item_name} » ?`)) return;
    await remove(t);
    toast("Fiche supprimée");
  }
  return (
    <>
      <h2>Carnet</h2><p className="sub">Toutes les fiches, de la plus récente à la plus ancienne</p>
      <div className="seg" role="group" aria-label="Filtrer">
        <button aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>Toute la bande</button>
        <button aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>Mes fiches</button>
      </div>
      {!list.length ? <EmptyState title={mineOnly ? "Tu n’as encore rien noté" : "Le carnet est vide"} text="Chaque bière goûtée mérite sa fiche." />
        : <div className="list">{list.map(t => (
          <div key={t.id} className="card" id={`t-${t.id}`}><div className="row" style={{ alignItems: "flex-start" }}>
            <Glass score={t.score} color={colorOf(cat, t.color)} h={52} />
            <div className="body"><div className="title">{t.item_name}</div>
              <div className="meta">{[t.producer, t.abv ? fmt(num(t.abv), 1) + " %" : ""].filter(Boolean).join(", ")}</div>
              <div style={{ paddingBottom: 0 }}><Entry t={t} author actions={t.user_id === uid} onDelete={onDelete} /></div>
            </div></div></div>
        ))}</div>}
    </>
  );
}

export function Bars({ T }: { T: Tasting[] }) {
  const list = useMemo(() => barsOf(T), [T]);
  return (
    <>
      <h2>Les bars</h2><p className="sub">Classés selon l’ambiance et la qualité de ce qu’on y a bu</p>
      {!list.length ? <EmptyState title="Aucun bar pour l’instant" text="Renseigne le lieu dans tes fiches pour voir apparaître les adresses." />
        : <div className="list">{list.map((b, i) => (
          <div key={b.name} className="card"><div className="row">
            <span className="pos">{i + 1}</span>
            <span className="body"><span className="title">{b.name}</span>
              <span className="meta" style={{ display: "block" }}>{b.n} bière{b.n > 1 ? "s" : ""} goûtée{b.n > 1 ? "s" : ""}{b.p33 != null ? `, ${fmt(b.p33, 2)} € les 33 cl en moyenne` : ""}</span>
              <span className="meta" style={{ display: "block" }}>Meilleure ici : {b.best.item_name} ({b.best.score})</span></span>
            <span className="score"><b style={{ color: "var(--gold)" }}>{b.amb ? fmt(b.amb, 1) : "–"}<span style={{ fontSize: 18 }}>★</span></b><small>bières à {fmt(b.avg)}/100</small></span>
          </div></div>
        ))}</div>}
    </>
  );
}

export function Team({ T, uid, sub = "Les chiffres du groupe" }: { T: Tasting[]; uid: string; sub?: string }) {
  if (!T.length) return <><h2>L’équipe</h2><p className="sub">{sub}</p><EmptyState title="Pas encore de chiffres" text="Ils arrivent avec la première fiche." /></>;
  const distinct = new Set(T.map(t => t.item_key)).size;
  const avg = T.reduce((a, t) => a + t.score, 0) / T.length;
  const P = peopleOf(T);
  const awards = awardsOf(cat, T, P);
  return (
    <>
      <h2>L’équipe</h2><p className="sub">{sub}</p>
      <div className="kpis">
        <div className="kpi"><b>{distinct}</b><span>bières différentes</span></div>
        <div className="kpi"><b>{fmt(litersOf(T), 1)} L</b><span>bus à plusieurs</span></div>
        <div className="kpi"><b>{fmt(spentOf(T), 0)} €</b><span>dépensés au comptoir</span></div>
        <div className="kpi"><b>{fmt(avg)}</b><span>note moyenne du groupe</span></div>
      </div>
      {awards.length > 0 && <div className="card" style={{ marginBottom: 22 }}>{awards.map(a =>
        <div key={a.title} className="award"><span className="ic">{a.ic}</span><div><b>{a.title}</b><span>{a.text}</span></div></div>)}</div>}
      <h2 style={{ fontSize: 20, marginBottom: 10 }}>Par dégustateur</h2>
      <div className="list">{P.sort((a, b) => b.n - a.n).map(p => (
        <div key={p.uid} className="card"><div className="row">
          <Avatar uid={p.uid} name={p.name} size={38} />
          <span className="body"><span className="title">{p.name}{p.uid === uid ? " (toi)" : ""}</span>
            <span className="meta" style={{ display: "block" }}>Coup de cœur : {p.fav.item_name} ({p.fav.score})</span>
            <span className="meta" style={{ display: "block" }}>{fmt(p.spent, 0)} € dépensés, note moyenne {fmt(p.avg)}</span></span>
          <span className="score"><b>{p.n}</b><small>bière{p.n > 1 ? "s" : ""}</small></span>
        </div></div>
      ))}</div>
    </>
  );
}
