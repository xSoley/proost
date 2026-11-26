import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { authError } from "./AuthPage";
import { clearLocal } from "../lib/outbox";
import { useStore } from "../lib/store";

/** Supprime tous les fichiers du dossier de l'utilisateur dans le bucket photos */
async function removeAllPhotos(uid: string) {
  for (const dir of [uid, `${uid}/covers`]) {
    for (;;) {
      const { data, error } = await supabase.storage.from("photos").list(dir, { limit: 100 });
      if (error) throw error;
      const files = (data || []).filter(f => f.id).map(f => `${dir}/${f.name}`);
      if (!files.length) break;
      const { error: e2 } = await supabase.storage.from("photos").remove(files);
      if (e2) throw e2;
    }
  }
}

export function Profile() {
  const { session, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const uid = session!.user.id;
  const [name, setName] = useState(profile?.display_name || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const { pendingCount } = useStore();

  useEffect(() => { setName(profile?.display_name || ""); }, [profile?.display_name]);

  async function saveName() {
    const v = name.trim().slice(0, 24);
    if (!v) { toast("Indique ton prénom."); return; }
    setBusy("name");
    const { error } = await supabase.from("profiles").update({ display_name: v }).eq("id", uid);
    setBusy(null);
    if (error) { toast("Enregistrement impossible, réessaie dans un instant."); return; }
    await refreshProfile();
    toast("Prénom enregistré");
  }

  async function savePassword() {
    if (password.length < 6) { toast("6 caractères minimum."); return; }
    setBusy("pass");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) { toast(authError(error.message)); return; }
    setPassword("");
    toast("Mot de passe changé");
  }

  async function logout() {
    if (pendingCount && !confirm(`${pendingCount} fiche${pendingCount > 1 ? "s" : ""} pas encore envoyée${pendingCount > 1 ? "s seront perdues" : " sera perdue"}. Se déconnecter quand même ?`)) return;
    await clearLocal(uid);
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function deleteAccount() {
    setBusy("del");
    try {
      await removeAllPhotos(uid);
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
      await clearLocal(uid);
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch {
      setBusy(null);
      toast("Suppression impossible, réessaie dans un instant.");
    }
  }

  return (
    <>
      <h2>Mon profil</h2>
      <p className="sub">{session!.user.email}</p>

      <div className="sec">
        <h3>Mon prénom</h3>
        <p className="hint">Il s’affiche à côté de tes notes, pour que la bande sache qui a noté quoi.</p>
        <input className="in" maxLength={24} placeholder="Ton prénom" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ height: 12 }} />
        <button className="btn wide" disabled={busy === "name" || name.trim() === profile?.display_name} onClick={saveName}>
          {busy === "name" ? "Enregistrement…" : "Enregistrer"}</button>
      </div>

      <div className="sec">
        <h3>Mot de passe</h3>
        <label className="f" htmlFor="pPass">Nouveau mot de passe</label>
        <input className="in" id="pPass" type="password" autoComplete="new-password" placeholder="6 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} />
        <div style={{ height: 12 }} />
        <button className="btn wide secondary" disabled={busy === "pass" || !password} onClick={savePassword}>
          {busy === "pass" ? "Enregistrement…" : "Changer le mot de passe"}</button>
      </div>

      <div className="stack">
        <button className="btn wide secondary" onClick={logout}>Se déconnecter</button>
        <button className="ghost danger" style={{ padding: "12px" }} onClick={() => setConfirmDel(true)}>Supprimer mon compte</button>
      </div>

      <div className={"modal" + (confirmDel ? " open" : "")} onClick={e => { if (e.target === e.currentTarget && busy !== "del") setConfirmDel(false); }}>
        <div className="modal-in" role="dialog" aria-modal="true" aria-labelledby="delTitle">
          <h3 id="delTitle">Supprimer ton compte ?</h3>
          <p>Toutes tes fiches et tes photos seront effacées pour de bon. Les groupes que tu as créés passent au membre le plus ancien.</p>
          <div className="stack">
            <button className="btn wide danger" disabled={busy === "del"} onClick={deleteAccount}>{busy === "del" ? "Suppression…" : "Oui, tout supprimer"}</button>
            <button className="btn wide secondary" disabled={busy === "del"} onClick={() => setConfirmDel(false)}>Annuler</button>
          </div>
        </div>
      </div>
    </>
  );
}
