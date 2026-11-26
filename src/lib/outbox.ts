// File d'attente locale (IndexedDB) : les fiches et leurs photos partent dès que le réseau le permet
import { supabase } from "./supabase";
import { thumbPath } from "./image";
import type { Tasting } from "./types";

export type PhotoAction = "keep" | "set" | "remove";

export type OutboxEntry = {
  id: string;
  uid: string;
  op: "upsert" | "delete";
  row?: Tasting;
  photoAction: PhotoAction;
  photo?: Blob;
  thumb?: Blob;
  at: number;
};

const DB = "proost", STORE = "outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); ok(req.result); };
    t.onerror = () => { db.close(); ko(t.error); };
  });
}

export const listOutbox = async (uid: string) =>
  (await tx<OutboxEntry[]>("readonly", s => s.getAll())).filter(e => e.uid === uid).sort((a, b) => a.at - b.at);

const getEntry = (id: string) => tx<OutboxEntry | undefined>("readonly", s => s.get(id));
const putEntry = (e: OutboxEntry) => tx("readwrite", s => s.put(e));
const delEntry = (id: string) => tx("readwrite", s => s.delete(id));

/** Ajoute une opération en fusionnant avec celle déjà en attente pour la même fiche */
export async function enqueue(e: OutboxEntry) {
  const prev = await getEntry(e.id);
  if (prev && prev.op === "upsert" && e.op === "upsert" && e.photoAction === "keep") {
    e = { ...e, photoAction: prev.photoAction, photo: prev.photo, thumb: prev.thumb };
  }
  await putEntry(e);
}

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return /failed to fetch|fetch failed|networkerror|load failed|network request failed|timeout/i.test(msg);
}

/** Envoie une opération ; lève une erreur en cas d'échec */
async function send(e: OutboxEntry): Promise<Tasting | null> {
  const path = `${e.uid}/${e.id}.jpg`;
  const bucket = supabase.storage.from("photos");
  if (e.op === "delete") {
    const { error } = await supabase.from("tastings").delete().eq("id", e.id);
    if (error) throw error;
    await bucket.remove([path, thumbPath(path)]);
    return null;
  }
  const row = { ...e.row! };
  delete row._pending; delete row.profiles;
  if (e.photoAction === "set" && e.photo && e.thumb) {
    const up = await bucket.upload(path, e.photo, { upsert: true, contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const up2 = await bucket.upload(thumbPath(path), e.thumb, { upsert: true, contentType: "image/jpeg" });
    if (up2.error) throw up2.error;
    row.photo_path = path;
  } else if (e.photoAction === "remove") {
    await bucket.remove([path, thumbPath(path)]);
    row.photo_path = null;
  }
  const { data, error } = await supabase.from("tastings").upsert(row).select().single();
  if (error) throw error;
  return data as Tasting;
}

export type FlushResult = { done: { entry: OutboxEntry; row: Tasting | null }[]; rejected: OutboxEntry[]; offline: boolean };

let flushing: Promise<FlushResult> | null = null;

/** Vide la file dans l'ordre ; s'arrête à la première coupure réseau */
export function flush(uid: string): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const res: FlushResult = { done: [], rejected: [], offline: false };
    for (const e of await listOutbox(uid)) {
      try {
        const row = await send(e);
        // Une modification a pu arriver pendant l'envoi : ne supprimer que si l'entrée n'a pas changé
        const cur = await getEntry(e.id);
        if (cur && cur.at === e.at) await delEntry(e.id);
        res.done.push({ entry: e, row });
      } catch (err) {
        if (isNetworkError(err)) { res.offline = true; break; }
        await delEntry(e.id);
        res.rejected.push(e);
      }
    }
    return res;
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Efface les données locales d'un utilisateur (déconnexion, suppression du compte) */
export async function clearLocal(uid: string) {
  try { for (const k of ["cache", "groups", "profile"]) localStorage.removeItem(`proost-${k}-${uid}`); localStorage.removeItem("proost-photo-urls"); } catch { /* */ }
  try { await caches.delete("proost-photos"); } catch { /* */ }
  try { for (const e of await listOutbox(uid)) await delEntry(e.id); } catch { /* */ }
}
