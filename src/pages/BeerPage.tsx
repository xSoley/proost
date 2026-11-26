import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { beer as cat } from "../categories/beer";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { beersOf, colorOf } from "../lib/aggregate";
import type { Tasting } from "../lib/types";
import { fmt } from "../lib/utils";
import { Glass } from "../components/Glass";
import { Entry } from "../components/Entry";
import { CritBars } from "../components/CritBars";
import { ScoreTrend } from "../components/ScoreTrend";
import { useToast } from "../components/Toast";

export function BeerPage() {
  const { key = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useAuth();
  const { mine, loaded, remove } = useStore();
  const uid = session!.user.id;
  const agg = useMemo(() => beersOf(cat, mine.filter(t => t.item_key === key))[0] || null, [mine, key]);
  const [friends, setFriends] = useState<Tasting[] | null>(null);

  // Notes de mes amis : la RLS ne renvoie que celles visibles via nos groupes communs
  useEffect(() => {
    let alive = true;
    supabase.from("tastings").select("*, profiles(display_name)")
      .eq("item_key", key).neq("user_id", uid).order("tasted_at", { ascending: false })
      .then(({ data }) => { if (alive) setFriends((data as Tasting[]) || []); });
    return () => { alive = false; };
  }, [key, uid]);

  async function onDelete(t: Tasting) {
    if (!confirm(`Supprimer ta fiche « ${t.item_name} » ?`)) return;
    await remove(t);
    toast("Fiche supprimée");
  }

  if (!loaded) return <div className="loading">Ouverture de la cave…</div>;

  const name = agg?.name || friends?.[0]?.item_name || "";
  const friendsAvg = friends?.length ? friends.reduce((a, t) => a + t.score, 0) / friends.length : null;

  return (
    <>
      <button className="ghost back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}>← Ma cave</button>
      {agg ? (
        <>
          <div className="beer-head">
            <Glass score={agg.avg} color={colorOf(cat, agg.color)} h={110} />
            <div>
              <h2>{agg.name}</h2>
              <p className="sub" style={{ margin: 0 }}>{[agg.producer, agg.style, agg.abv ? fmt(agg.abv, 1) + " %" : ""].filter(Boolean).join(", ") || " "}</p>
            </div>
          </div>
          <div className="kpis">
            <div className="kpi"><b>{fmt(agg.avg)}</b><span>ma note moyenne</span></div>
            <div className="kpi"><b>{agg.n}</b><span>dégustation{agg.n > 1 ? "s" : ""}</span></div>
            <div className="kpi"><b>{Math.round(agg.again / agg.n * 100)} %</b><span>des fois, j’en aurais repris</span></div>
            <div className="kpi"><b>{agg.p33 != null ? `${fmt(agg.p33, 2)} €` : "–"}</b><span>les 33 cl en moyenne</span></div>
          </div>
          <div className="sec">
            <h3>Ma note dans le temps</h3>
            {agg.n > 1 ? <ScoreTrend list={agg.list} /> : <p className="hint">Regoûte-la pour voir ta note évoluer.</p>}
            <CritBars cat={cat} crit={agg.crit} />
          </div>
          <Link className="btn wide" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 22 }}
            to={`/new?name=${encodeURIComponent(agg.name)}`}>La regoûter</Link>
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>Mes dégustations</h2>
          <div className="card entries">{agg.list.map(t => <Entry key={t.id} t={t} actions onDelete={onDelete} />)}</div>
        </>
      ) : (
        <div className="empty"><b>{name || "Bière introuvable"}</b><p>Tu ne l’as pas encore goûtée.</p>
          {name && <Link className="btn" style={{ textDecoration: "none", display: "inline-block" }} to={`/new?name=${encodeURIComponent(name)}`}>La noter</Link>}</div>
      )}

      <h2 style={{ fontSize: 20, margin: "26px 0 4px" }}>Mes amis</h2>
      {friends === null ? <div className="loading" style={{ padding: "20px 0" }}>Chargement…</div>
        : friends.length ? (
          <>
            <p className="sub">{friends.length} avis, {fmt(friendsAvg!)}/100 en moyenne</p>
            <div className="card entries">{friends.map(t => <Entry key={t.id} t={t} author />)}</div>
          </>
        ) : <p className="sub">Aucun de tes amis ne l’a notée dans vos groupes communs.</p>}
    </>
  );
}
