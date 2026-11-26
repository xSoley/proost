import { Link } from "react-router-dom";
import type { Tasting } from "../lib/types";
import { useStore } from "../lib/store";
import { fmt, fmtDateTime, num } from "../lib/utils";
import { Avatar } from "./Avatar";
import { Photo } from "./Photo";

/** Une dégustation, dans le style des « entry » du prototype */
export function Entry({ t, author, actions, onDelete, showPhoto = true }: {
  t: Tasting;
  author?: boolean;
  actions?: boolean;
  onDelete?: (t: Tasting) => void;
  showPhoto?: boolean;
}) {
  const { groups } = useStore();
  const group = t.group_id ? groups.find(g => g.id === t.group_id) : null;
  const tags = [...(t.attributes?.aromas || []), ...(t.attributes?.flavors || [])];
  const meta = [t.place, t.price ? `${fmt(num(t.price), 2)} € les ${fmt(num(t.volume_cl))} cl` : "", t.style].filter(Boolean).join(", ");
  const name = t.profiles?.display_name || "Anonyme";
  return (
    <div className="entry">
      {showPhoto && <Photo t={t} className="entry-photo" alt={`Photo de ${t.item_name}`} />}
      <div className="eh">
        {author && <><Avatar uid={t.user_id} name={name} size={24} /><span>{name}</span></>}
        <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>{fmtDateTime(t.tasted_at)}</span>
        <span className="pts">{t.score}</span>
      </div>
      {meta && <p>{meta}</p>}
      <p className="entry-sub">
        {group ? <>{group.emoji} {group.name}</> : t.group_id ? "Groupe" : "Perso"}
        {t.again && <> · J’en reprendrais</>}
        {t._pending && <> · <span className="pending-dot">en attente d’envoi</span></>}
      </p>
      {tags.length > 0 && <div className="tags">{tags.map(x => <span key={x} className="tag">{x}</span>)}</div>}
      {t.comment && <p>« {t.comment} »</p>}
      {actions && <div className="acts">
        <Link className="ghost" to={`/edit/${t.id}`}>Modifier</Link>
        <button className="ghost danger" onClick={() => onDelete?.(t)}>Supprimer</button>
      </div>}
    </div>
  );
}
