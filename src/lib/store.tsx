import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { enqueue, flush, listOutbox, type OutboxEntry, type PhotoAction } from "./outbox";
import { invalidatePhoto } from "./photos";
import type { Group, Tasting } from "./types";
import { ts } from "./aggregate";

type Store = {
  loaded: boolean;
  /** Mes fiches (serveur + en attente d'envoi), de la plus récente à la plus ancienne */
  mine: Tasting[];
  groups: Group[];
  pendingCount: number;
  save: (row: Tasting, photo: { action: PhotoAction; photo?: Blob; thumb?: Blob }) => Promise<void>;
  remove: (t: Tasting) => Promise<void>;
  reloadGroups: () => Promise<void>;
};

const StoreCtx = createContext<Store | null>(null);
const cacheKey = (uid: string) => `proost-cache-${uid}`;
const readCache = (uid: string): Tasting[] => { try { return JSON.parse(localStorage.getItem(cacheKey(uid)) || "[]"); } catch { return []; } };
const writeCache = (uid: string, rows: Tasting[]) => { try { localStorage.setItem(cacheKey(uid), JSON.stringify(rows)); } catch { /* plein */ } };

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const toast = useToast();
  const uid = session!.user.id;
  const [rows, setRows] = useState<Tasting[]>(() => readCache(uid));
  const [loaded, setLoaded] = useState(() => readCache(uid).length > 0);
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const urls = useRef(new Map<string, { at: number; photo?: string; thumb?: string }>());

  const setServerRows = useCallback((fn: (r: Tasting[]) => Tasting[]) => {
    setRows(prev => { const next = fn(prev); writeCache(uid, next); return next; });
  }, [uid]);

  const refreshPending = useCallback(async () => {
    try { setPending(await listOutbox(uid)); } catch { /* IndexedDB indisponible */ }
  }, [uid]);

  const runFlush = useCallback(async () => {
    const res = await flush(uid);
    if (res.done.length) {
      setServerRows(prev => {
        let next = prev;
        for (const { entry, row } of res.done) {
          if (entry.photoAction !== "keep") invalidatePhoto(`${uid}/${entry.id}.jpg`);
          next = next.filter(t => t.id !== entry.id);
          if (row) next = [row, ...next];
        }
        return next;
      });
    }
    if (res.rejected.length) toast("Une fiche a été refusée par le serveur.");
    await refreshPending();
  }, [uid, setServerRows, refreshPending, toast]);

  const loadMine = useCallback(async () => {
    const { data, error } = await supabase.from("tastings").select("*").eq("user_id", uid).order("tasted_at", { ascending: false });
    if (!error && data) { setServerRows(() => data as Tasting[]); }
    setLoaded(true);
  }, [uid, setServerRows]);

  const reloadGroups = useCallback(async () => {
    const { data } = await supabase.from("groups").select("*").order("start_date", { ascending: false, nullsFirst: false });
    if (data) setGroups(data as Group[]);
  }, []);

  useEffect(() => {
    refreshPending().then(runFlush).then(loadMine);
    reloadGroups();
    const onOnline = () => { runFlush(); };
    const onVisible = () => { if (document.visibilityState === "visible") runFlush(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshPending, runFlush, loadMine, reloadGroups]);

  // Nouvel essai régulier tant que des fiches attendent
  useEffect(() => {
    if (!pending.length) return;
    const t = window.setInterval(() => { if (navigator.onLine) runFlush(); }, 30000);
    return () => clearInterval(t);
  }, [pending.length, runFlush]);

  // Aperçus locaux des photos en attente
  const overlay = useMemo(() => {
    const map = urls.current;
    const keep = new Set<string>();
    const out = pending.map(e => {
      keep.add(e.id);
      let u = map.get(e.id);
      if (!u || u.at !== e.at) {
        if (u) { if (u.photo) URL.revokeObjectURL(u.photo); if (u.thumb) URL.revokeObjectURL(u.thumb); }
        u = { at: e.at, photo: e.photo ? URL.createObjectURL(e.photo) : undefined, thumb: e.thumb ? URL.createObjectURL(e.thumb) : undefined };
        map.set(e.id, u);
      }
      return { e, u };
    });
    for (const [id, u] of map) if (!keep.has(id)) {
      if (u.photo) URL.revokeObjectURL(u.photo); if (u.thumb) URL.revokeObjectURL(u.thumb); map.delete(id);
    }
    return out;
  }, [pending]);

  const mine = useMemo(() => {
    const byId = new Map(rows.map(t => [t.id, t]));
    for (const { e, u } of overlay) {
      if (e.op === "delete") { byId.delete(e.id); continue; }
      const row: Tasting = { ...e.row! };
      if (e.photoAction === "set") row._pending = { photo: u.photo, thumb: u.thumb };
      if (e.photoAction === "remove") row.photo_path = null;
      byId.set(e.id, row);
    }
    return [...byId.values()].sort((a, b) => ts(b) - ts(a));
  }, [rows, overlay]);

  const save = useCallback(async (row: Tasting, photo: { action: PhotoAction; photo?: Blob; thumb?: Blob }) => {
    await enqueue({ id: row.id, uid, op: "upsert", row, photoAction: photo.action, photo: photo.photo, thumb: photo.thumb, at: Date.now() });
    await refreshPending();
    runFlush();
  }, [uid, refreshPending, runFlush]);

  const remove = useCallback(async (t: Tasting) => {
    await enqueue({ id: t.id, uid, op: "delete", photoAction: "remove", at: Date.now() });
    await refreshPending();
    runFlush();
  }, [uid, refreshPending, runFlush]);

  const pendingCount = pending.length;
  const value = useMemo(() => ({ loaded, mine, groups, pendingCount, save, remove, reloadGroups }),
    [loaded, mine, groups, pendingCount, save, remove, reloadGroups]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore hors StoreProvider");
  return v;
}
