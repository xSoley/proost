import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../lib/store";
import { groupSubtitle, inviteUrl, recapReady, useGroupTastings, type Member } from "../lib/groups";
import { usePhotoUrl } from "../lib/photos";
import { useToast } from "../components/Toast";
import { Avatar } from "../components/Avatar";
import { Bars, Feed, Ranking, Team } from "../components/GroupViews";

type Tab = "ranking" | "feed" | "bars" | "team";
const TABS: [Tab, string][] = [["ranking", "Classement"], ["feed", "Carnet"], ["bars", "Bars"], ["team", "Équipe"]];

export function GroupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useAuth();
  const { groups, groupsLoaded, reloadGroups } = useStore();
  const uid = session!.user.id;
  const g = groups.find(x => x.id === id) || null;
  const { tastings } = useGroupTastings(id);
  const cover = usePhotoUrl(g?.cover_path);
  const [tab, setTab] = useState<Tab>(() => { try { return (sessionStorage.getItem(`tab-${id}`) as Tab) || "ranking"; } catch { return "ranking"; } });
  const [members, setMembers] = useState<Member[]>([]);
  const [panel, setPanel] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const owner = g?.created_by === uid;

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("group_members").select("user_id, role, joined_at, profiles(display_name)").eq("group_id", id).order("joined_at");
    if (data) setMembers(data as unknown as Member[]);
  }, [id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { setCode(g?.invite_code || null); }, [g?.invite_code]);
  const choose = (t: Tab) => { setTab(t); try { sessionStorage.setItem(`tab-${id}`, t); } catch { /* */ } };

  if (!groupsLoaded) return <div className="loading">Chargement du groupe…</div>;
  if (!g) return <div className="empty"><b>Groupe introuvable</b><p>Tu n’en fais pas (ou plus) partie.</p>
    <Link className="btn" to="/groups">Mes groupes</Link></div>;

  const link = code ? inviteUrl(code) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(link); toast("Lien copié"); }
    catch { window.prompt("Copie ce lien :", link); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: `Proost : ${g!.name}`, text: `Rejoins « ${g!.emoji} ${g!.name} » sur Proost pour noter nos bières ensemble !`, url: link }); }
      catch { /* partage annulé */ }
    } else copy();
  }
  async function regenerate() {
    if (!confirm("L’ancien lien ne fonctionnera plus. Générer un nouveau lien ?")) return;
    const { data, error } = await supabase.rpc("regenerate_invite_code", { gid: id });
    if (error) { toast("Impossible de changer le lien."); return; }
    setCode(data as string); reloadGroups(); toast("Nouveau lien prêt");
  }
  async function removeMember(m: Member) {
    if (!confirm(`Retirer ${m.profiles?.display_name || "ce membre"} du groupe ? Ses fiches restent dans le groupe.`)) return;
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", m.user_id);
    if (error) { toast("Impossible de retirer ce membre."); return; }
    loadMembers(); reloadGroups();
  }
  async function setClosed(closed: boolean) {
    if (closed && !confirm("Clôturer le groupe ? Le récap devient disponible pour tout le monde. Tu pourras le rouvrir.")) return;
    const { error } = await supabase.from("groups").update({ closed_at: closed ? new Date().toISOString() : null }).eq("id", id);
    if (error) { toast("Impossible de modifier le groupe."); return; }
    await reloadGroups();
    if (closed) navigate(`/groups/${id}/recap`);
    else toast("Groupe rouvert");
  }
  async function leave() {
    if (!confirm(`Quitter « ${g!.name} » ? Tu ne verras plus les fiches du groupe. Les tiennes restent visibles par le groupe.`)) return;
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", uid);
    if (error) { toast("Impossible de quitter le groupe."); return; }
    await reloadGroups();
    navigate("/groups", { replace: true });
  }

  const T = tastings || [];
  return (
    <>
      <button className="ghost back" onClick={() => navigate("/groups")}>← Groupes</button>
      {g.cover_path && cover && <img className="group-hero" src={cover} alt="" />}
      <div className="group-head">
        <span className="group-emoji big" aria-hidden="true">{g.emoji}</span>
        <div className="body">
          <h2>{g.name}</h2>
          <p className="sub" style={{ margin: 0 }}>{groupSubtitle(g) || "Sans dates"}</p>
        </div>
      </div>
      <div className="group-actions">
        <button className="ghost" onClick={() => setPanel(true)}>👥 {members.length || ""} membre{members.length > 1 ? "s" : ""} · Inviter</button>
        {owner && <Link className="ghost" to={`/groups/${id}/edit`}>Modifier</Link>}
      </div>

      {recapReady(g) ? (
        <Link className="card recap-teaser" to={`/groups/${id}/recap`}>
          <span className="ic">🏆</span>
          <span className="body"><b>Le récap est prêt</b><span>Podium, palmarès, coups de cœur et toutes les photos</span></span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : owner && (
        <button className="ghost" style={{ width: "100%", padding: 11, marginBottom: 18 }} onClick={() => setClosed(true)}>🏁 Clôturer le week-end et voir le récap</button>
      )}
      {owner && g.closed_at && <button className="linkbtn" style={{ marginBottom: 18 }} onClick={() => setClosed(false)}>Rouvrir le groupe</button>}

      <div className="seg" role="tablist" aria-label="Vues du groupe">{TABS.map(([k, l]) =>
        <button key={k} role="tab" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => choose(k)}>{l}</button>)}</div>

      {tastings === null ? <div className="loading">Ouverture du carnet…</div>
        : tab === "ranking" ? <Ranking T={T} />
          : tab === "feed" ? <Feed T={T} uid={uid} />
            : tab === "bars" ? <Bars T={T} />
              : <Team T={T} uid={uid} />}

      <div className={"modal" + (panel ? " open" : "")} onClick={e => { if (e.target === e.currentTarget) setPanel(false); }}>
        <div className="modal-in" role="dialog" aria-modal="true" aria-labelledby="invTitle">
          <h3 id="invTitle">Inviter la bande</h3>
          <p>Envoie ce lien : en l’ouvrant, on crée son compte et on arrive directement dans le groupe.</p>
          <div className="invite-link">{link}</div>
          <div className="two" style={{ marginTop: 10 }}>
            <button className="btn secondary" onClick={copy}>Copier le lien</button>
            <button className="btn" onClick={share}>Partager</button>
          </div>
          {owner && <button className="linkbtn" style={{ marginTop: 12 }} onClick={regenerate}>Générer un nouveau lien</button>}
          <h3 style={{ fontSize: 19, marginTop: 20 }}>Membres</h3>
          <div className="members">{members.map(m => (
            <div key={m.user_id} className="member">
              <Avatar uid={m.user_id} name={m.profiles?.display_name} size={30} />
              <span className="body">{m.profiles?.display_name || "Anonyme"}{m.user_id === uid ? " (toi)" : ""}
                {m.role === "owner" && <small> · créateur</small>}</span>
              {owner && m.user_id !== uid && <button className="ghost danger" onClick={() => removeMember(m)}>Retirer</button>}
            </div>
          ))}</div>
          <div className="stack" style={{ marginTop: 16 }}>
            {!owner && <button className="ghost danger" style={{ padding: 10 }} onClick={leave}>Quitter le groupe</button>}
            <button className="btn wide secondary" onClick={() => setPanel(false)}>Fermer</button>
          </div>
        </div>
      </div>
    </>
  );
}
