import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "./Avatar";
import { BottomNav } from "./BottomNav";

export function Layout() {
  const { session, profile } = useAuth();
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
        <main><Outlet /></main>
      </div>
      <BottomNav />
    </>
  );
}
