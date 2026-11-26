import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { beer as cat } from "../categories/beer";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../lib/store";
import { groupSubtitle, recapReady, useGroupTastings } from "../lib/groups";
import { awardsOf, beersOf, colorOf, litersOf, peopleOf, spentOf } from "../lib/aggregate";
import { usePhotoUrl } from "../lib/photos";
import type { Tasting } from "../lib/types";
import { fmt, fmtDate } from "../lib/utils";
import { Glass } from "../components/Glass";
import { Photo } from "../components/Photo";
import { Entry } from "../components/Entry";
import { Avatar } from "../components/Avatar";
import { Podium } from "../components/GroupViews";
import { Reveal } from "../components/Reveal";
import { Loading } from "../components/Loading";

const hasPhoto = (t: Tasting) => !!(t.photo_path || t._pending?.photo);
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Couverture : photo du groupe, sinon la plus belle photo (celle de la bière la mieux notée) */
function Cover({ path, fallback, children }: { path: string | null; fallback: Tasting | null; children: React.ReactNode }) {
  const coverUrl = usePhotoUrl(path);
  return (
    <header className="recap-cover">
      {path ? (coverUrl && <img src={coverUrl} alt="" />) : fallback && <Photo t={fallback} />}
      <div className="recap-cover-in">{children}</div>
    </header>
  );
}

