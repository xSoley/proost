import { Glass } from "../components/Glass";

/** Écran provisoire pour les fonctionnalités des étapes suivantes */
export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="empty"><Glass score={0} color="#E6AE35" h={90} /><b>Bientôt</b><p>{text}</p></div>
    </>
  );
}
