import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { useAuth } from "../auth/AuthProvider";
import type { Group, Tasting } from "./types";
import { fmtDate, isCurrentGroup, todayISO } from "./utils";

/** « du 18 au 20 décembre », « le 3 mai 2026 »… */
export function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const d = (s: string) => new Date(s + "T12:00:00");
  const a = d(start), b = end ? d(end) : null;
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const year = a.getFullYear() !== new Date().getFullYear() ? ` ${a.getFullYear()}` : "";
  if (!b || start === end) return `le ${a.toLocaleDateString("fr-FR", full)}${year}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `du ${a.getDate()} au ${b.toLocaleDateString("fr-FR", full)}${year}`;
  return `du ${a.toLocaleDateString("fr-FR", full)} au ${b.toLocaleDateString("fr-FR", full)}${b.getFullYear() !== new Date().getFullYear() ? ` ${b.getFullYear()}` : ""}`;
}

/** « Bruxelles, du 18 au 20 décembre » ; sans dates : « depuis le 26 novembre 2026 » */
export const groupSubtitle = (g: Pick<Group, "city" | "start_date" | "end_date"> & { created_at?: string }) =>
  [g.city, g.start_date ? fmtRange(g.start_date, g.end_date) : g.created_at ? `depuis le ${fmtDate(g.created_at, { day: "numeric", month: "long", year: "numeric" })}` : ""]
    .filter(Boolean).join(", ");

export type GroupStatus = "current" | "upcoming" | "past";
export function groupStatus(g: Group): GroupStatus {
  const d = todayISO();
  if (g.closed_at || (g.end_date && g.end_date < d)) return "past";
  if (g.start_date && g.start_date > d) return "upcoming";
  return "current";
}

/** Un groupe clôturé n'accepte plus de nouvelles fiches (le récap, lui, est toujours accessible) */
export const isOpen = (g: Pick<Group, "closed_at">) => !g.closed_at;

// Groupe proposé par défaut dans une nouvelle fiche
const lastKey = (uid: string) => `proost-last-group-${uid}`;
export function rememberGroup(uid: string, gid: string) {
  try { localStorage.setItem(lastKey(uid), gid); } catch { /* */ }
}
/** Un week-end en cours (dates qui encadrent aujourd'hui), sinon le dernier groupe utilisé s'il est ouvert, sinon Perso ("") */
export function defaultGroupId(groups: Group[], uid: string): string {
  const current = groups.find(isCurrentGroup);
  if (current) return current.id;
  let last: string | null = null;
  try { last = localStorage.getItem(lastKey(uid)); } catch { /* */ }
  return last && groups.some(g => g.id === last && isOpen(g)) ? last : "";
}

export const inviteUrl = (code: string) => `${window.location.origin}/join/${code}`;

export type Member = { user_id: string; role: "owner" | "member"; joined_at: string; profiles: { display_name: string } | null };

/** Fiches d'un groupe, mises à jour en temps réel ; mes fiches en attente d'envoi apparaissent tout de suite */
export function useGroupTastings(gid: string) {
  const { mine } = useStore();
  const { session, profile } = useAuth();
  const uid = session!.user.id;
  const [server, setServer] = useState<Tasting[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("tastings").select("*, profiles(display_name)")
      .eq("group_id", gid).order("tasted_at", { ascending: false });
    if (data) setServer(data as Tasting[]);
  }, [gid]);

  useEffect(() => {
    load();
    let timer: number | undefined;
    const reload = () => { clearTimeout(timer); timer = window.setTimeout(load, 300); };
    const ch = supabase.channel(`group-${gid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tastings", filter: `group_id=eq.${gid}` }, reload)
      // Les suppressions ne sont pas filtrables côté serveur
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tastings" }, reload)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); supabase.removeChannel(ch); document.removeEventListener("visibilitychange", onVisible); };
  }, [gid, load]);

  const tastings = useMemo(() => {
    if (!server) return null;
    // Mes fiches : la version locale fait foi (modifications, suppressions et envois en attente)
    const me = profile ? { display_name: profile.display_name } : null;
    const myOwn = mine.filter(t => t.group_id === gid).map(t => ({ ...t, profiles: me }));
    return [...server.filter(t => t.user_id !== uid), ...myOwn].sort((a, b) => b.tasted_at.localeCompare(a.tasted_at));
  }, [server, mine, gid, uid, profile]);

  return { tastings, reload: load };
}
