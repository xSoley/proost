import { Glass } from "./Glass";

/** Chargement : un verre qui se remplit en boucle */
export function Loading({ text, full }: { text: string; full?: boolean }) {
  return (
    <div className={full ? "boot" : "loading"} role="status">
      <div><span className="loading-glass"><Glass score={80} color="#E6AE35" h={64} rise /></span><div>{text}</div></div>
    </div>
  );
}
