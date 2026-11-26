import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { groupSubtitle } from "../lib/groups";
import { Glass } from "../components/Glass";
import { Loading } from "../components/Loading";

type Preview = { id: string; name: string; emoji: string; city: string | null; start_date: string | null; end_date: string | null; members: number };

/** Lien d'invitation : aperçu du groupe, puis inscription/connexion et adhésion automatique */
export function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const joining = useRef(false);

  useEffect(() => {
    supabase.rpc("invite_preview", { code }).then(({ data }) => setPreview((data as Preview[] | null)?.[0] || null));
  }, [code]);

  // Connecté : on rejoint directement
  useEffect(() => {
    if (loading || !session || joining.current) return;
    joining.current = true;
    supabase.rpc("join_group", { code }).then(({ data, error }) => {
      if (error) { setErr(error.message.includes("invalid_code") ? "Ce lien d’invitation n’est plus valable." : "Impossible de rejoindre le groupe, réessaie."); joining.current = false; return; }
      navigate(`/groups/${data}`, { replace: true });
    });
  }, [session, loading, code, navigate]);

  const next = `?next=${encodeURIComponent(`/join/${code}`)}`;
  return (
    <div className="auth">
      <div className="brand">
        <div className="hero"><Glass score={85} color="#E6AE35" h={110} /></div>
        <h1>Proost</h1>
      </div>
      {preview === undefined || (session && !err) ? <Loading text="Un instant…" />
        : preview === null || err ? (
          <div className="sec"><h3>Lien expiré</h3><p className="hint">{err || "Ce lien d’invitation n’est plus valable. Demande un nouveau lien à l’organisateur."}</p>
            <Link className="btn wide" style={{ display: "block", textAlign: "center" }} to="/">Ouvrir Proost</Link></div>
        ) : (
          <div className="sec" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 46, lineHeight: 1 }}>{preview.emoji}</div>
            <h3 style={{ justifyContent: "center", fontSize: 24, marginTop: 8 }}>{preview.name}</h3>
            <p className="hint">{[groupSubtitle(preview), `${preview.members} membre${preview.members > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}</p>
            <p style={{ margin: "0 0 16px" }}>On t’attend pour noter les bières ensemble !</p>
            <div className="stack">
              <Link className="btn wide" style={{ display: "block" }} to={`/signup${next}`}>Créer mon compte et rejoindre</Link>
              <Link className="btn wide secondary" style={{ display: "block" }} to={`/login${next}`}>J’ai déjà un compte</Link>
            </div>
          </div>
        )}
    </div>
  );
}
