import { NavLink, useMatch, useNavigate } from "react-router-dom";

const ic = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function BottomNav() {
  const navigate = useNavigate();
  // Dans un groupe, le + note directement dans ce groupe
  const inGroup = useMatch("/groups/:id/*");
  const gid = inGroup && inGroup.params.id !== "new" ? inGroup.params.id : null;
  return (
    <nav className="nav" aria-label="Navigation">
      <div className="nav-in">
        <NavLink to="/" end>
          <svg viewBox="0 0 24 24" {...ic}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M9 9h6M9 13h6" /></svg>Ma cave</NavLink>
        <NavLink to="/stats">
          <svg viewBox="0 0 24 24" {...ic}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>Mes stats</NavLink>
        <button className="fab" aria-label="Noter une bière" onClick={() => navigate(gid ? `/new?group=${gid}` : "/new")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
        <NavLink to="/groups">
          <svg viewBox="0 0 24 24" {...ic}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5a5 5 0 0 1 4.5 5" /></svg>Groupes</NavLink>
        <NavLink to="/profile">
          <svg viewBox="0 0 24 24" {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>Profil</NavLink>
      </div>
    </nav>
  );
}
