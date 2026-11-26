import { usePhotoUrl } from "../lib/photos";
import { thumbPath } from "../lib/image";
import type { Tasting } from "../lib/types";

/** Photo d'une fiche : aperçu local si elle attend d'être envoyée, sinon URL signée */
export function Photo({ t, thumb, className, alt }: { t: Tasting; thumb?: boolean; className?: string; alt?: string }) {
  const local = thumb ? t._pending?.thumb : t._pending?.photo;
  const path = !local && t.photo_path ? (thumb ? thumbPath(t.photo_path) : t.photo_path) : null;
  const remote = usePhotoUrl(path);
  const src = local || remote;
  if (!local && !t.photo_path) return null;
  return src
    ? <img className={className} src={src} alt={alt ?? ""} loading="lazy" decoding="async" />
    : <span className={className + " ph-wait"} aria-hidden="true" />;
}
