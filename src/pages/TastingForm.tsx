import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { beer as cat } from "../categories/beer";
import { computeScore } from "../categories/types";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../lib/store";
import { useToast } from "../components/Toast";
import { Glass } from "../components/Glass";
import { Photo } from "../components/Photo";
import { colorOf, p33Of } from "../lib/aggregate";
import { compressPhoto } from "../lib/image";
import type { PhotoAction } from "../lib/outbox";
import type { Tasting } from "../lib/types";
import { fmt, isCurrentGroup, norm, num, toLocalInput, uuid } from "../lib/utils";

type FormState = {
  name: string; producer: string; abv: string; style: string; color: string;
  attrs: Record<string, string | string[]>;
  scores: Record<string, number>;
  again: boolean; place: string; ambiance: number; price: string; volume: number; comment: string;
  when: string; group: string;
};

function blank(): FormState {
  const attrs: FormState["attrs"] = {};
  for (const [k, a] of Object.entries(cat.attributes)) attrs[k] = a.multi ? [] : "";
  return {
    name: "", producer: "", abv: "", style: "", color: "dore", attrs,
    scores: Object.fromEntries(cat.criteria.map(c => [c.k, 5])),
    again: false, place: "", ambiance: 0, price: "", volume: 33, comment: "",
    when: toLocalInput(new Date()), group: ""
  };
}

function fromTasting(t: Tasting): FormState {
  const b = blank();
  for (const k of Object.keys(b.attrs)) {
    const v = t.attributes?.[k];
    if (Array.isArray(b.attrs[k])) b.attrs[k] = Array.isArray(v) ? (v as string[]) : [];
    else b.attrs[k] = typeof v === "string" ? v : "";
  }
  return {
    ...b, name: t.item_name, producer: t.producer || "", abv: t.abv != null ? fmt(t.abv, 1) : "",
    style: t.style || "", color: t.color || "dore",
    scores: { ...b.scores, ...t.scores }, again: t.again, place: t.place || "", ambiance: t.ambiance || 0,
    price: t.price != null ? fmt(t.price, 2) : "", volume: num(t.volume_cl) || 33, comment: t.comment || "",
    when: toLocalInput(new Date(t.tasted_at)), group: t.group_id || ""
  };
}

type PhotoState = { action: PhotoAction; preview?: string; photo?: Blob; thumb?: Blob; busy?: boolean };

