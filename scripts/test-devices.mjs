// Test de bout en bout sur iPhone et Android émulés, version de production (service worker) :
// inscription, installabilité PWA, fiche avec photo, ouverture hors ligne, fiche hors ligne puis envoi au retour du réseau.
// Prérequis : npm run build && npx vite preview --port 4173 (dans un autre terminal), Google Chrome installé.
// Usage : node --env-file=.env.local scripts/test-devices.mjs [dossier_captures]
import puppeteer, { KnownDevices } from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OUT = process.argv[2] || "test-captures";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = "http://localhost:4173";
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (label, ok) => { console.log(`  ${ok ? "✅" : "❌"} ${label}`); if (!ok) failures++; };
const PASS = "pwa-proost-1234";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const accounts = [];
try {
  // Photo de test
  const gen = await browser.newPage();
  const bytes = await gen.evaluate(async () => {
    const cv = document.createElement("canvas"); cv.width = 3000; cv.height = 4000;
    const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 3000, 4000);
    g.addColorStop(0, "#8a4a1c"); g.addColorStop(1, "#e0a040"); x.fillStyle = g; x.fillRect(0, 0, 3000, 4000);
    const b = await new Promise(r => cv.toBlob(r, "image/jpeg", .95));
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  const photoFile = `${OUT}/photo-test.jpg`;
  fs.writeFileSync(photoFile, Buffer.from(bytes));
  await gen.close();

  for (const [label, device] of [["iPhone 13", KnownDevices["iPhone 13"]], ["Android (Pixel 5)", KnownDevices["Pixel 5"]]]) {
    console.log(`\n${label}`);
    const ctx = await puppeteer.launch({ executablePath: CHROME, headless: true });
    const page = await ctx.newPage();
    await page.emulate(device);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const slug = label.replace(/[^a-z]/gi, "").toLowerCase();
    const email = `pwa-${slug}-${Date.now()}@example.com`;

    // Inscription par l'interface
    await page.goto(`${APP}/signup`, { waitUntil: "networkidle0" });
    await page.type("#aName", "Testeur"); await page.type("#aEmail", email); await page.type("#aPass", PASS);
    await page.click("button.btn");
    await page.waitForFunction(() => location.pathname === "/", { timeout: 15000 });
    const db = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data: si } = await db.auth.signInWithPassword({ email, password: PASS });
    accounts.push({ db, id: si.user.id });
    await page.waitForSelector("h2", { timeout: 15000 });
    check("Inscription et arrivée dans la cave", await page.$eval("h2", h => h.textContent) === "Ma cave");
    await page.screenshot({ path: `${OUT}/${slug}-1-cave-vide.png` });

    // PWA
    const cdp = await page.createCDPSession();
    const manifest = await cdp.send("Page.getAppManifest");
    check("Manifeste trouvé et valide", !!manifest.url && manifest.errors.length === 0);
    const inst = await cdp.send("Page.getInstallabilityErrors");
    check(`Installable (${inst.installabilityErrors.map(e => e.errorId).join(", ") || "aucune erreur"})`, inst.installabilityErrors.length === 0);
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r?.active), { timeout: 20000 });
    await page.reload({ waitUntil: "networkidle0" });
    check("Service worker actif", await page.evaluate(() => !!navigator.serviceWorker.controller));

    // Fiche avec photo (en ligne)
    await page.goto(`${APP}/new`, { waitUntil: "networkidle0" });
    const input = await page.$('input[type="file"]');
    await input.uploadFile(photoFile);
    await page.waitForSelector("img.photo-prev", { timeout: 10000 });
    await page.type("#fName", "Orval");
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${slug}-2-fiche-photo.png` });
    await page.evaluate(() => [...document.querySelectorAll("button.btn.wide")].pop().click());
    await page.waitForFunction(() => location.pathname === "/", { timeout: 10000 });
    let row = null;
    for (let i = 0; i < 20 && !row?.photo_path; i++) { await sleep(500); row = (await db.from("tastings").select("*").eq("item_name", "Orval").maybeSingle()).data; }
    check("Fiche enregistrée sur le serveur avec sa photo", !!row?.photo_path);
    const files = (await db.storage.from("photos").list(si.user.id)).data || [];
    const big = files.find(f => f.name === `${row?.id}.jpg`), thumb = files.find(f => f.name === `${row?.id}_thumb.jpg`);
    check(`Photo compressée (${Math.round((big?.metadata?.size || 0) / 1024)} Ko, l'originale faisait ${Math.round(bytes.length / 1024)} Ko) + miniature (${Math.round((thumb?.metadata?.size || 0) / 1024)} Ko)`,
      !!big && !!thumb && big.metadata.size < bytes.length && thumb.metadata.size < big.metadata.size);
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/${slug}-3-cave.png` });

    // Hors ligne : l'appli s'ouvre quand même
    await page.setOfflineMode(true);
    await page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
    await sleep(2500);
    const titles = await page.$$eval(".row .title", els => els.map(e => e.textContent));
    if (!titles.includes("Orval")) { console.log("   écran :", page.url(), JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 160))); await page.screenshot({ path: `${OUT}/${slug}-debug.png` }); }
    check("Hors ligne : l'appli s'ouvre et affiche la cave", titles.includes("Orval"));
    await page.waitForFunction(() => document.querySelector("img.thumb")?.naturalWidth > 0, { timeout: 5000 }).catch(() => {});
    check("Hors ligne : la miniature de la photo s'affiche", await page.evaluate(() => document.querySelector("img.thumb")?.naturalWidth > 0));
    console.log("   navigator.onLine =", await page.evaluate(() => navigator.onLine), "(comme un Wi-Fi de bar sans Internet)");

    // Hors ligne : nouvelle fiche, mise en file d'attente
    await page.evaluate(() => document.querySelector(".fab").click());
    await page.waitForSelector("#fName");
    await sleep(500);
    await page.type("#fName", "Duvel");
    await page.evaluate(() => [...document.querySelectorAll("button.btn.wide")].pop().click());
    await page.waitForFunction(() => location.pathname === "/", { timeout: 10000 });
    await sleep(800);
    const offlineTitles = await page.$$eval(".row .title", els => els.map(e => e.textContent));
    check("Hors ligne : la fiche apparaît tout de suite", offlineTitles.includes("Duvel"));
    await page.waitForFunction(() => document.querySelector(".banner")?.textContent.includes("1 fiche en attente"), { timeout: 6000 }).catch(() => {});
    check("Hors ligne : bandeau « Hors ligne » affiché", (await page.$eval(".banner", b => b.textContent).catch(() => "")).startsWith("Hors ligne"));
    check("Hors ligne : « 1 fiche en attente d'envoi »", (await page.$eval(".banner", b => b.textContent).catch(() => "")).includes("1 fiche en attente"));
    await page.screenshot({ path: `${OUT}/${slug}-4-hors-ligne.png` });

    // Retour du réseau : envoi automatique
    await page.setOfflineMode(false);
    let sent = false;
    for (let i = 0; i < 50 && !sent; i++) { await sleep(500); sent = !!(await db.from("tastings").select("id").eq("item_name", "Duvel").maybeSingle()).data; }
    check("Retour du réseau : la fiche part toute seule", sent);
    await sleep(1000);
    check("Retour du réseau : bandeau disparu", !(await page.$(".banner")));
    check("Aucune erreur JavaScript", errors.length === 0);
    if (errors.length) console.log("   ", errors);
    await ctx.close();
  }
} finally {
  for (const a of accounts) {
    const { data } = await a.db.storage.from("photos").list(a.id);
    if (data?.length) await a.db.storage.from("photos").remove(data.filter(f => f.id).map(f => `${a.id}/${f.name}`));
    await a.db.rpc("delete_account");
  }
  console.log(`\nComptes de test supprimés : ${accounts.length}`);
  await browser.close();
}
console.log(failures ? `${failures} échec(s)` : "Tout fonctionne.");
process.exit(failures ? 1 : 0);
