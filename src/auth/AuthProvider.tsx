import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Profile = { id: string; display_name: string; created_at: string };

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Vrai quand on arrive depuis le lien « mot de passe oublié » */
  recovery: boolean;
  clearRecovery: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    const key = `proost-profile-${uid}`;
    // Profil en cache d'abord (ouverture hors ligne), puis mise à jour depuis le serveur
    try { const cached = localStorage.getItem(key); if (cached) setProfile(JSON.parse(cached)); } catch { /* */ }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) { setProfile(data as Profile); try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* */ } }
    else if (!error) setProfile(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      // sans attendre le réseau : hors ligne, l'appli s'ouvre avec le profil en cache
      loadProfile(data.session?.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // hors du callback pour ne pas bloquer le client Supabase
        setTimeout(() => loadProfile(s?.user.id), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session]);

  return (
    <AuthCtx.Provider value={{ session, profile, loading, recovery, clearRecovery: () => setRecovery(false), refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth hors AuthProvider");
  return v;
}

/** Après connexion, retourne à la page demandée (ex. lien d'invitation) */
const NEXT_KEY = "proost-next";
export const setNext = (path: string) => { try { localStorage.setItem(NEXT_KEY, path); } catch { /* */ } };
export const takeNext = () => {
  try { const v = localStorage.getItem(NEXT_KEY); localStorage.removeItem(NEXT_KEY); return v && v.startsWith("/") ? v : null; }
  catch { return null; }
};