export function Recap() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { groups, groupsLoaded } = useStore();
  const uid = session!.user.id;
  const g = groups.find(x => x.id === id) || null;
  const { tastings } = useGroupTastings(id);
  const [open, setOpen] = useState<Tasting | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const T = useMemo(() => tastings || [], [tastings]);
  const data = useMemo(() => {
    const beers = beersOf(cat, T).sort((a, b) => b.avg - a.avg || b.n - a.n);
    const P = peopleOf(T).sort((a, b) => b.n - a.n);
    const photos = T.filter(hasPhoto).sort((a, b) => a.tasted_at.localeCompare(b.tasted_at));
    const days: [string, Tasting[]][] = [];
    for (const t of photos) {
      const k = dayKey(t.tasted_at);
      if (!days.length || days[days.length - 1][0] !== k) days.push([k, []]);
      days[days.length - 1][1].push(t);
    }
    const bestPhoto = T.filter(hasPhoto).sort((a, b) => b.score - a.score)[0] || null;
    return { beers, P, days, bestPhoto, awards: awardsOf(cat, T, P, true) };
  }, [T]);

  if (!groupsLoaded || tastings === null) return <Loading text="Ouverture du récap…" />;
  if (!g) return <div className="empty"><b>Groupe introuvable</b><p>Tu n’en fais pas (ou plus) partie.</p></div>;
  if (!recapReady(g)) return (
    <div className="empty"><Glass score={50} color="#E6AE35" h={90} /><b>Le récap n’est pas encore prêt</b>
      <p>Il sera disponible après le {g.end_date ? fmtDate(g.end_date + "T12:00:00", { day: "numeric", month: "long" }) : "dernier jour"}, ou dès que le créateur clôture le groupe.</p>
      <Link className="btn" to={`/groups/${id}`}>Retour au groupe</Link></div>
  );

  const avg = T.length ? T.reduce((a, t) => a + t.score, 0) / T.length : 0;
  const totalPhotos = data.days.reduce((a, d) => a + d[1].length, 0);

  return (
    <div className="recap">
      <button className="ghost back" onClick={() => navigate(`/groups/${id}`)}>← {g.name}</button>

      {/* 1. Couverture */}
      <Cover path={g.cover_path} fallback={data.bestPhoto}>
        <span className="recap-emoji">{g.emoji}</span>
        <h1>{g.name}</h1>
        <p>{groupSubtitle(g)}</p>
      </Cover>

      {!T.length ? (
        <div className="empty"><b>Aucune fiche dans ce groupe</b><p>Le récap se remplit avec les dégustations de la bande.</p></div>
      ) : <>
        {/* 2. Les chiffres */}
        <section className="recap-sec">
          <h2>Les chiffres</h2>
          <div className="kpis">
            <div className="kpi"><b>{data.beers.length}</b><span>bières différentes</span></div>
            <div className="kpi"><b>{T.length}</b><span>dégustations</span></div>
            <div className="kpi"><b>{fmt(litersOf(T), 1)} L</b><span>bus à plusieurs</span></div>
            <div className="kpi"><b>{fmt(spentOf(T), 0)} €</b><span>dépensés au comptoir</span></div>
            <div className="kpi wide"><b>{fmt(avg)}<small>/100</small></b><span>note moyenne du groupe</span></div>
          </div>
        </section>

        {/* 3. Le podium */}
        <section className="recap-sec">
          <h2>Le podium</h2>
          {data.beers.length >= 3 ? (
            <Reveal><Podium list={data.beers} val={b => fmt(b.avg)} rise
              onOpen={k => navigate(`/beer/${encodeURIComponent(k)}`)} /></Reveal>
          ) : (
            <Reveal><div className="list">{data.beers.map((b, i) => (
              <div key={b.key} className="card"><div className="row">
                <span className="pos">{i + 1}</span><Glass score={b.avg} color={colorOf(cat, b.color)} h={56} rise />
                <span className="body"><span className="title">{b.name}</span></span>
                <span className="score"><b>{fmt(b.avg)}</b><small>/100</small></span>
              </div></div>))}</div></Reveal>
          )}
        </section>

        {/* 4. Le palmarès */}
        {data.awards.length > 0 && <section className="recap-sec">
          <h2>Le palmarès</h2>
          <div className="card">{data.awards.map(a =>
            <div key={a.title} className="award"><span className="ic">{a.ic}</span><div><b>{a.title}</b><span>{a.text}</span></div></div>)}</div>
        </section>}

        {/* 5. Coups de cœur */}
        <section className="recap-sec">
          <h2>Les coups de cœur</h2>
          <div className="faves">{data.P.map(p => (
            <button key={p.uid} className="card fave" onClick={() => setOpen(p.fav)}>
              {hasPhoto(p.fav) ? <Photo t={p.fav} thumb className="fave-photo" />
                : <span className="fave-photo fave-glass"><Glass score={p.fav.score} color={colorOf(cat, p.fav.color)} h={70} /></span>}
              <span className="fave-who"><Avatar uid={p.uid} name={p.name} size={22} />{p.name}{p.uid === uid ? " (toi)" : ""}</span>
              <span className="fave-beer">{p.fav.item_name}</span>
              <span className="fave-score">{p.fav.score}<small>/100</small></span>
            </button>
          ))}</div>
        </section>

        {/* 6. Mosaïque */}
        <section className="recap-sec">
          <h2>Les photos</h2>
          {!totalPhotos ? <p className="sub">Personne n’a pris de photo. La prochaine fois !</p>
            : data.days.map(([k, list]) => (
              <div key={k}>
                <h3 className="day">{fmtDate(k + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase())}</h3>
                <div className="mosaic">{list.map(t => (
                  <button key={t.id} onClick={() => setOpen(t)} aria-label={`${t.item_name}, ${t.score}/100`}>
                    <Photo t={t} thumb />
                  </button>
                ))}</div>
              </div>
            ))}
        </section>
        <p className="sub" style={{ textAlign: "center", marginTop: 24 }}>Proost, et à la prochaine ! 🍻</p>
      </>}

      {/* Fiche ouverte depuis la mosaïque ou un coup de cœur */}
      <div className={"modal" + (open ? " open" : "")} onClick={e => { if (e.target === e.currentTarget) setOpen(null); }}>
        {open && <div className="modal-in recap-entry" role="dialog" aria-modal="true" aria-label={open.item_name}>
          <div className="row" style={{ padding: 0, marginBottom: 6 }}>
            <Glass score={open.score} color={colorOf(cat, open.color)} h={52} />
            <span className="body"><span className="title">{open.item_name}</span>
              <span className="meta" style={{ display: "block" }}>{[open.producer, open.abv ? fmt(open.abv, 1) + " %" : ""].filter(Boolean).join(", ")}</span></span>
          </div>
          <Entry t={open} author />
          <button className="btn wide secondary" style={{ marginTop: 8 }} onClick={() => setOpen(null)}>Fermer</button>
        </div>}
      </div>
    </div>
  );
}
