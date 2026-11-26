// Cas limite : Bob note hors ligne dans un groupe, Alice le clôture avant que la fiche parte.
// Attendu : au retour du réseau, la fiche est gardée en Perso (pas perdue) et Bob est prévenu.
// Prérequis : npm run build && npx vite preview --port 4173, Google Chrome installé.
// Usage : node --env-file=.env.local scripts/test-offline-closed.mjs
import puppeteer, { KnownDevices } from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = "http://localhost:4173";
const PASS = "offline-closed-1234";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✅" : "❌"} ${label}`); if (!ok) failures++; };

async function account(name) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `offclosed-${name.toLowerCase()}-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: PASS, options: { data: { display_name: name } } });
  if (error) throw error;
  return { c, id: data.user.id, email };
}

const accounts = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const A = await account("Alice"); accounts.push(A);
  const B = await account("Bob"); accounts.push(B);
  const gid = crypto.randomUUID();
  await A.c.from("groups").insert({ id: gid, name: "Les potes", emoji: "🍻", created_by: A.id });
  const { data: g } = await A.c.from("groups").select("invite_code").eq("id", gid).single();
  await B.c.rpc("join_group", { code: g.invite_code });

  // Bob se connecte sur son téléphone
  const page = await browser.newPage();
  await page.emulate(KnownDevices["iPhone 13"]);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${APP}/login`, { waitUntil: "networkidle0" });
  await page.type("#aEmail", B.email); await page.type("#aPass", PASS);
  await page.click("button.btn");
  await page.waitForFunction(() => location.pathname === "/", { timeout: 15000 });
  await page.waitForSelector("h2", { timeout: 15000 });

  // Il ouvre la fiche depuis le groupe : le groupe est présélectionné
  await page.goto(`${APP}/new?group=${gid}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#fName");
  await sleep(600);
  const selected = await page.$$eval('.chip[aria-pressed="true"]', els => els.map(e => e.textContent));
  check("Le groupe « Les potes » est présélectionné", selected.some(t => t.includes("Les potes")));

  // Plus de réseau, il note quand même
  await page.setOfflineMode(true);
  await page.type("#fName", "Kriek Boon");
  await page.evaluate(() => [...document.querySelectorAll("button.btn.wide")].pop().click());
  await page.waitForFunction(() => location.pathname === "/", { timeout: 10000 });
  await sleep(1500);
  check("Hors ligne : la fiche apparaît dans sa cave", (await page.$$eval(".row .title", els => els.map(e => e.textContent))).includes("Kriek Boon"));
  check("Hors ligne : rien n'est encore arrivé sur le serveur", !(await B.c.from("tastings").select("id").eq("item_name", "Kriek Boon").maybeSingle()).data);

  // Pendant ce temps, Alice clôture le groupe
  check("Alice clôture le groupe pendant que Bob est hors ligne",
    ((await A.c.from("groups").update({ closed_at: new Date().toISOString() }).eq("id", gid).select()).data || []).length === 1);

  // On enregistre les messages affichés à Bob
  await page.evaluate(() => {
    window.__toasts = [];
    const t = document.querySelector(".toast");
    new MutationObserver(() => { if (t.textContent) window.__toasts.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true });
  });

  // Le réseau revient
  await page.setOfflineMode(false);
  let row = null;
  for (let i = 0; i < 50 && !row; i++) { await sleep(500); row = (await B.c.from("tastings").select("*").eq("item_name", "Kriek Boon").maybeSingle()).data; }
  check("Retour du réseau : la fiche est bien arrivée sur le serveur (pas perdue)", !!row);
  check("Elle est gardée en Perso (pas dans le groupe clôturé)", row?.group_id === null);
  check("Elle n'apparaît pas dans le groupe pour Alice", ((await A.c.from("tastings").select("id").eq("group_id", gid)).data || []).length === 0);
  await sleep(800);
  const toasts = await page.evaluate(() => window.__toasts);
  check("Bob est prévenu (« … gardée en Perso »)", toasts.some(t => t.includes("gardée en Perso")));
  check("Pas de message « refusée par le serveur »", !toasts.some(t => t.includes("refusée")));
  await sleep(1500);
  check("Le bandeau d'attente a disparu", !(await page.$(".banner")));
  check("La fiche est toujours dans sa cave", (await page.$$eval(".row .title", els => els.map(e => e.textContent))).includes("Kriek Boon"));
  check("Aucune erreur JavaScript", errors.length === 0);
  if (errors.length) console.log(errors);
  if (toasts.length) console.log("Messages affichés :", toasts);
} finally {
  for (const a of accounts) await a.c.rpc("delete_account");
  await browser.close();
  console.log("Comptes de test supprimés :", accounts.length);
}
console.log(failures ? `\n${failures} échec(s)` : "\nTout fonctionne.");
process.exit(failures ? 1 : 0);
