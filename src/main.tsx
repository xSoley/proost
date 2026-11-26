import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker : l'appli s'ouvre même sans réseau (en production uniquement)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const register = () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); };
  // L'événement load a pu déjà passer quand ce module s'exécute
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