export function TastingForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useAuth();
  const { mine, groups, save, loaded } = useStore();
  const uid = session!.user.id;
  const existing = id ? mine.find(t => t.id === id && t.user_id === uid) || null : null;

  const [f, setF] = useState<FormState>(() => {
    if (existing) return fromTasting(existing);
    const b = blank();
    b.name = params.get("name") || "";
    const g = params.get("group");
    b.group = g ?? (groups.find(isCurrentGroup)?.id || "");
    return b;
  });
  const [ph, setPh] = useState<PhotoState>({ action: "keep" });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const touchedGroup = useRef(!!existing || params.has("group"));

  // La fiche à modifier peut arriver après le premier rendu (chargement)
  const loadedId = useRef<string | null>(existing?.id || null);
  useEffect(() => {
    if (existing && loadedId.current !== existing.id) { loadedId.current = existing.id; setF(fromTasting(existing)); }
  }, [existing]);
  // Groupe en cours par défaut, une fois les groupes chargés
  useEffect(() => {
    if (touchedGroup.current) return;
    const g = groups.find(isCurrentGroup);
    if (g) setF(s => ({ ...s, group: g.id }));
  }, [groups]);

  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => { if (!id && !params.get("name")) nameRef.current?.focus({ preventScroll: true }); }, 340);
    return () => { cancelAnimationFrame(r); clearTimeout(t); document.body.style.overflow = ""; };
  }, [id, params]);
  useEffect(() => () => { if (ph.preview) URL.revokeObjectURL(ph.preview); }, [ph.preview]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => { if (window.history.state?.idx > 0) navigate(-1); else navigate("/", { replace: true }); }, 280);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const names = useMemo(() => [...new Set(mine.map(t => t.item_name))], [mine]);
  const places = useMemo(() => [...new Set(mine.map(t => t.place).filter(Boolean) as string[])], [mine]);
  const score = computeScore(cat, f.scores);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(s => ({ ...s, [k]: v }));

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPh(p => ({ ...p, busy: true }));
    try {
      const { photo, thumb } = await compressPhoto(file);
      setPh({ action: "set", photo, thumb, preview: URL.createObjectURL(photo) });
    } catch {
      setPh(p => ({ ...p, busy: false }));
      toast("Impossible de lire cette photo.");
    }
  }

  const hasExistingPhoto = !!existing && !!(existing.photo_path || existing._pending?.photo);
  const showPhoto = ph.action === "set" ? "new" : ph.action === "keep" && hasExistingPhoto ? "old" : null;

  async function submit() {
    const name = f.name.trim();
    if (!name) { nameRef.current?.focus(); toast("Donne un nom à la bière."); return; }
    const when = new Date(f.when);
    setSaving(true);
    const row: Tasting = {
      id: existing?.id || uuid(),
      user_id: uid,
      group_id: f.group || null,
      category: cat.key,
      item_name: name,
      item_key: norm(name),
      producer: f.producer.trim() || null,
      style: f.style || null,
      abv: num(f.abv) || null,
      color: f.color,
      attributes: f.attrs,
      scores: f.scores,
      score,
      again: f.again,
      place: f.place.trim() || null,
      ambiance: f.ambiance,
      price: num(f.price) || null,
      volume_cl: f.volume || 33,
      currency: "EUR",
      comment: f.comment.trim() || null,
      photo_path: existing?.photo_path ?? null,
      tasted_at: (isNaN(when.getTime()) ? new Date() : when).toISOString(),
      ...(existing?.created_at ? { created_at: existing.created_at } : {})
    };
    try {
      await save(row, { action: ph.action, photo: ph.photo, thumb: ph.thumb });
      toast(`${name} : ${score}/100, proost !`);
      setOpen(false);
      window.setTimeout(() => {
        if (existing) navigate(-1);
        else navigate("/", { replace: true });
      }, 280);
    } catch {
      setSaving(false);
      toast("Enregistrement impossible, réessaie dans un instant.");
    }
  }

  if (id && loaded && !existing) {
    return <div className="sheet open"><div className="form"><div className="empty"><b>Fiche introuvable</b><p>Elle a peut-être été supprimée.</p>
      <button className="btn" onClick={() => navigate("/", { replace: true })}>Retour à ma cave</button></div></div></div>;
  }

  const chipGroup = (key: string, options: string[], multi: boolean) => (
    <div className="chips" role="group">{options.map(o => {
      const cur = f.attrs[key];
      const on = multi ? (cur as string[]).includes(o) : cur === o;
      return <button key={o} type="button" className="chip" aria-pressed={on} onClick={() => {
        const next = multi ? (on ? (cur as string[]).filter(x => x !== o) : [...(cur as string[]), o]) : (on ? "" : o);
        setF(s => ({ ...s, attrs: { ...s.attrs, [key]: next } }));
      }}>{o}</button>;
    })}</div>
  );
  const slider = (i: number) => {
    const c = cat.criteria[i], v = f.scores[c.k];
    return (
      <div className="slider"><div className="lab"><b>{c.n}<small>{c.w} % de la note</small></b><output>{fmt(v, 1)}</output></div>
        <input type="range" min="0" max="10" step="0.5" value={v} style={{ "--p": `${v * 10}%` } as CSSProperties} aria-label={`${c.n}, note sur 10`}
          onChange={e => setF(s => ({ ...s, scores: { ...s.scores, [c.k]: parseFloat(e.target.value) } }))} />
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{c.h}</div></div>
    );
  };
  const price = num(f.price), vol = f.volume;
  const fake = { price, volume_cl: vol } as Tasting;
  const p33 = p33Of(fake);

  return (
    <section className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-label="Fiche de dégustation">
      <div className="sheet-head"><div className="sheet-head-in">
        <button className="x" onClick={close} aria-label="Fermer">×</button>
        <div style={{ fontWeight: 700 }}>{existing ? "Modifier la fiche" : "Nouvelle dégustation"}</div>
        <div className="live"><span><Glass score={score} color={colorOf(cat, f.color)} h={44} /></span><div><b>{score}</b><small>sur 100</small></div></div>
      </div></div>
      <div className="form">
        <div className="sec"><h3>Le moment</h3><p className="hint">Une photo pour t’en souvenir, et c’était quand.</p>
          <input ref={fileRef} type="file" accept="image/*" className="sr" tabIndex={-1} aria-hidden="true"
            onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          {showPhoto ? (
            <div className="photo-box">
              {showPhoto === "new" ? <img className="photo-prev" src={ph.preview} alt="Photo du moment" /> : <Photo t={existing!} className="photo-prev" alt="Photo du moment" />}
              <div className="acts">
                <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Changer</button>
                <button type="button" className="ghost danger" onClick={() => setPh({ action: hasExistingPhoto ? "remove" : "keep" })}>Retirer</button>
              </div>
            </div>
          ) : (
            <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()} disabled={ph.busy}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <span>{ph.busy ? "Préparation de la photo…" : "Prendre ou choisir une photo"}</span>
            </button>
          )}
          <label className="f" htmlFor="fWhen">Date et heure</label>
          <input className="in" id="fWhen" type="datetime-local" value={f.when} onChange={e => set("when", e.target.value)} />
          <label className="f">Groupe</label>
          <div className="chips" role="group">
            <button type="button" className="chip" aria-pressed={!f.group} onClick={() => { touchedGroup.current = true; set("group", ""); }}>Perso</button>
            {groups.map(g => <button key={g.id} type="button" className="chip" aria-pressed={f.group === g.id}
              onClick={() => { touchedGroup.current = true; set("group", g.id); }}>{g.emoji} {g.name}</button>)}
          </div>
          {!f.group && <p className="hint" style={{ margin: "8px 0 0" }}>Fiche perso : visible par toi seul.</p>}
        </div>

        <div className="sec"><h3>La bière</h3><p className="hint">Reprends le nom exact pour que vos notes se regroupent au classement.</p>
          <label className="f" htmlFor="fName">Nom</label>
          <input ref={nameRef} className="in" id="fName" list="dlNames" placeholder="Westvleteren 12, Orval, Cantillon Gueuze…" value={f.name} autoComplete="off" onChange={e => set("name", e.target.value)} />
          <datalist id="dlNames">{names.map(n => <option key={n} value={n} />)}</datalist>
          <div className="two"><div><label className="f" htmlFor="fBrew">Brasserie</label><input className="in" id="fBrew" placeholder="Cantillon" value={f.producer} onChange={e => set("producer", e.target.value)} /></div>
            <div><label className="f" htmlFor="fAbv">Degré (%)</label><input className="in" id="fAbv" inputMode="decimal" placeholder="8,5" value={f.abv} onChange={e => set("abv", e.target.value)} /></div></div>
          <label className="f">Style</label>
          <div className="chips" role="group">{cat.styles.map(s => <button key={s} type="button" className="chip" aria-pressed={f.style === s} onClick={() => set("style", f.style === s ? "" : s)}>{s}</button>)}</div>
        </div>

        <div className="sec"><h3>L’œil</h3><p className="hint">Incline le verre devant la lumière.</p>
          <label className="f">Couleur</label>
          <div className="swatches" role="group">{cat.colors.map(c => <button key={c.k} type="button" className="sw" aria-pressed={f.color === c.k} onClick={() => set("color", c.k)}><i style={{ background: c.c }} />{c.n}</button>)}</div>
          <label className="f">Mousse</label>{chipGroup("foam", cat.attributes.foam.options, false)}
          <label className="f">Limpidité</label>{chipGroup("clarity", cat.attributes.clarity.options, false)}
          {slider(0)}
        </div>

        <div className="sec"><h3>Le nez</h3><p className="hint">Fais tourner, approche, inspire deux fois. Coche tout ce que tu reconnais.</p>
          {chipGroup("aromas", cat.attributes.aromas.options, true)}
          {slider(1)}
        </div>

        <div className="sec"><h3>La bouche</h3><p className="hint">Garde la gorgée quelques secondes avant d’avaler.</p>
          <label className="f">Saveurs dominantes</label>{chipGroup("flavors", cat.attributes.flavors.options, true)}
          <label className="f">Finale</label>{chipGroup("finish", cat.attributes.finish.options, false)}
          {slider(2)}
        </div>

        <div className="sec"><h3>La texture</h3>
          <label className="f">Corps</label>{chipGroup("body", cat.attributes.body.options, false)}
          <label className="f">Pétillance</label>{chipGroup("fizz", cat.attributes.fizz.options, false)}
          {slider(3)}
        </div>

        <div className="sec"><h3>Le verdict</h3>
          {slider(4)}
          <div className="toggle"><span>J’en reprendrais une</span><button type="button" className="switch" role="switch" aria-checked={f.again} aria-label="J’en reprendrais une" onClick={() => set("again", !f.again)} /></div>
        </div>

        <div className="sec"><h3>Le lieu</h3>
          <label className="f" htmlFor="fPlace">Bar ou endroit</label>
          <input className="in" id="fPlace" list="dlPlaces" placeholder="Délirium Café, Moeder Lambic, À la Mort Subite…" value={f.place} autoComplete="off" onChange={e => set("place", e.target.value)} />
          <datalist id="dlPlaces">{places.map(n => <option key={n} value={n} />)}</datalist>
          <label className="f">Ambiance du lieu</label>
          <div className="stars" role="radiogroup" aria-label="Ambiance sur 5">{[1, 2, 3, 4, 5].map(i =>
            <button key={i} type="button" className={"star" + (f.ambiance >= i ? " on" : "")} role="radio" aria-checked={f.ambiance === i} aria-label={`${i} sur 5`}
              onClick={() => set("ambiance", f.ambiance === i ? 0 : i)}>★</button>)}</div>
        </div>

        <div className="sec"><h3>Le prix</h3>
          <div className="two"><div><label className="f" htmlFor="fPrice">Prix payé (€)</label><input className="in" id="fPrice" inputMode="decimal" placeholder="5,50" value={f.price} onChange={e => set("price", e.target.value)} /></div>
            <div><label className="f">Contenance</label>
              <div className="chips" role="group">{cat.volumes.map(v => <button key={v} type="button" className="chip" aria-pressed={f.volume === v} onClick={() => set("volume", f.volume === v ? 33 : v)}>{v} cl</button>)}</div></div></div>
          <div className="calc">
            {p33 != null
              ? <>Soit <b>{fmt(price / vol * 100, 2)} € le litre</b> et <b>{fmt(score / p33, 1)} points par euro</b> (ramené à 33 cl), le critère du classement qualité/prix.</>
              : "Indique le prix pour entrer dans le classement qualité/prix."}
          </div>
        </div>

        <div className="sec"><h3>Ton mot</h3>
          <textarea className="in" maxLength={280} placeholder="Ce qui t’a marqué, l’accord avec les frites, le serveur…" value={f.comment} onChange={e => set("comment", e.target.value)} />
        </div>

        <button className="btn wide" disabled={saving || ph.busy} onClick={submit}>
          {saving ? "Enregistrement…" : existing ? "Enregistrer les modifications" : "Ajouter au carnet"}</button>
      </div>
    </section>
  );
}
