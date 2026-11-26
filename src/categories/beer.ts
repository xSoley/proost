import type { CategoryConfig } from "./types";

// Pondération inspirée de la grille BJCP (apparence 3, arôme 12, saveur 20, sensation 5, impression 10 sur 50)
export const beer: CategoryConfig = {
  key: "beer",
  label: "Bière",
  producerLabel: "Brasserie",
  criteria: [
    { k: "oeil", n: "L’œil", w: 6, h: "Couleur, mousse, limpidité" },
    { k: "nez", n: "Le nez", w: 24, h: "Intensité, finesse, netteté des arômes" },
    { k: "bouche", n: "La bouche", w: 40, h: "Saveurs, équilibre, finale" },
    { k: "texture", n: "La texture", w: 10, h: "Corps, pétillance, rondeur" },
    { k: "global", n: "Impression générale", w: 20, h: "Le plaisir, tout simplement" }
  ],
  colors: [
    { k: "paille", n: "Paille", c: "#F2D76B" },
    { k: "dore", n: "Doré", c: "#E6AE35" },
    { k: "ambre", n: "Ambré", c: "#C8741D" },
    { k: "cuivre", n: "Cuivré", c: "#9E4A18" },
    { k: "rubis", n: "Rubis", c: "#8C1D2C" },
    { k: "brun", n: "Brun", c: "#55290F" },
    { k: "noir", n: "Noir", c: "#1E0F08" }
  ],
  styles: ["Blonde", "Blanche", "Tripel", "Dubbel", "Quadrupel", "Trappiste", "Saison", "Gueuze", "Lambic", "Kriek", "Framboise", "Ambrée", "Brune", "IPA", "Stout", "Autre"],
  attributes: {
    foam: { label: "Mousse", options: ["Absente", "Fine", "Crémeuse", "Abondante"], multi: false },
    clarity: { label: "Limpidité", options: ["Cristalline", "Voilée", "Trouble"], multi: false },
    aromas: { label: "Arômes", options: ["Agrumes", "Fruits rouges", "Pomme / poire", "Banane", "Pêche / abricot", "Clou de girofle", "Poivre", "Coriandre", "Pain / céréales", "Biscuit", "Caramel", "Miel", "Chocolat", "Café", "Torréfié", "Houblon herbacé", "Résineux", "Floral", "Funky / brett", "Acidulé", "Boisé", "Alcool chaud"], multi: true },
    flavors: { label: "Saveurs dominantes", options: ["Sucrée", "Amère", "Acide", "Maltée", "Fruitée", "Épicée", "Sèche", "Ronde"], multi: true },
    body: { label: "Corps", options: ["Léger", "Moyen", "Plein"], multi: false },
    fizz: { label: "Pétillance", options: ["Faible", "Moyenne", "Vive"], multi: false },
    finish: { label: "Finale", options: ["Courte", "Moyenne", "Longue"], multi: false }
  },
  volumes: [25, 33, 50, 75]
};
