import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { Glass } from "../components/Glass";
import { authError } from "./AuthPage";

export function ResetPassword() {
  const { session, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(authError(error.message)); return; }
    clearRecovery();
    toast("Mot de passe changé, proost !");
    navigate("/", { replace: true });
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="hero"><Glass score={40} color="#C8741D" h={110} /></div>
        <h1>Proost</h1>
      </div>
      {session ? (
        <form className="sec" onSubmit={submit}>
          <h3>Nouveau mot de passe</h3>
          <label className="f" htmlFor="rPass">Mot de passe</label>
          <input className="in" id="rPass" type="password" autoComplete="new-password" placeholder="6 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} />
          {err && <p className="err" role="alert">{err}</p>}
          <div style={{ height: 14 }} />
          <button className="btn wide" disabled={busy}>{busy ? "Un instant…" : "Enregistrer"}</button>
        </form>
      ) : (
        <div className="sec"><h3>Lien expiré</h3><p className="hint">Ce lien n’est plus valable. Redemande-en un depuis l’écran de connexion.</p>
          <button className="btn wide" onClick={() => navigate("/forgot")}>Recevoir un nouveau lien</button></div>
      )}
    </div>
  );
}
