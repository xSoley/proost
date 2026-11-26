import { avatarColor, initials } from "../lib/utils";

export function Avatar({ uid, name, size }: { uid: string; name: string | null | undefined; size?: number }) {
  const style: React.CSSProperties = { background: avatarColor(uid) };
  if (size) Object.assign(style, { width: size, height: size, fontSize: Math.round(size * 0.42) });
  return <span className="avatar" style={style}>{initials(name)}</span>;
}
