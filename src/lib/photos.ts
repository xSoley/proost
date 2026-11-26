// URL signées du bucket privé « photos », mises en cache et demandées par lots
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const TTL = 3600; // secondes
const cache = new Map<string, { url: string; exp: number }>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let timer: number | undefined;

function fresh(path: string) {
  const c = cache.get(path);
  return c && c.exp > Date.now() ? c.url : null;
}

async function run() {
  timer = undefined;
  const batch = new Map(waiting);
  waiting.clear();
  const paths = [...batch.keys()];
  const { data } = await supabase.storage.from("photos").createSignedUrls(paths, TTL);
  const byPath = new Map((data || []).map(d => [d.path, d.signedUrl]));
  for (const p of paths) {
    const url = byPath.get(p) || null;
    if (url) cache.set(p, { url, exp: Date.now() + (TTL - 120) * 1000 });
    batch.get(p)!.forEach(cb => cb(url));
  }
}

export function signedUrl(path: string): Promise<string | null> {
  const f = fresh(path);
  if (f) return Promise.resolve(f);
  return new Promise(ok => {
    if (!waiting.has(path)) waiting.set(path, []);
    waiting.get(path)!.push(ok);
    if (!timer) timer = window.setTimeout(run, 0);
  });
}

/** À appeler après remplacement d'une photo, pour ne pas réafficher l'ancienne */
export function invalidatePhoto(path: string) {
  cache.delete(path);
  cache.delete(path.replace(/\.jpg$/, "_thumb.jpg"));
}

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? fresh(path) : null));
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let alive = true;
    setUrl(fresh(path));
    signedUrl(path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  return url;
}
