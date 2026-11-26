import { useId, type CSSProperties } from "react";

const BOWL = "M13 8 C10 30 9 44 16 55 C20 61 26 64 30 65 C34 64 40 61 44 55 C51 44 50 30 47 8 Z";

/** Verre tulipe qui se remplit selon la note (rise : le liquide monte quand un parent .reveal reçoit .in) */
export function Glass({ score, color, h = 64, rise = false }: { score: number; color: string; h?: number; rise?: boolean }) {
  const id = "g" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const s = Math.max(0, Math.min(100, score || 0));
  const top = 9, bottom = 64;
  const y = bottom - (s / 100) * (bottom - top);
  return (
    <svg width={h * 0.6} height={h} viewBox="0 0 60 100" aria-hidden="true">
      <defs><clipPath id={id}><path d={BOWL} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <g className={rise ? "rise" : undefined} style={rise ? { "--rise": `${bottom - y + 8}px` } as CSSProperties : undefined}>
        <rect x="0" y={y} width="60" height={bottom - y + 4} fill={color} />
        {s > 0 && <rect x="0" y={y - 5} width="60" height="6" rx="2" fill="var(--foam)" />}
        {s > 0 && <>
          <circle cx="24" cy={Math.min(bottom - 6, y + 12)} r="1.2" fill="#fff" opacity=".55" />
          <circle cx="34" cy={Math.min(bottom - 4, y + 22)} r="1" fill="#fff" opacity=".5" />
        </>}
        </g>
      </g>
      <path d={BOWL} fill="none" stroke="var(--glass)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M30 65 V85 M19 91 H41 M30 85 C26 87 21 88 19 91 M30 85 C34 87 39 88 41 91" fill="none" stroke="var(--glass)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
