import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProvider, takeNext, useAuth } from "./auth/AuthProvider";
import { ToastProvider } from "./components/Toast";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { ResetPassword } from "./pages/ResetPassword";
import { Profile } from "./pages/Profile";
import { Placeholder } from "./pages/Placeholder";
import { supabaseConfigured } from "./lib/supabase";
import { StoreProvider } from "./lib/store";
import { Cave } from "./pages/Cave";
import { BeerPage } from "./pages/BeerPage";
import { Stats } from "./pages/Stats";
import { TastingForm } from "./pages/TastingForm";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="boot">Ouverture de la cave…</div>;
  if (!session) {
    const next = loc.pathname + loc.search;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <div className="boot">Ouverture de la cave…</div>;
  if (session) { const n = params.get("next"); return <Navigate to={n && n.startsWith("/") ? n : "/"} replace />; }
  return <>{children}</>;
}

/** Redirections globales : lien de réinitialisation, retour après confirmation d'e-mail */
function AuthRedirects() {
  const { session, recovery } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (recovery && loc.pathname !== "/reset-password") navigate("/reset-password", { replace: true });
  }, [recovery, loc.pathname, navigate]);
  useEffect(() => {
    if (!session) return;
    const next = takeNext();
    if (next && next !== loc.pathname) navigate(next, { replace: true });
  }, [session?.user.id]);
  return null;
}

export default function App() {
  if (!supabaseConfigured) {
    return <div className="auth"><div className="brand"><h1>Proost</h1></div>
      <div className="banner">Configuration manquante : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (fichier .env.local en local, variables d’environnement sur Vercel).</div></div>;
  }
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AuthRedirects />
          <Routes>
            <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
            <Route path="/forgot" element={<GuestOnly><AuthPage mode="forgot" /></GuestOnly>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<RequireAuth><StoreProvider><Outlet /></StoreProvider></RequireAuth>}>
              <Route element={<Layout />}>
                <Route index element={<Cave />} />
                <Route path="beer/:key" element={<BeerPage />} />
                <Route path="stats" element={<Stats />} />
                <Route path="groups" element={<Placeholder title="Groupes" text="Les groupes entre amis arrivent à l’étape 3." />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="new" element={<TastingForm />} />
              <Route path="edit/:id" element={<TastingForm key="edit" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
