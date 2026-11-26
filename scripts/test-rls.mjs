// Test des règles de sécurité avec deux comptes jetables (supprimés à la fin).
// Usage : node --env-file=.env.local scripts/test-rls.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✅" : "❌"} ${label}`); if (!ok) failures++; };

async function account(name) {
  const c = client();
  const email = `rls-${name.toLowerCase()}-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: "test-rls-1234", options: { data: { display_name: name } } });
  if (error || !data.session) throw new Error(`Inscription ${name} : ${error?.message || "pas de session (confirmation e-mail activée ?)"}`);
  return { c, id: data.user.id };
}
const row = (uid, extra) => ({ id: crypto.randomUUID(), user_id: uid, item_name: "Orval", item_key: "orval", score: 80, ...extra });

const A = await account("Alice");
const B = await account("Bob");
try {
  // Alice crée un groupe, Bob le rejoint avec le code
  const gid = crypto.randomUUID();
  check("Alice crée un groupe", !(await A.c.from("groups").insert({ id: gid, name: "Test RLS", created_by: A.id })).error);
  const { data: g } = await A.c.from("groups").select("invite_code").eq("id", gid).single();
  check("Bob ne voit pas le groupe avant d'y entrer", ((await B.c.from("groups").select("id").eq("id", gid)).data || []).length === 0);
  check("Bob ne peut pas s'ajouter lui-même sans code", !!(await B.c.from("group_members").insert({ group_id: gid, user_id: B.id })).error);
  check("Bob rejoint avec le code", (await B.c.rpc("join_group", { code: g.invite_code })).data === gid);

  // Fiches d'Alice : une perso, une dans le groupe, avec photo
  const perso = row(A.id, { photo_path: null });
  const grp = row(A.id, { group_id: gid });
  perso.photo_path = `${A.id}/${perso.id}.jpg`;
  grp.photo_path = `${A.id}/${grp.id}.jpg`;
  for (const t of [perso, grp]) {
    check(`Alice envoie la photo ${t.group_id ? "de groupe" : "perso"}`, !(await A.c.storage.from("photos").upload(t.photo_path, JPEG, { contentType: "image/jpeg" })).error);
    check(`Alice crée la fiche ${t.group_id ? "de groupe" : "perso"}`, !(await A.c.from("tastings").insert(t)).error);
  }

  const seen = ((await B.c.from("tastings").select("id")).data || []).map(t => t.id);
  check("Bob voit la fiche de groupe d'Alice", seen.includes(grp.id));
  check("Bob ne voit PAS la fiche perso d'Alice", !seen.includes(perso.id));
  check("Bob voit le prénom d'Alice", ((await B.c.from("profiles").select("display_name").eq("id", A.id)).data || [])[0]?.display_name === "Alice");

  const upd = await B.c.from("tastings").update({ score: 1 }).eq("id", grp.id).select();
  check("Bob ne peut pas modifier la fiche d'Alice", (upd.data || []).length === 0);
  const del = await B.c.from("tastings").delete().eq("id", grp.id).select();
  check("Bob ne peut pas supprimer la fiche d'Alice", (del.data || []).length === 0);
  check("Bob ne peut pas créer une fiche au nom d'Alice", !!(await B.c.from("tastings").insert(row(A.id))).error);
  check("Bob ne peut pas rattacher une fiche à un groupe dont il n'est pas membre",
    !!(await B.c.from("tastings").insert(row(B.id, { group_id: crypto.randomUUID() }))).error);

  check("Bob peut afficher la photo de groupe d'Alice", !(await B.c.storage.from("photos").createSignedUrl(grp.photo_path, 60)).error);
  check("Bob ne peut PAS afficher la photo perso d'Alice", !!(await B.c.storage.from("photos").createSignedUrl(perso.photo_path, 60)).error);
  check("Bob ne peut pas écrire dans le dossier d'Alice", !!(await B.c.storage.from("photos").upload(`${A.id}/pirate.jpg`, JPEG, { contentType: "image/jpeg" })).error);
  check("Bob ne peut pas écraser la photo d'Alice", !!(await B.c.storage.from("photos").upload(grp.photo_path, JPEG, { contentType: "image/jpeg", upsert: true })).error);

  const anon = client();
  check("Un visiteur non connecté ne voit aucune fiche", ((await anon.from("tastings").select("id")).data || []).length === 0);
  check("Bob ne peut pas modifier le groupe d'Alice", ((await B.c.from("groups").update({ name: "Pirate" }).eq("id", gid).select()).data || []).length === 0);
} finally {
  // Nettoyage
  for (const u of [A, B]) {
    const { data } = await u.c.storage.from("photos").list(u.id);
    if (data?.length) await u.c.storage.from("photos").remove(data.map(f => `${u.id}/${f.name}`));
    await u.c.rpc("delete_account");
  }
  console.log("Comptes de test supprimés.");
}
console.log(failures ? `\n${failures} échec(s)` : "\nToutes les règles tiennent.");
process.exit(failures ? 1 : 0);
