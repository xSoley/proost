// Utilitaires repris du prototype
export const PALETTE = ["#3E6B38", "#B5651D", "#7A3B69", "#2F5D8A", "#A8323E", "#5B6B1F", "#8A5A2B", "#3D7A78"];

export const norm = (s: unknown) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const num = (v: unknown) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
export const fmt = (n: number, d = 0) =>
  Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const hash = (s: string) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
export const avatarColor = (uid: string) => PALETTE[hash(uid) % PALETTE.length];
export const initials = (n: string | null | undefined) => (String(n || "?").trim()[0] || "?").toUpperCase();

export const timeAgo = (ts: number) => {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "à l’instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return new Date(ts).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
};

/** UUID v4 (crypto.randomUUID n'existe pas hors HTTPS, ex. test sur téléphone en réseau local) */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Date locale au format attendu par <input type="datetime-local"> */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const todayISO = () => toLocalInput(new Date()).slice(0, 10);

/** Groupe « en cours » : ses dates encadrent aujourd'hui */
export function isCurrentGroup(g: { start_date: string | null; end_date: string | null; closed_at: string | null }) {
  const d = todayISO();
  return !g.closed_at && !!g.start_date && g.start_date <= d && (!g.end_date || d <= g.end_date);
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("fr-FR", opts);
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
