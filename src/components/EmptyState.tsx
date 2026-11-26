import { useNavigate } from "react-router-dom";
import { Glass } from "./Glass";

export function EmptyState({ title, text, cta = "Noter une bière", to = "/new" }: { title: string; text: string; cta?: string | null; to?: string }) {
  const navigate = useNavigate();
  return (
    <div className="empty"><Glass score={0} color="#E6AE35" h={90} /><b>{title}</b><p>{text}</p>
      {cta && <button className="btn" onClick={() => navigate(to)}>{cta}</button>}</div>
  );
}
