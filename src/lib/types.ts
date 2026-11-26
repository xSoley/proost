export type Attributes = {
  foam?: string; clarity?: string; aromas?: string[]; flavors?: string[];
  body?: string; fizz?: string; finish?: string;
  [k: string]: unknown;
};

export type Tasting = {
  id: string;
  user_id: string;
  group_id: string | null;
  category: string;
  item_name: string;
  item_key: string;
  producer: string | null;
  style: string | null;
  abv: number | null;
  color: string | null;
  attributes: Attributes;
  scores: Record<string, number>;
  score: number;
  again: boolean;
  place: string | null;
  ambiance: number;
  price: number | null;
  volume_cl: number | null;
  currency: string;
  comment: string | null;
  photo_path: string | null;
  tasted_at: string;
  created_at?: string;
  updated_at?: string;
  /** Jointure facultative sur l'auteur */
  profiles?: { display_name: string } | null;
  /** Fiche pas encore envoyée : aperçus locaux de la photo */
  _pending?: { photo?: string; thumb?: string };
};

export type Group = {
  id: string;
  name: string;
  emoji: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_path: string | null;
  invite_code: string;
  closed_at: string | null;
  created_by: string;
  created_at: string;
  group_members?: { count: number }[];
};
