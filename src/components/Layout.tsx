import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "./Avatar";
import { BottomNav } from "./BottomNav";
import { useStore } from "../lib/store";

export function Layout() {
  const { session, profile } = useAuth();
  const { pendingCount } = useStore();
  // Bandeau discret : seulement si l'envoi traîne (hors ligne), pas pendant un envoi normal
  const [showPending, setShowPending] = useState(false);
  useEffect(() => {
    if (!pendingCount) { setShowPending(false); return; }
    const t = window.setTimeout(() => setShowPending(true), navigator.onLine ? 4000 : 0);
    return () => clearTimeout(t);
  }, [pendingCount]);
  return (
    <>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <h1>Proost</h1>
            <p>Ta cave numérique de dégustation</p>
          </div>
          <Link className="me" to="/profile" aria-label="Mon profil">
            <Avatar uid={session!.user.id} name={profile?.display_name} />
            <span>{profile?.display_name || "Mon prénom"}</span>
          </Link>
        </header>
        {showPending && pendingCount > 0 && <div className="banner" role="status">{pendingCount} fiche{pendingCount > 1 ? "s" : ""} en attente d’envoi. Elles partiront dès le retour du réseau.</div>}
        <main><Outlet /></main>
      </div>
      <BottomNav />
    </>
  );
}
