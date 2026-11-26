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
