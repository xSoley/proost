import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Glass } from "../components/Glass";
import { setNext } from "../auth/AuthProvider";

type Mode = "login" | "signup" | "forgot";

export function authError(msg: string | undefined): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirme d’abord ton e-mail grâce au lien reçu.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail.";
  if (m.includes("password should be") || m.includes("weak")) return "Mot de passe trop court : 6 caractères minimum.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives, réessaie dans quelques minutes.";
  if (m.includes("fetch") || m.includes("network")) return "Pas de réseau. Réessaie dans un instant.";
  return "Ça n’a pas marché, réessaie dans un instant.";
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(""); setDone("");
    if (mode === "signup" && !name.trim()) { setErr("Indique ton prénom."); return; }
    setBusy(true);
    if (next) setNext(next);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate(next || "/", { replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim().slice(0, 24) }, emailRedirectTo: window.location.origin + (next || "/") }
        });
        if (error) throw error;
        if (data.session) navigate(next || "/", { replace: true });
        else setDone("Presque fini ! Clique sur le lien reçu par e-mail pour activer ton compte.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setDone("Si un compte existe avec cet e-mail, tu vas recevoir un lien pour choisir un nouveau mot de passe.");
      }
    } catch (e) {
      setErr(authError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="hero"><Glass score={78} color="#E6AE35" h={120} /></div>
        <h1>Proost</h1>
        <p>Ta cave numérique de dégustation, entre amis.</p>
      </div>
      <form className="sec" onSubmit={submit} noValidate>
        <h3>{mode === "login" ? "Connexion" : mode === "signup" ? "Créer mon compte" : "Mot de passe oublié"}</h3>
        {mode === "forgot" && <p className="hint">On t’envoie un lien pour en choisir un nouveau.</p>}
        {mode === "signup" && <>
          <label className="f" htmlFor="aName">Prénom</label>
          <input className="in" id="aName" maxLength={24} placeholder="Ton prénom" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} />
        </>}
        <label className="f" htmlFor="aEmail">E-mail</label>
        <input className="in" id="aEmail" type="email" inputMode="email" autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} />
        {mode !== "forgot" && <>
          <label className="f" htmlFor="aPass">Mot de passe</label>
          <input className="in" id="aPass" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "6 caractères minimum" : ""} value={password} onChange={e => setPassword(e.target.value)} />
        </>}
        {err && <p className="err" role="alert">{err}</p>}
        {done && <p className="ok" role="status">{done}</p>}
        <div style={{ height: 14 }} />
        <button className="btn wide" disabled={busy}>
          {busy ? "Un instant…" : mode === "login" ? "Se connecter" : mode === "signup" ? "C’est parti" : "Envoyer le lien"}
        </button>
        {mode === "login" && <p className="alt"><Link className="linkbtn" to={"/forgot" + q}>Mot de passe oublié ?</Link></p>}
      </form>
      <p className="alt">
        {mode === "login"
          ? <>Pas encore de compte ? <Link className="linkbtn" to={"/signup" + q}>Créer un compte</Link></>
          : <>Déjà un compte ? <Link className="linkbtn" to={"/login" + q}>Se connecter</Link></>}
      </p>
    </div>
  );
}
