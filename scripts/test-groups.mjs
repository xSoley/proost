// Test des groupes : invitation, temps réel, code régénéré, retrait, départ, suppression.
// Usage : node --env-file=.env.local scripts/test-groups.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✅" : "❌"} ${label}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function account(name) {
  const c = client();
  const slug = name.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase();
  const email = `grp-${slug}-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: "test-grp-1234", options: { data: { display_name: name } } });
  if (error || !data.session) throw new Error(`Inscription ${name} : ${error?.message}`);
  return { c, id: data.user.id };
}
const row = (uid, gid) => ({ id: crypto.randomUUID(), user_id: uid, group_id: gid, item_name: "Kriek", item_key: "kriek", score: 70 });

const created = [];
let A, B, C;
try {
  for (const n of ["Alice", "Bob", "Chloé"]) created.push(await account(n));
  [A, B, C] = created;
  const gid = crypto.randomUUID();
  await A.c.from("groups").insert({ id: gid, name: "Bruxelles", emoji: "🇧🇪", city: "Bruxelles", start_date: "2026-12-18", end_date: "2026-12-20", created_by: A.id });
  const { data: g } = await A.c.from("groups").select("invite_code").eq("id", gid).single();

  const prev = await client().rpc("invite_preview", { code: g.invite_code });
  check("Aperçu de l'invitation sans compte", prev.data?.[0]?.name === "Bruxelles" && prev.data[0].members === 1);
  check("Mauvais code refusé", !!(await B.c.rpc("join_group", { code: "zzzzzzzz" })).error);
  await B.c.rpc("join_group", { code: g.invite_code });
  await C.c.rpc("join_group", { code: g.invite_code.toUpperCase() });
  check("Rejoindre deux fois ne crée pas de doublon", !(await B.c.rpc("join_group", { code: g.invite_code })).error);
  const { data: members } = await B.c.from("group_members").select("user_id, role, profiles(display_name)").eq("group_id", gid);
  check("Bob voit les 3 membres et leurs prénoms", members?.length === 3 && members.every(m => m.profiles?.display_name));

  // Temps réel : Bob reçoit la fiche d'Alice
  const received = [];
  const ch = B.c.channel("t").on("postgres_changes", { event: "*", schema: "public", table: "tastings", filter: `group_id=eq.${gid}` }, p => received.push(p));
  await new Promise(ok => ch.subscribe(s => { if (s === "SUBSCRIBED") ok(); }));
  await sleep(3000);
  const t = row(A.id, gid);
  await A.c.from("tastings").insert(t);
  for (let i = 0; i < 40 && !received.length; i++) await sleep(250);
  check("Temps réel : Bob reçoit la fiche d'Alice", received.some(p => p.new?.id === t.id));
  await B.c.removeChannel(ch);

  // Code régénéré
  check("Bob ne peut pas régénérer le code", !!(await B.c.rpc("regenerate_invite_code", { gid })).error);
  const { data: newCode } = await A.c.rpc("regenerate_invite_code", { gid });
  check("Alice régénère le code", typeof newCode === "string" && newCode !== g.invite_code);
  check("L'ancien code ne marche plus", ((await client().rpc("invite_preview", { code: g.invite_code })).data || []).length === 0);

  // Couverture et clôture
  const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
  const coverPath = `${A.id}/covers/${gid}.jpg`;
  await A.c.storage.from("photos").upload(coverPath, JPEG, { contentType: "image/jpeg" });
  await A.c.from("groups").update({ cover_path: coverPath }).eq("id", gid);
  check("Bob voit la couverture du groupe", !(await B.c.storage.from("photos").createSignedUrl(coverPath, 60)).error);
  check("Bob ne peut pas clôturer le groupe", ((await B.c.from("groups").update({ closed_at: new Date().toISOString() }).eq("id", gid).select()).data || []).length === 0);
  check("Alice clôture le groupe", ((await A.c.from("groups").update({ closed_at: new Date().toISOString() }).eq("id", gid).select()).data || []).length === 1);

  // Retrait et départ
  check("Bob ne peut pas retirer Chloé", ((await B.c.from("group_members").delete().eq("group_id", gid).eq("user_id", C.id).select()).data || []).length === 0);
  check("Alice ne peut pas quitter son propre groupe", ((await A.c.from("group_members").delete().eq("group_id", gid).eq("user_id", A.id).select()).data || []).length === 0);
  check("Alice retire Chloé", ((await A.c.from("group_members").delete().eq("group_id", gid).eq("user_id", C.id).select()).data || []).length === 1);
  check("Chloé ne voit plus les fiches du groupe", ((await C.c.from("tastings").select("id").eq("group_id", gid)).data || []).length === 0);
  check("Chloé ne voit plus la couverture", !!(await C.c.storage.from("photos").createSignedUrl(coverPath, 60)).error);
  check("Chloé ne peut plus noter dans le groupe", !!(await C.c.from("tastings").insert(row(C.id, gid))).error);
  const bt = row(B.id, gid);
  await B.c.from("tastings").insert(bt);
  check("Bob quitte le groupe", ((await B.c.from("group_members").delete().eq("group_id", gid).eq("user_id", B.id).select()).data || []).length === 1);
  check("Bob voit toujours sa propre fiche", ((await B.c.from("tastings").select("id").eq("id", bt.id)).data || []).length === 1);

  // Suppression du groupe : les fiches repassent en Perso
  await A.c.storage.from("photos").remove([coverPath]);
  await A.c.from("groups").delete().eq("id", gid);
  const { data: after } = await A.c.from("tastings").select("group_id").eq("id", t.id).single();
  check("Groupe supprimé : la fiche d'Alice repasse en Perso", after?.group_id === null);
} finally {
  for (const u of created) await u.c.rpc("delete_account");
  console.log("Comptes de test supprimés.");
}
console.log(failures ? `\n${failures} échec(s)` : "\nTout fonctionne.");
process.exit(failures ? 1 : 0);
