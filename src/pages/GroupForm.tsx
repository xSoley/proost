import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../lib/store";
import { compressPhoto } from "../lib/image";
import { invalidatePhoto, usePhotoUrl } from "../lib/photos";
import { useToast } from "../components/Toast";
import { uuid } from "../lib/utils";

const EMOJIS = ["🍺", "🍻", "🇧🇪", "🎉", "🏔️", "🏖️", "🏰", "🎄", "⛺", "🚲", "🎸", "⚽"];

export function GroupForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useAuth();
  const { groups, groupsLoaded, reloadGroups } = useStore();
  const uid = session!.user.id;
  const existing = id ? groups.find(g => g.id === id) || null : null;

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍻");
  const [city, setCity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cover, setCover] = useState<{ blob?: Blob; preview?: string; remove?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentCover = usePhotoUrl(cover.remove || cover.preview ? null : existing?.cover_path);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name); setEmoji(existing.emoji); setCity(existing.city || "");
    setStart(existing.start_date || ""); setEnd(existing.end_date || "");
  }, [existing?.id]);
  useEffect(() => () => { if (cover.preview) URL.revokeObjectURL(cover.preview); }, [cover.preview]);

  if (id && groupsLoaded && (!existing || existing.created_by !== uid)) {
    return <div className="empty"><b>Groupe introuvable</b><p>Seul le créateur du groupe peut le modifier.</p></div>;
  }

  async function pick(file?: File) {
    if (!file) return;
    try {
      const { photo } = await compressPhoto(file);
      setCover({ blob: photo, preview: URL.createObjectURL(photo) });
    } catch { toast("Impossible de lire cette photo."); }
  }

  async function submit() {
    if (!name.trim()) { toast("Donne un nom au groupe."); return; }
    if (start && end && end < start) { toast("La date de fin est avant la date de début."); return; }
    setBusy(true);
    try {
      const gid = existing?.id || uuid();
      const fields = { name: name.trim().slice(0, 60), emoji: emoji.trim() || "🍻", city: city.trim() || null, start_date: start || null, end_date: end || null };
      if (existing) {
        const { error } = await supabase.from("groups").update(fields).eq("id", gid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("groups").insert({ id: gid, created_by: uid, ...fields });
        if (error) throw error;
      }
      const path = `${uid}/covers/${gid}.jpg`;
      if (cover.blob) {
        const { error } = await supabase.storage.from("photos").upload(path, cover.blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        await supabase.from("groups").update({ cover_path: path }).eq("id", gid);
        invalidatePhoto(path);
      } else if (cover.remove && existing?.cover_path) {
        await supabase.storage.from("photos").remove([existing.cover_path]);
        await supabase.from("groups").update({ cover_path: null }).eq("id", gid);
      }
      await reloadGroups();
      toast(existing ? "Groupe enregistré" : "Groupe créé, invite la bande !");
      navigate(`/groups/${gid}`, { replace: true });
    } catch {
      setBusy(false);
      toast("Enregistrement impossible, réessaie dans un instant.");
    }
  }

  async function deleteGroup() {
    setBusy(true);
    if (existing?.cover_path) await supabase.storage.from("photos").remove([existing.cover_path]);
    const { error } = await supabase.from("groups").delete().eq("id", existing!.id);
    if (error) { setBusy(false); toast("Suppression impossible."); return; }
    await reloadGroups();
    toast("Groupe supprimé");
    navigate("/groups", { replace: true });
  }

  const shown = cover.preview || currentCover;
  return (
    <>
      <button className="ghost back" onClick={() => navigate(-1)}>← Retour</button>
      <h2>{existing ? "Modifier le groupe" : "Nouveau groupe"}</h2>
      <p className="sub">Un week-end, une soirée, un voyage : on note ensemble.</p>

      <div className="sec">
        <h3>Le groupe</h3>
        <label className="f" htmlFor="gName">Nom</label>
        <input className="in" id="gName" maxLength={60} placeholder="Week-end à Bruxelles" value={name} onChange={e => setName(e.target.value)} />
        <label className="f">Emoji</label>
        <div className="chips" role="group">{EMOJIS.map(e =>
          <button key={e} type="button" className="chip emoji" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>{e}</button>)}
          <input className="in emoji-in" maxLength={8} aria-label="Autre emoji" value={EMOJIS.includes(emoji) ? "" : emoji} placeholder="…" onChange={e => setEmoji(e.target.value)} />
        </div>
        <label className="f" htmlFor="gCity">Ville</label>
        <input className="in" id="gCity" maxLength={60} placeholder="Bruxelles" value={city} onChange={e => setCity(e.target.value)} />
        <div className="two">
          <div><label className="f" htmlFor="gStart">Du</label><input className="in" id="gStart" type="date" value={start} onChange={e => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} /></div>
          <div><label className="f" htmlFor="gEnd">Au</label><input className="in" id="gEnd" type="date" min={start || undefined} value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <p className="hint" style={{ margin: "8px 0 0" }}>Facultatif. Pendant ces dates, tes fiches iront dans ce groupe par défaut. Sans dates, le groupe reste ouvert jusqu’à ce que tu le clôtures.</p>
      </div>

      <div className="sec">
        <h3>Photo de couverture</h3><p className="hint">Facultative. Elle ouvre le récap du groupe.</p>
        <input ref={fileRef} type="file" accept="image/*" className="sr" tabIndex={-1} aria-hidden="true" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        {shown ? (
          <div className="photo-box">
            <img className="photo-prev" src={shown} alt="Couverture" />
            <div className="acts">
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Changer</button>
              <button type="button" className="ghost danger" onClick={() => setCover({ remove: true })}>Retirer</button>
            </div>
          </div>
        ) : (
          <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span>Choisir une photo</span>
          </button>
        )}
      </div>

      <button className="btn wide" disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : existing ? "Enregistrer" : "Créer le groupe"}</button>
      {existing && <button className="ghost danger" style={{ width: "100%", padding: 12, marginTop: 10 }} onClick={() => setConfirmDel(true)}>Supprimer le groupe</button>}

      <div className={"modal" + (confirmDel ? " open" : "")} onClick={e => { if (e.target === e.currentTarget && !busy) setConfirmDel(false); }}>
        <div className="modal-in" role="dialog" aria-modal="true">
          <h3>Supprimer le groupe ?</h3>
          <p>Le groupe disparaît pour tout le monde. Les fiches ne sont pas effacées : chacun les retrouve dans sa cave, en Perso.</p>
          <div className="stack">
            <button className="btn wide danger" disabled={busy} onClick={deleteGroup}>Oui, supprimer</button>
            <button className="btn wide secondary" disabled={busy} onClick={() => setConfirmDel(false)}>Annuler</button>
          </div>
        </div>
      </div>
    </>
  );
}
