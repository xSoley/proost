import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { groupStatus, groupSubtitle, recapReady, type GroupStatus } from "../lib/groups";
import { usePhotoUrl } from "../lib/photos";
import type { Group } from "../lib/types";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";

const SECTIONS: [GroupStatus, string][] = [["current", "En cours"], ["upcoming", "À venir"], ["past", "Passés"]];

export function GroupCard({ g }: { g: Group }) {
  const cover = usePhotoUrl(g.cover_path);
  const n = g.group_members?.[0]?.count;
  return (
    <Link className="card group-card" to={`/groups/${g.id}`}>
      {g.cover_path && (cover ? <img className="group-cover" src={cover} alt="" loading="lazy" /> : <span className="group-cover ph-wait" />)}
      <div className="row">
        <span className="group-emoji" aria-hidden="true">{g.emoji}</span>
        <span className="body">
          <span className="title">{g.name}</span>
          <span className="meta" style={{ display: "block" }}>{groupSubtitle(g) || "Sans dates"}</span>
          {recapReady(g) && <span className="meta" style={{ display: "block", color: "var(--hop)", fontWeight: 600 }}>🏆 Récap disponible</span>}
        </span>
        {n != null && <span className="score"><b>{n}</b><small>membre{n > 1 ? "s" : ""}</small></span>}
      </div>
    </Link>
  );
}

export function Groups() {
  const { groups, groupsLoaded } = useStore();
  if (!groupsLoaded) return <Loading text="Chargement des groupes…" />;
  return (
    <>
      <h2>Groupes</h2>
      <p className="sub">Pour noter ensemble pendant un week-end, une soirée, un voyage</p>
      <Link className="btn wide" style={{ display: "block", textAlign: "center", marginBottom: 22 }} to="/groups/new">Créer un groupe</Link>
      {!groups.length
        ? <EmptyState title="Aucun groupe pour l’instant" text="Crée-en un et envoie le lien à la bande, ou ouvre le lien d’invitation qu’on t’a envoyé." cta={null} />
        : SECTIONS.map(([k, label]) => {
          const list = groups.filter(g => groupStatus(g) === k);
          if (!list.length) return null;
          if (k === "upcoming") list.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
          return (
            <section key={k} style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 20, marginBottom: 10 }}>{label}</h2>
              <div className="list">{list.map(g => <GroupCard key={g.id} g={g} />)}</div>
            </section>
          );
        })}
    </>
  );
}
