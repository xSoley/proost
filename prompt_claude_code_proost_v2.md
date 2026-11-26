# Projet : Proost, la cave numérique de dégustation entre amis

## Vision
Proost est une web app (mobile d'abord) où chacun note les bières qu'il déguste, toute sa vie, avec une photo du moment. Chaque personne a un compte et retrouve son historique quand elle veut (« sa cave numérique »). On peut créer des **groupes** pour des occasions entre potes (ex. week-end à Bruxelles du 18 au 20 décembre) : les membres notent ensemble, voient le classement en direct, et obtiennent à la fin un **récap** avec photos, podium et palmarès.

Aujourd'hui : uniquement la bière. Demain : le vin, puis peut-être d'autres boissons. Le modèle de données doit le permettre dès maintenant, sans que l'interface ne le montre encore.

## Point de départ et règle de design
Le fichier HTML fourni à la fin est le prototype validé (conçu comme artifact Claude). Il sert de **référence de design et de logique métier** :
- Reprendre à l'identique le CSS (couleurs, typo Bricolage Grotesque, rayons, ombres, mode sombre, safe areas), les composants (cartes, chips, curseurs, verre tulipe qui se remplit selon la note, podium, barre de navigation avec bouton central, feuille plein écran de dégustation, toasts) et tous les textes existants.
- Reprendre à l'identique la grille de dégustation et le calcul de la note sur 100 (pondération inspirée du BJCP : œil 6, nez 24, bouche 40, texture 10, impression générale 20), les référentiels (couleurs, styles, arômes, saveurs…) et les agrégations (classement, qualité/prix, bars, stats d'équipe).
- Les nouveaux écrans doivent suivre exactement le même langage visuel.
- Tout ce qui dépend de `window.claude` dans le prototype est à remplacer par le vrai backend.

## Stack
- Front : Vite + React + TypeScript, SPA avec React Router. Le CSS du prototype est repris tel quel dans un fichier global (pas de Tailwind, pas de librairie de composants).
- Backend : **Supabase** (offre gratuite) pour l'authentification, la base Postgres, le stockage des photos et le temps réel.
- Hébergement : GitHub + Vercel (déploiement automatique à chaque push). Variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- PWA : manifest + icône (verre de bière sur fond #3E6B38) + balises iOS, pour « Ajouter à l'écran d'accueil ». Nom : Proost.

## 1. Comptes
- Inscription et connexion par **e-mail + mot de passe** (pas de magic link : on se connecte souvent dans un bar, il ne faut pas jongler avec la boîte mail). Mot de passe oublié par e-mail.
- Session persistante : on reste connecté sur son téléphone.
- À l'inscription : prénom (affiché à côté des notes) ; la couleur d'avatar est dérivée de l'id comme dans le prototype.
- Écran de connexion dans le style de l'app (grand titre « Proost », verre tulipe en illustration).
- Page « Mon profil » : changer de prénom, de mot de passe, se déconnecter, supprimer son compte (avec ses données et photos).

## 2. Fiche de dégustation (+ photo)
- Même formulaire que le prototype, avec en plus :
  - **Photo du moment** en haut de la fiche : prendre une photo ou en choisir une dans la galerie (`<input type="file" accept="image/*">`, sans attribut `capture` pour laisser le choix). Aperçu immédiat, possibilité de la changer ou de la retirer.
  - Compression côté client avant envoi : 1600 px max sur le grand côté, JPEG qualité 0,8, ce qui supprime aussi les données EXIF (dont la géolocalisation).
  - **Date et heure** de dégustation (par défaut maintenant, modifiable).
  - **Groupe** : sélecteur « Perso » ou un de mes groupes. Par défaut, le groupe en cours (dont les dates encadrent aujourd'hui), sinon « Perso ».
- Les photos sont stockées dans un bucket Supabase privé `photos`, chemin `{user_id}/{tasting_id}.jpg`, affichées via des URL signées. Afficher des miniatures dans les listes (transformations d'images Supabase si disponibles, sinon une deuxième version 400 px générée côté client).
- Hors ligne : enregistrement optimiste avec file d'attente locale (fiche ET photo), envoi automatique au retour du réseau, bandeau discret « X fiche(s) en attente d'envoi ».
- On ne peut modifier ou supprimer que ses propres fiches.

## 3. Ma cave (espace perso, accessible à vie)
- Onglet principal pour l'utilisateur connecté.
- **Barre de recherche en haut** : « Tu l'as déjà goûtée ? ». En tapant un nom (recherche insensible aux accents et à la casse), on voit tout de suite si on l'a bue, sa note, la photo et le souvenir.
- Liste de mes bières regroupées par bière (même normalisation du nom que le prototype) : verre rempli à ma note moyenne, nombre de dégustations, dernière date, miniature de la dernière photo.
- Tri : meilleure note, plus récentes, qualité/prix, les plus bues. Filtres : style, couleur, « J'en reprendrais ».
- **Page d'une bière** : toutes mes dégustations dans le temps (photo, date, lieu, groupe, note, commentaire, arômes), évolution de ma note, et en dessous les notes de mes amis sur cette bière (uniquement celles qui me sont visibles via nos groupes communs).
- Statistiques perso dans le style de l'écran « Équipe » : nombre de bières différentes, litres, style favori, arôme le plus cité, la plus costaude, mon top 10.

## 4. Groupes
- Créer un groupe : nom, emoji, ville, dates de début et de fin (facultatives), photo de couverture (facultative).
- Inviter : lien d'invitation avec code unique (bouton « Copier le lien » + partage natif via `navigator.share` pour WhatsApp). Ouvrir le lien sans compte → inscription → arrivée directe dans le groupe. Le créateur peut régénérer le code ou retirer un membre.
- Page d'un groupe : reprend les écrans du prototype, filtrés sur les fiches du groupe : **Classement** (podium + tris), **Carnet** (fil avec photos), **Bars**, **Équipe**. Mise à jour en temps réel (Supabase Realtime) quand un membre ajoute une fiche.
- Un utilisateur peut avoir plusieurs groupes, présentés dans un onglet « Groupes » (en cours, à venir, passés).

## 5. Récap de groupe
- Disponible dès la fin du groupe (date de fin passée) ou à la demande du créateur (« Clôturer le week-end »).
- Page récap, pensée comme un souvenir à faire défiler sur téléphone :
  1. Couverture : photo de couverture (ou la plus belle photo, celle de la bière la mieux notée), nom du groupe, dates, ville.
  2. Les chiffres : bières différentes, dégustations, litres, euros dépensés, note moyenne.
  3. Le podium du groupe (verres qui se remplissent).
  4. Le palmarès : le plus assoiffé, le plus généreux, le juge le plus sévère, style le plus goûté, arôme le plus cité, la plus costaude, le meilleur bar, la meilleure affaire (qualité/prix).
  5. Le coup de cœur de chaque membre, avec sa photo.
  6. Une mosaïque de toutes les photos, triées par moment, avec la journée en intertitre ; un appui ouvre la fiche.
- Accessible pour toujours aux membres du groupe.

## 6. Données (Supabase) et sécurité
Tables (avec migrations SQL versionnées dans le repo, dossier `supabase/migrations`) :
- `profiles` : `id` (= auth.users.id), `display_name`, `created_at`.
- `groups` : `id`, `name`, `emoji`, `city`, `start_date`, `end_date`, `cover_path`, `invite_code` (unique), `closed_at`, `created_by`, `created_at`.
- `group_members` : `group_id`, `user_id`, `role` (owner, member), `joined_at`.
- `tastings` : `id`, `user_id`, `group_id` (nullable), `category` (texte, 'beer' pour l'instant, prévu pour 'wine'), `item_name`, `item_key` (nom normalisé), `producer` (brasserie, plus tard domaine), `style`, `abv`, `color`, `attributes` jsonb (mousse, limpidité, arômes, saveurs, corps, pétillance, finale… pour rester souple selon la catégorie), `scores` jsonb (critères de la catégorie), `score` (note sur 100 calculée), `again`, `place`, `ambiance`, `price`, `volume_cl`, `currency` (défaut 'EUR'), `comment`, `photo_path`, `tasted_at`, `created_at`, `updated_at`.
- Les critères de notation et leurs poids sont définis dans un fichier de configuration par catégorie côté front (`categories/beer.ts`), pour pouvoir ajouter `wine.ts` plus tard sans toucher au reste.

Row Level Security sur toutes les tables :
- Une fiche est visible par son auteur, et par les membres du groupe auquel elle est rattachée. Une fiche « Perso » n'est visible que par son auteur.
- Création, modification, suppression : uniquement par l'auteur, et `group_id` seulement vers un groupe dont il est membre.
- Groupes : visibles par leurs membres ; adhésion via une fonction RPC `join_group(invite_code)`.
- Photos : mêmes règles de lecture que la fiche correspondante ; écriture uniquement dans son propre dossier.

## 7. Méthode de travail
Procède par étapes, et montre-moi le résultat (en local puis déployé) à la fin de chacune avant de passer à la suivante :
1. Mise en place : projet Vite/React, CSS du prototype, Supabase (je te donnerai les clés), comptes, déploiement Vercel.
2. Fiche de dégustation avec photo, file hors ligne, « Ma cave » et page d'une bière.
3. Groupes, invitations, écrans de groupe en temps réel.
4. Récap de groupe.
5. Finitions : PWA, états vides, chargements, tests sur iPhone et Android.

Teste les règles de sécurité avec deux comptes différents (un membre d'un groupe ne voit pas les fiches perso de l'autre, personne ne peut modifier la fiche d'un autre).
Guide-moi pas à pas pour tout ce que je dois faire à la main (créer le projet Supabase, récupérer les clés, configurer l'URL du site dans Supabase Auth, connecter GitHub à Vercel). Ajoute un `README.md` court qui récapitule ces étapes.

## Prototype de référence (design et logique métier)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Proost, carnet de dégustation à Bruxelles</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#ECEDE6;--surface:#FFFFFF;--surface2:#F4F5EF;--ink:#241C13;--muted:#6B675C;--line:#D8D9CF;
  --hop:#3E6B38;--hop-ink:#FFFFFF;--hop-soft:#DDE8D6;--gold:#D99A1E;--danger:#B23A2E;--foam:#FFF9EA;
  --glass:#241C13;--shadow:0 1px 0 rgba(36,28,19,.06),0 8px 24px -12px rgba(36,28,19,.25);
  color-scheme:light;
  box-sizing:border-box;
  padding-top:env(safe-area-inset-top,0px);
  padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#16140F;--surface:#211E17;--surface2:#2A261E;--ink:#F2EDE2;--muted:#A39C8C;--line:#3A352B;
    --hop:#8DBF70;--hop-ink:#14200F;--hop-soft:#2C3A24;--gold:#E8B54A;--danger:#E0705F;--foam:#FFF6DE;
    --glass:#F2EDE2;--shadow:0 1px 0 rgba(0,0,0,.3),0 10px 28px -14px rgba(0,0,0,.7);
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#16140F;--surface:#211E17;--surface2:#2A261E;--ink:#F2EDE2;--muted:#A39C8C;--line:#3A352B;
  --hop:#8DBF70;--hop-ink:#14200F;--hop-soft:#2C3A24;--gold:#E8B54A;--danger:#E0705F;--foam:#FFF6DE;
  --glass:#F2EDE2;--shadow:0 1px 0 rgba(0,0,0,.3),0 10px 28px -14px rgba(0,0,0,.7);
  color-scheme:dark;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-padding-top:env(safe-area-inset-top,0px);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--hop);outline-offset:2px;border-radius:8px}
.wrap{max-width:640px;margin:0 auto;padding:20px 18px 120px}

/* Header */
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:8px 0 22px}
.brand h1{font-size:clamp(46px,13vw,72px);line-height:.85;font-weight:800;letter-spacing:-.04em;margin:0;font-variation-settings:"opsz" 96}
.brand p{margin:8px 0 0;color:var(--muted);font-size:15px}
.me{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px 6px 6px;font-size:14px;font-weight:600;white-space:nowrap}
.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;color:#fff;flex:none}

.banner{background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:10px 14px;font-size:14px;color:var(--muted);margin-bottom:16px}
h2{font-size:26px;letter-spacing:-.02em;margin:0 0 4px;font-weight:700}
.sub{color:var(--muted);margin:0 0 16px;font-size:15px}

/* Segmented */
.seg{display:flex;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:3px;gap:3px;margin-bottom:18px;overflow-x:auto}
.seg button{flex:1;border:0;background:transparent;padding:8px 10px;border-radius:9px;font-size:14px;font-weight:600;color:var(--muted);white-space:nowrap}
.seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}

/* Podium */
.podium{display:grid;grid-template-columns:1fr 1.25fr 1fr;align-items:end;gap:10px;margin:6px 0 22px}
.pod{text-align:center;border:0;background:transparent;padding:0}
.pod .rank{font-weight:800;font-size:15px;color:var(--muted)}
.pod.first .rank{color:var(--gold)}
.pod .nm{font-weight:700;font-size:15px;line-height:1.15;margin-top:4px;overflow-wrap:anywhere}
.pod .sc{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1}
.pod.first .sc{font-size:40px}
.pod .plinth{margin-top:8px;border-radius:12px 12px 4px 4px;background:var(--surface);border:1px solid var(--line);padding:10px 6px}
.pod.first .plinth{padding-bottom:26px;border-color:var(--gold)}
.pod.second .plinth{padding-bottom:16px}

/* List cards */
.list{display:flex;flex-direction:column;gap:10px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.row{display:flex;gap:12px;align-items:center;padding:12px 14px;width:100%;text-align:left;border:0;background:transparent}
.row .pos{font-weight:800;font-size:15px;width:22px;color:var(--muted);flex:none;text-align:center}
.row .body{flex:1;min-width:0}
.row .title{font-weight:700;font-size:17px;line-height:1.2;overflow-wrap:anywhere}
.row .meta{color:var(--muted);font-size:13.5px;margin-top:2px}
.row .score{text-align:right;flex:none}
.row .score b{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1;display:block}
.row .score small{color:var(--muted);font-size:12px}
.details{border-top:1px solid var(--line);padding:6px 14px 12px;background:var(--surface2)}
.entry{padding:10px 0;border-bottom:1px solid var(--line);font-size:14.5px}
.entry:last-child{border-bottom:0}
.entry .eh{display:flex;align-items:center;gap:8px;font-weight:600}
.entry .eh .pts{margin-left:auto;font-weight:800}
.entry p{margin:6px 0 0;color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.tag{font-size:12.5px;padding:3px 9px;border-radius:999px;background:var(--hop-soft);color:var(--ink)}
.bars{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px}
.bars div{font-size:11.5px;color:var(--muted)}
.bars i{display:block;height:5px;border-radius:3px;background:var(--line);margin-top:3px;overflow:hidden}
.bars i span{display:block;height:100%;background:var(--hop)}
.acts{display:flex;gap:8px;margin-top:8px}
.ghost{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:6px 12px;font-size:13.5px;font-weight:600}
.ghost.danger{color:var(--danger)}

/* Empty */
.empty{text-align:center;padding:40px 20px;color:var(--muted)}
.empty svg{margin-bottom:10px}
.empty b{display:block;color:var(--ink);font-size:19px;margin-bottom:4px}
.btn{border:0;background:var(--hop);color:var(--hop-ink);font-weight:700;border-radius:14px;padding:14px 20px;font-size:16px}
.btn.wide{width:100%}

/* Stats */
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:22px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px}
.kpi b{display:block;font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1.05}
.kpi span{color:var(--muted);font-size:13.5px}
.award{display:flex;gap:12px;align-items:center;padding:12px 14px}
.award .ic{font-size:26px;width:36px;text-align:center}
.award b{display:block}
.award span{color:var(--muted);font-size:14px}

/* Bottom nav */
.nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom,0px)}
.nav-in{max-width:640px;margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);align-items:center;height:66px}
.nav button{border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11.5px;font-weight:600;color:var(--muted);padding:6px 0}
.nav button[aria-current="page"]{color:var(--ink)}
.nav button svg{width:23px;height:23px}
.nav .fab{width:58px;height:58px;border-radius:50%;background:var(--hop);color:var(--hop-ink);margin:-26px auto 0;justify-content:center;box-shadow:0 8px 22px -8px rgba(30,60,25,.6);border:4px solid var(--bg)}
.nav .fab svg{width:26px;height:26px}

/* Sheet */
.sheet{position:fixed;inset:0;z-index:40;background:var(--bg);overflow-y:auto;transform:translateY(100%);transition:transform .32s cubic-bezier(.2,.8,.2,1);padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.sheet.open{transform:none}
@media (prefers-reduced-motion:reduce){.sheet{transition:none}}
.sheet-head{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.sheet-head-in{max-width:640px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:10px 18px}
.sheet-head .x{border:0;background:var(--surface);border:1px solid var(--line);width:38px;height:38px;border-radius:50%;font-size:20px;line-height:1}
.live{display:flex;align-items:center;gap:10px;margin-left:auto}
.live b{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1}
.live small{display:block;color:var(--muted);font-size:12px;line-height:1.1}
.form{max-width:640px;margin:0 auto;padding:18px 18px 40px}
.sec{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:16px;margin-bottom:14px}
.sec h3{margin:0;font-size:20px;letter-spacing:-.01em;display:flex;align-items:center;gap:8px}
.sec .hint{color:var(--muted);font-size:14px;margin:2px 0 12px}
label.f{display:block;font-size:14px;font-weight:600;margin:12px 0 6px}
.in{width:100%;border:1px solid var(--line);background:var(--surface2);border-radius:12px;padding:12px 13px;font-size:16px}
.in:focus{outline:2px solid var(--hop);outline-offset:0;border-color:transparent}
textarea.in{min-height:84px;resize:vertical}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:var(--surface2);border-radius:999px;padding:7px 12px;font-size:14px;font-weight:500}
.chip[aria-pressed="true"]{background:var(--hop);border-color:var(--hop);color:var(--hop-ink);font-weight:600}
.swatches{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.sw{border:2px solid transparent;background:transparent;padding:0;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);border-radius:12px;padding:4px 0}
.sw i{width:34px;height:34px;border-radius:50%;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.sw[aria-pressed="true"]{border-color:var(--hop);color:var(--ink);font-weight:600}
.slider{margin-top:14px}
.slider .lab{display:flex;justify-content:space-between;align-items:baseline}
.slider .lab b{font-size:15px}
.slider .lab output{font-weight:800;font-size:20px;min-width:44px;text-align:right}
.slider .lab small{color:var(--muted);font-size:12.5px;font-weight:500;margin-left:6px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:30px;background:transparent;margin:2px 0 0}
input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:5px;background:linear-gradient(90deg,var(--hop) var(--p,50%),var(--line) var(--p,50%))}
input[type=range]::-moz-range-track{height:8px;border-radius:5px;background:linear-gradient(90deg,var(--hop) var(--p,50%),var(--line) var(--p,50%))}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:var(--surface);border:3px solid var(--hop);margin-top:-9px;box-shadow:0 2px 6px rgba(0,0,0,.2)}
input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--surface);border:3px solid var(--hop)}
.stars{display:flex;gap:4px}
.star{border:0;background:transparent;font-size:30px;line-height:1;padding:2px;color:var(--line)}
.star.on{color:var(--gold)}
.calc{margin-top:10px;font-size:14px;color:var(--muted)}
.calc b{color:var(--ink)}
.toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;font-weight:600}
.switch{position:relative;width:52px;height:30px;border-radius:999px;border:0;background:var(--line);flex:none;transition:background .2s}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.switch[aria-checked="true"]{background:var(--hop)}
.switch[aria-checked="true"]::after{transform:translateX(22px)}

/* Modal (pseudo) */
.modal{position:fixed;inset:0;z-index:60;background:rgba(20,16,10,.55);display:none;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
.modal.open{display:flex}
.modal-in{background:var(--surface);border-radius:24px;padding:22px;width:100%;max-width:440px;margin-bottom:auto;margin-top:auto}
.modal-in h3{font-size:24px;margin:0 0 6px;letter-spacing:-.02em}
.modal-in p{color:var(--muted);margin:0 0 14px}

.toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translateX(-50%) translateY(20px);background:var(--ink);color:var(--bg);padding:11px 16px;border-radius:12px;font-weight:600;font-size:14.5px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:80;max-width:90vw;text-align:center}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.loading{padding:60px 0;text-align:center;color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand">
      <h1>Proost</h1>
      <p>Bruxelles, du 18 au 20 décembre</p>
    </div>
    <button class="me" id="meBtn" aria-label="Changer de prénom"></button>
  </header>
  <div id="banner"></div>
  <main id="view"><div class="loading">Ouverture du carnet…</div></main>
</div>

<nav class="nav" aria-label="Navigation">
  <div class="nav-in">
    <button data-tab="ranking" aria-current="page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>Classement</button>
    <button data-tab="feed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M9 9h6M9 13h6"/></svg>Carnet</button>
    <button class="fab" id="addBtn" aria-label="Noter une bière">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
    <button data-tab="bars">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>Bars</button>
    <button data-tab="team">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5"/></svg>Équipe</button>
  </div>
</nav>

<section class="sheet" id="sheet" aria-modal="true" role="dialog" aria-label="Fiche de dégustation"></section>

<div class="modal" id="nameModal">
  <div class="modal-in">
    <h3>Santé ! C’est qui ?</h3>
    <p>Ton prénom s’affiche à côté de tes notes, pour que la bande sache qui a noté quoi.</p>
    <input class="in" id="nameInput" maxlength="24" placeholder="Ton prénom" autocomplete="given-name">
    <div style="height:12px"></div>
    <button class="btn wide" id="nameSave">C’est parti</button>
  </div>
</div>
<div class="toast" id="toast" role="status"></div>

<script>
(() => {
"use strict";
/* ---------- Référentiels ---------- */
const COLORS = [
  {k:"paille", n:"Paille", c:"#F2D76B"},
  {k:"dore", n:"Doré", c:"#E6AE35"},
  {k:"ambre", n:"Ambré", c:"#C8741D"},
  {k:"cuivre", n:"Cuivré", c:"#9E4A18"},
  {k:"rubis", n:"Rubis", c:"#8C1D2C"},
  {k:"brun", n:"Brun", c:"#55290F"},
  {k:"noir", n:"Noir", c:"#1E0F08"}
];
const STYLES = ["Blonde","Blanche","Tripel","Dubbel","Quadrupel","Trappiste","Saison","Gueuze","Lambic","Kriek","Framboise","Ambrée","Brune","IPA","Stout","Autre"];
const FOAM = ["Absente","Fine","Crémeuse","Abondante"];
const CLARITY = ["Cristalline","Voilée","Trouble"];
const AROMAS = ["Agrumes","Fruits rouges","Pomme / poire","Banane","Pêche / abricot","Clou de girofle","Poivre","Coriandre","Pain / céréales","Biscuit","Caramel","Miel","Chocolat","Café","Torréfié","Houblon herbacé","Résineux","Floral","Funky / brett","Acidulé","Boisé","Alcool chaud"];
const FLAVORS = ["Sucrée","Amère","Acide","Maltée","Fruitée","Épicée","Sèche","Ronde"];
const BODY = ["Léger","Moyen","Plein"];
const FIZZ = ["Faible","Moyenne","Vive"];
const FINISH = ["Courte","Moyenne","Longue"];
const VOLUMES = [25,33,50,75];
// Pondération inspirée de la grille BJCP (apparence 3, arôme 12, saveur 20, sensation 5, impression 10 sur 50)
const CRIT = [
  {k:"oeil", n:"L’œil", w:6, h:"Couleur, mousse, limpidité"},
  {k:"nez", n:"Le nez", w:24, h:"Intensité, finesse, netteté des arômes"},
  {k:"bouche", n:"La bouche", w:40, h:"Saveurs, équilibre, finale"},
  {k:"texture", n:"La texture", w:10, h:"Corps, pétillance, rondeur"},
  {k:"global", n:"Impression générale", w:20, h:"Le plaisir, tout simplement"}
];
const PALETTE = ["#3E6B38","#B5651D","#7A3B69","#2F5D8A","#A8323E","#5B6B1F","#8A5A2B","#3D7A78"];

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n, d=0) => Number(n).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});
const colorOf = k => (COLORS.find(c=>c.k===k)||COLORS[1]).c;
const hash = s => { let h=0; for (const ch of String(s)) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h); };
const avatarColor = uid => PALETTE[hash(uid)%PALETTE.length];
const initials = n => esc((String(n||"?").trim()[0]||"?").toUpperCase());
const scoreOf = t => Math.round(CRIT.reduce((s,c)=>s + (num(t[c.k]))/10*c.w, 0));
const p33Of = t => (num(t.price)>0 && num(t.volume)>0) ? num(t.price)*33/num(t.volume) : null;
const ls = {
  get(k, d){ try { const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const timeAgo = ts => {
  const d = (Date.now()-ts)/1000;
  if (d < 60) return "à l’instant";
  if (d < 3600) return `il y a ${Math.floor(d/60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d/3600)} h`;
  return new Date(ts).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
};
let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2600); }

/* Verre tulipe qui se remplit selon la note */
let gid = 0;
function glass(score, color, h=64){
  const id = "g"+(++gid);
  const s = Math.max(0, Math.min(100, score||0));
  const top = 9, bottom = 64;
  const y = bottom - (s/100)*(bottom-top);
  const bowl = "M13 8 C10 30 9 44 16 55 C20 61 26 64 30 65 C34 64 40 61 44 55 C51 44 50 30 47 8 Z";
  return `<svg width="${h*0.6}" height="${h}" viewBox="0 0 60 100" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${bowl}"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect x="0" y="${y}" width="60" height="${bottom-y+4}" fill="${color}"/>
      ${s>0?`<rect x="0" y="${y-5}" width="60" height="6" rx="2" fill="var(--foam)"/>`:""}
      ${s>0?`<circle cx="24" cy="${Math.min(bottom-6,y+12)}" r="1.2" fill="#fff" opacity=".55"/><circle cx="34" cy="${Math.min(bottom-4,y+22)}" r="1" fill="#fff" opacity=".5"/>`:""}
    </g>
    <path d="${bowl}" fill="none" stroke="var(--glass)" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30 65 V85 M19 91 H41 M30 85 C26 87 21 88 19 91 M30 85 C34 87 39 88 41 91" fill="none" stroke="var(--glass)" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

/* ---------- État ---------- */
const state = {
  tastings: [], tab: "ranking", sort: "note", open: new Set(), feedMine: false,
  mode: "loading", uid: ls.get("bb-uid", null), pseudo: ls.get("bb-pseudo", ""), readOnly: false
};
if (!state.uid) { state.uid = "l-" + Math.random().toString(36).slice(2,10); ls.set("bb-uid", state.uid); }

/* ---------- Stockage (partagé si possible, sinon local) ---------- */
let col = null;
const withTimeout = (p, ms) => Promise.race([p, new Promise(r=>setTimeout(()=>r(null), ms))]);

async function initStore(){
  let db = null;
  if (window.claude && typeof window.claude.use === "function") {
    try { db = await withTimeout(window.claude.use("db"), 10000); } catch(e){ db = null; }
    try {
      const user = await withTimeout(window.claude.use("user"), 4000);
      if (user && typeof user.id === "function") {
        const id = await user.id().catch(()=>null);
        if (id) state.uid = id;
      }
      if (user && typeof user.can === "function") {
        const w = await user.can("data.write").catch(()=>null);
        if (w === false) state.readOnly = true;
      }
    } catch(e){}
  }
  if (db) {
    state.mode = "remote";
    col = db.collection("tastings");
    let loaded = false;
    const timer = setTimeout(()=>{ if(!loaded){ state.mode="local"; state.tastings = ls.get("bb-tastings", []); render(); } }, 10000);
    col.onSnapshot(snap => {
      loaded = true; clearTimeout(timer);
      state.mode = "remote";
      state.tastings = snap.docs.map(d => ({...d.data(), id: d.id})).filter(t => t && t.name);
      render();
    }, err => {
      clearTimeout(timer);
      state.mode = "local"; state.tastings = ls.get("bb-tastings", []);
      render();
    });
  } else {
    state.mode = "local";
    state.tastings = ls.get("bb-tastings", []);
    render();
  }
}
async function saveTasting(t){
  if (state.mode === "remote" && col) {
    try { await col.doc(t.id).set(t); return true; }
    catch(e){
      if (e && e.code === "invalid_argument") { state.readOnly = true; render(); toast("Tu peux lire mais pas noter : demande à être ajouté en contributeur."); }
      else if (e && e.code === "quota_exceeded") toast("Le carnet est plein : supprime quelques fiches.");
      else toast("Enregistrement impossible, réessaie dans un instant.");
      return false;
    }
  }
  const all = ls.get("bb-tastings", []).filter(x=>x.id!==t.id); all.push(t);
  ls.set("bb-tastings", all); state.tastings = all; render(); return true;
}
async function deleteTasting(id){
  if (state.mode === "remote" && col) {
    try { await col.doc(id).delete(); return true; } catch(e){ toast("Suppression impossible."); return false; }
  }
  const all = ls.get("bb-tastings", []).filter(x=>x.id!==id);
  ls.set("bb-tastings", all); state.tastings = all; render(); return true;
}

/* ---------- Agrégations ---------- */
function beers(){
  const m = new Map();
  for (const t of state.tastings) {
    const k = norm(t.name); if (!k) continue;
    if (!m.has(k)) m.set(k, {key:k, name:t.name, brewery:"", style:"", color:t.color, list:[]});
    const g = m.get(k); g.list.push(t);
    if (!g.brewery && t.brewery) g.brewery = t.brewery;
    if (!g.style && t.style) g.style = t.style;
  }
  return [...m.values()].map(g => {
    const scores = g.list.map(scoreOf);
    const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
    const prices = g.list.map(p33Of).filter(v=>v!=null);
    const p33 = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : null;
    const crit = {}; for (const c of CRIT) crit[c.k] = g.list.reduce((a,t)=>a+num(t[c.k]),0)/g.list.length;
    const abv = g.list.map(t=>num(t.abv)).filter(Boolean)[0] || null;
    return {...g, avg, n:g.list.length, p33, value: p33 ? avg/p33 : null, again: g.list.filter(t=>t.again).length, crit, abv};
  });
}
function bars(){
  const m = new Map();
  for (const t of state.tastings) {
    const k = norm(t.place); if (!k) continue;
    if (!m.has(k)) m.set(k, {name:t.place, list:[]});
    m.get(k).list.push(t);
  }
  return [...m.values()].map(b => {
    const rated = b.list.filter(t=>num(t.ambiance)>0);
    const amb = rated.length ? rated.reduce((a,t)=>a+num(t.ambiance),0)/rated.length : 0;
    const avg = b.list.reduce((a,t)=>a+scoreOf(t),0)/b.list.length;
    const prices = b.list.map(p33Of).filter(v=>v!=null);
    const p33 = prices.length ? prices.reduce((a,v)=>a+v,0)/prices.length : null;
    const best = b.list.slice().sort((x,y)=>scoreOf(y)-scoreOf(x))[0];
    return {...b, amb, avg, p33, best, n:b.list.length, combo: amb*12 + avg*0.4};
  }).sort((a,b)=>b.combo-a.combo);
}

/* ---------- Rendu ---------- */
function render(){
  renderMe(); renderBanner();
  document.querySelectorAll(".nav [data-tab]").forEach(b => { if (b.dataset.tab===state.tab) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  const v = $("#view");
  if (state.mode === "loading") { v.innerHTML = `<div class="loading">Ouverture du carnet…</div>`; return; }
  gid = 0;
  if (state.tab === "ranking") v.innerHTML = viewRanking();
  else if (state.tab === "feed") v.innerHTML = viewFeed();
  else if (state.tab === "bars") v.innerHTML = viewBars();
  else v.innerHTML = viewTeam();
}
function renderMe(){
  const b = $("#meBtn");
  b.innerHTML = `<span class="avatar" style="background:${avatarColor(state.uid)}">${initials(state.pseudo)}</span>`;
  const s = document.createElement("span"); s.textContent = state.pseudo || "Mon prénom"; b.appendChild(s);
}
function renderBanner(){
  const el = $("#banner");
  if (state.mode === "local") el.innerHTML = `<div class="banner">Mode hors ligne : tes notes restent sur ce téléphone. Ouvre le lien partagé depuis Claude pour voir celles de la bande.</div>`;
  else if (state.readOnly) el.innerHTML = `<div class="banner">Tu peux consulter le carnet. Pour noter, demande à l’organisateur de te passer en contributeur.</div>`;
  else el.innerHTML = "";
}
function emptyState(title, text){
  return `<div class="empty">${glass(0, COLORS[1].c, 90)}<b>${title}</b><p>${text}</p>
    ${state.readOnly ? "" : `<button class="btn" data-act="add">Noter une bière</button>`}</div>`;
}
function critBars(crit){
  return `<div class="bars">${CRIT.map(c=>`<div>${esc(c.n.replace("Impression générale","Général"))}<i><span style="width:${Math.round((crit[c.k]||0)*10)}%"></span></i></div>`).join("")}</div>`;
}
function entryHTML(t, withActions){
  const mine = t.uid === state.uid;
  const tags = [...(t.aromas||[]), ...(t.flavors||[])];
  const meta = [t.place, t.price ? `${fmt(num(t.price),2)} € les ${esc(t.volume)} cl` : "", t.style].filter(Boolean).map(esc).join(", ");
  return `<div class="entry">
    <div class="eh"><span class="avatar" style="background:${avatarColor(t.uid)};width:24px;height:24px;font-size:11px">${initials(t.pseudo)}</span>
      <span>${esc(t.pseudo||"Anonyme")}</span><span style="color:var(--muted);font-weight:500;font-size:13px">${timeAgo(t.ts)}</span>
      <span class="pts">${scoreOf(t)}</span></div>
    ${meta?`<p>${meta}</p>`:""}
    ${tags.length?`<div class="tags">${tags.map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}
    ${t.comment?`<p>« ${esc(t.comment)} »</p>`:""}
    ${withActions && mine && !state.readOnly ? `<div class="acts"><button class="ghost" data-edit="${esc(t.id)}">Modifier</button><button class="ghost danger" data-del="${esc(t.id)}">Supprimer</button></div>`:""}
  </div>`;
}

function viewRanking(){
  const list = beers();
  if (!list.length) return `<h2>Classement</h2>` + emptyState("Aucune bière notée", "La première gorgée ouvre le classement.");
  const sorters = {
    note: (a,b)=>b.avg-a.avg || b.n-a.n,
    value: (a,b)=>(b.value??-1)-(a.value??-1),
    pop: (a,b)=>b.n-a.n || b.avg-a.avg,
    again: (a,b)=>b.again/b.n-a.again/a.n || b.avg-a.avg
  };
  list.sort(sorters[state.sort]);
  const label = {note:"Note du groupe", value:"Rapport qualité/prix", pop:"Les plus goûtées", again:"Celles qu’on reprendrait"};
  const val = b => state.sort==="value" ? (b.value!=null ? fmt(b.value,1) : "–") : state.sort==="again" ? Math.round(b.again/b.n*100)+"%" : fmt(b.avg);
  const unit = b => state.sort==="value" ? "pts par €" : state.sort==="again" ? "en reprendraient" : `/100, ${b.n} avis`;
  let html = `<h2>Classement</h2><p class="sub">${list.length} bière${list.length>1?"s":""}, ${state.tastings.length} dégustation${state.tastings.length>1?"s":""}</p>
  <div class="seg" role="group" aria-label="Trier">${Object.entries(label).map(([k,l])=>`<button data-sort="${k}" aria-pressed="${state.sort===k}">${l}</button>`).join("")}</div>`;
  if (list.length >= 3) {
    const [a,b,c] = list;
    const pod = (x, cls, r, h) => `<button class="pod ${cls}" data-open="${esc(x.key)}">${glass(x.avg, colorOf(x.color), h)}
      <div class="nm">${esc(x.name)}</div><div class="plinth"><div class="rank">${r}</div><div class="sc">${val(x)}</div></div></button>`;
    html += `<div class="podium">${pod(b,"second","2e",70)}${pod(a,"first","1re",96)}${pod(c,"third","3e",60)}</div>`;
  }
  html += `<div class="list">` + list.map((b,i)=>{
    const open = state.open.has(b.key);
    const meta = [b.brewery, b.style, b.abv?fmt(b.abv,1)+" %":"", b.p33!=null?`${fmt(b.p33,2)} € les 33 cl`:""].filter(Boolean).map(esc).join(", ");
    return `<div class="card"><button class="row" data-open="${esc(b.key)}" aria-expanded="${open}">
      <span class="pos">${i+1}</span>${glass(b.avg, colorOf(b.color), 48)}
      <span class="body"><span class="title">${esc(b.name)}</span><span class="meta" style="display:block">${meta||"&nbsp;"}</span></span>
      <span class="score"><b>${val(b)}</b><small>${unit(b)}</small></span></button>
      ${open?`<div class="details">${critBars(b.crit)}${b.list.slice().sort((x,y)=>y.ts-x.ts).map(t=>entryHTML(t,false)).join("")}</div>`:""}</div>`;
  }).join("") + `</div>`;
  return html;
}

function viewFeed(){
  let list = state.tastings.slice().sort((a,b)=>b.ts-a.ts);
  if (state.feedMine) list = list.filter(t=>t.uid===state.uid);
  let html = `<h2>Carnet</h2><p class="sub">Toutes les fiches, de la plus récente à la plus ancienne</p>
    <div class="seg" role="group" aria-label="Filtrer"><button data-feed="all" aria-pressed="${!state.feedMine}">Toute la bande</button><button data-feed="mine" aria-pressed="${state.feedMine}">Mes fiches</button></div>`;
  if (!list.length) return html + emptyState(state.feedMine?"Tu n’as encore rien noté":"Le carnet est vide", "Chaque bière goûtée mérite sa fiche.");
  return html + `<div class="list">` + list.map(t=>`<div class="card"><div class="row" style="align-items:flex-start">
      ${glass(scoreOf(t), colorOf(t.color), 52)}
      <div class="body"><div class="title">${esc(t.name)}</div><div class="meta">${esc([t.brewery, t.abv?fmt(num(t.abv),1)+" %":""].filter(Boolean).join(", "))}</div>
      ${entryHTML(t,true).replace('class="entry"','class="entry" style="padding-bottom:0"')}</div></div></div>`).join("") + `</div>`;
}

function viewBars(){
  const list = bars();
  let html = `<h2>Les bars</h2><p class="sub">Classés selon l’ambiance et la qualité de ce qu’on y a bu</p>`;
  if (!list.length) return html + emptyState("Aucun bar pour l’instant", "Renseigne le lieu dans tes fiches pour voir apparaître les adresses.");
  return html + `<div class="list">` + list.map((b,i)=>`<div class="card"><div class="row">
    <span class="pos">${i+1}</span>
    <span class="body"><span class="title">${esc(b.name)}</span>
    <span class="meta" style="display:block">${b.n} bière${b.n>1?"s":""} goûtée${b.n>1?"s":""}${b.p33!=null?`, ${fmt(b.p33,2)} € les 33 cl en moyenne`:""}</span>
    <span class="meta" style="display:block">Meilleure ici : ${esc(b.best.name)} (${scoreOf(b.best)})</span></span>
    <span class="score"><b style="color:var(--gold)">${b.amb?fmt(b.amb,1):"–"}<span style="font-size:18px">★</span></b><small>bières à ${fmt(b.avg)}/100</small></span>
  </div></div>`).join("") + `</div>`;
}

function viewTeam(){
  const T = state.tastings;
  let html = `<h2>L’équipe</h2><p class="sub">Les chiffres du week-end</p>`;
  if (!T.length) return html + emptyState("Pas encore de chiffres", "Ils arrivent avec la première fiche.");
  const liters = T.reduce((a,t)=>a+num(t.volume),0)/100;
  const spent = T.reduce((a,t)=>a+num(t.price),0);
  const distinct = new Set(T.map(t=>norm(t.name))).size;
  const avg = T.reduce((a,t)=>a+scoreOf(t),0)/T.length;
  html += `<div class="kpis">
    <div class="kpi"><b>${distinct}</b><span>bières différentes</span></div>
    <div class="kpi"><b>${fmt(liters,1)} L</b><span>bus à plusieurs</span></div>
    <div class="kpi"><b>${fmt(spent,0)} €</b><span>dépensés au comptoir</span></div>
    <div class="kpi"><b>${fmt(avg)}</b><span>note moyenne du groupe</span></div></div>`;
  const people = new Map();
  for (const t of T) {
    if (!people.has(t.uid)) people.set(t.uid, {uid:t.uid, pseudo:t.pseudo, list:[]});
    const p = people.get(t.uid); p.list.push(t); if ((t.ts||0) >= (p.ts||0)) { p.ts=t.ts; p.pseudo=t.pseudo; }
  }
  const P = [...people.values()].map(p=>({...p, n:p.list.length, avg:p.list.reduce((a,t)=>a+scoreOf(t),0)/p.list.length,
    fav:p.list.slice().sort((a,b)=>scoreOf(b)-scoreOf(a))[0], spent:p.list.reduce((a,t)=>a+num(t.price),0)}));
  const count = (arr) => { const m={}; arr.forEach(x=>m[x]=(m[x]||0)+1); return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]; };
  const topStyle = count(T.map(t=>t.style).filter(Boolean));
  const topAroma = count(T.flatMap(t=>t.aromas||[]));
  const strongest = T.filter(t=>num(t.abv)>0).sort((a,b)=>num(b.abv)-num(a.abv))[0];
  const awards = [];
  if (P.length > 1) {
    const big = P.slice().sort((a,b)=>b.n-a.n)[0];
    const kind = P.slice().sort((a,b)=>b.avg-a.avg)[0];
    const harsh = P.slice().sort((a,b)=>a.avg-b.avg)[0];
    awards.push(["🍺","Le plus assoiffé", `${big.pseudo} avec ${big.n} bières`]);
    awards.push(["😇","Le plus généreux", `${kind.pseudo}, ${fmt(kind.avg)}/100 en moyenne`]);
    awards.push(["🧐","Le juge le plus sévère", `${harsh.pseudo}, ${fmt(harsh.avg)}/100 en moyenne`]);
  }
  if (topStyle) awards.push(["🏷️","Style le plus goûté", `${topStyle[0]} (${topStyle[1]} fois)`]);
  if (topAroma) awards.push(["👃","Arôme le plus cité", `${topAroma[0]} (${topAroma[1]} fois)`]);
  if (strongest) awards.push(["🔥","La plus costaude", `${strongest.name}, ${fmt(num(strongest.abv),1)} %`]);
  if (awards.length) html += `<div class="card" style="margin-bottom:22px">${awards.map(a=>`<div class="award"><span class="ic">${a[0]}</span><div><b>${esc(a[1])}</b><span>${esc(a[2])}</span></div></div>`).join("")}</div>`;
  html += `<h2 style="font-size:20px;margin-bottom:10px">Par dégustateur</h2><div class="list">` + P.sort((a,b)=>b.n-a.n).map(p=>`<div class="card"><div class="row">
    <span class="avatar" style="background:${avatarColor(p.uid)};width:38px;height:38px;font-size:16px">${initials(p.pseudo)}</span>
    <span class="body"><span class="title">${esc(p.pseudo)}${p.uid===state.uid?" (toi)":""}</span>
    <span class="meta" style="display:block">Coup de cœur : ${esc(p.fav.name)} (${scoreOf(p.fav)})</span>
    <span class="meta" style="display:block">${fmt(p.spent,0)} € dépensés, note moyenne ${fmt(p.avg)}</span></span>
    <span class="score"><b>${p.n}</b><small>bière${p.n>1?"s":""}</small></span></div></div>`).join("") + `</div>`;
  return html;
}

/* ---------- Fiche de dégustation ---------- */
let form = null;
function blankForm(){
  return {id:"", name:"", brewery:"", style:"", abv:"", color:"dore", foam:"", clarity:"", aromas:[], flavors:[], body:"", fizz:"", finish:"",
    oeil:5, nez:5, bouche:5, texture:5, global:5, again:false, place:"", ambiance:0, price:"", volume:33, comment:""};
}
function chipGroup(field, options, multi){
  const cur = form[field];
  return `<div class="chips" role="group">${options.map(o=>{
    const on = multi ? cur.includes(o) : cur===o;
    return `<button type="button" class="chip" data-chip="${field}" data-val="${esc(o)}" data-multi="${multi?1:0}" aria-pressed="${on}">${esc(o)}</button>`;
  }).join("")}</div>`;
}
function slider(c){
  const v = form[c.k];
  return `<div class="slider"><div class="lab"><b>${c.n}<small>${c.w} % de la note</small></b><output id="o-${c.k}">${fmt(v,1)}</output></div>
    <input type="range" min="0" max="10" step="0.5" value="${v}" data-range="${c.k}" style="--p:${v*10}%" aria-label="${esc(c.n)}, note sur 10">
    <div style="color:var(--muted);font-size:13px">${c.h}</div></div>`;
}
function openForm(existing){
  if (state.readOnly) { toast("Tu es en lecture seule sur ce carnet."); return; }
  if (!state.pseudo) { askName(()=>openForm(existing)); return; }
  form = existing ? {...blankForm(), ...JSON.parse(JSON.stringify(existing))} : blankForm();
  const names = [...new Set(state.tastings.map(t=>t.name))];
  const places = [...new Set(state.tastings.map(t=>t.place).filter(Boolean))];
  const sheet = $("#sheet");
  sheet.innerHTML = `
  <div class="sheet-head"><div class="sheet-head-in">
    <button class="x" data-act="close" aria-label="Fermer">×</button>
    <div style="font-weight:700">${existing?"Modifier la fiche":"Nouvelle dégustation"}</div>
    <div class="live"><span id="liveGlass"></span><div><b id="liveScore">50</b><small>sur 100</small></div></div>
  </div></div>
  <div class="form">
    <div class="sec"><h3>La bière</h3><p class="hint">Reprends le nom exact pour que vos notes se regroupent au classement.</p>
      <label class="f" for="fName">Nom</label><input class="in" id="fName" list="dlNames" placeholder="Westvleteren 12, Orval, Cantillon Gueuze…" value="${esc(form.name)}" autocomplete="off">
      <datalist id="dlNames">${names.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
      <div class="two"><div><label class="f" for="fBrew">Brasserie</label><input class="in" id="fBrew" placeholder="Cantillon" value="${esc(form.brewery)}"></div>
      <div><label class="f" for="fAbv">Degré (%)</label><input class="in" id="fAbv" inputmode="decimal" placeholder="8,5" value="${esc(form.abv)}"></div></div>
      <label class="f">Style</label>${chipGroup("style", STYLES, false)}
    </div>

    <div class="sec"><h3>L’œil</h3><p class="hint">Incline le verre devant la lumière.</p>
      <label class="f">Couleur</label>
      <div class="swatches" role="group">${COLORS.map(c=>`<button type="button" class="sw" data-color="${c.k}" aria-pressed="${form.color===c.k}"><i style="background:${c.c}"></i>${c.n}</button>`).join("")}</div>
      <label class="f">Mousse</label>${chipGroup("foam", FOAM, false)}
      <label class="f">Limpidité</label>${chipGroup("clarity", CLARITY, false)}
      ${slider(CRIT[0])}
    </div>

    <div class="sec"><h3>Le nez</h3><p class="hint">Fais tourner, approche, inspire deux fois. Coche tout ce que tu reconnais.</p>
      ${chipGroup("aromas", AROMAS, true)}
      ${slider(CRIT[1])}
    </div>

    <div class="sec"><h3>La bouche</h3><p class="hint">Garde la gorgée quelques secondes avant d’avaler.</p>
      <label class="f">Saveurs dominantes</label>${chipGroup("flavors", FLAVORS, true)}
      <label class="f">Finale</label>${chipGroup("finish", FINISH, false)}
      ${slider(CRIT[2])}
    </div>

    <div class="sec"><h3>La texture</h3>
      <label class="f">Corps</label>${chipGroup("body", BODY, false)}
      <label class="f">Pétillance</label>${chipGroup("fizz", FIZZ, false)}
      ${slider(CRIT[3])}
    </div>

    <div class="sec"><h3>Le verdict</h3>
      ${slider(CRIT[4])}
      <div class="toggle"><span>J’en reprendrais une</span><button type="button" class="switch" role="switch" id="fAgain" aria-checked="${form.again}" aria-label="J’en reprendrais une"></button></div>
    </div>

    <div class="sec"><h3>Le lieu</h3>
      <label class="f" for="fPlace">Bar ou endroit</label><input class="in" id="fPlace" list="dlPlaces" placeholder="Délirium Café, Moeder Lambic, À la Mort Subite…" value="${esc(form.place)}" autocomplete="off">
      <datalist id="dlPlaces">${places.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
      <label class="f">Ambiance du lieu</label>
      <div class="stars" role="radiogroup" aria-label="Ambiance sur 5">${[1,2,3,4,5].map(i=>`<button type="button" class="star${form.ambiance>=i?" on":""}" data-star="${i}" role="radio" aria-checked="${form.ambiance===i}" aria-label="${i} sur 5">★</button>`).join("")}</div>
    </div>

    <div class="sec"><h3>Le prix</h3>
      <div class="two"><div><label class="f" for="fPrice">Prix payé (€)</label><input class="in" id="fPrice" inputmode="decimal" placeholder="5,50" value="${esc(form.price)}"></div>
      <div><label class="f">Contenance</label>${chipGroup("volume", VOLUMES.map(v=>v+" cl"), false)}</div></div>
      <div class="calc" id="calc"></div>
    </div>

    <div class="sec"><h3>Ton mot</h3>
      <textarea class="in" id="fComment" maxlength="280" placeholder="Ce qui t’a marqué, l’accord avec les frites, le serveur…">${esc(form.comment)}</textarea>
    </div>

    <button class="btn wide" data-act="save">${existing?"Enregistrer les modifications":"Ajouter au carnet"}</button>
  </div>`;
  // le volume est stocké en nombre, affiché en "33 cl"
  sheet.querySelectorAll('[data-chip="volume"]').forEach(b=>b.setAttribute("aria-pressed", String(parseInt(b.dataset.val)===num(form.volume))));
  sheet.classList.add("open"); sheet.scrollTop = 0;
  document.body.style.overflow = "hidden";
  updateLive();
  setTimeout(()=>{ if(!existing) $("#fName").focus({preventScroll:true}); }, 340);
}
function closeForm(){ const s=$("#sheet"); s.classList.remove("open"); document.body.style.overflow=""; form=null; }
function updateLive(){
  if (!form) return;
  form.price = $("#fPrice") ? $("#fPrice").value : form.price;
  const sc = scoreOf(form);
  $("#liveScore").textContent = sc;
  $("#liveGlass").innerHTML = glass(sc, colorOf(form.color), 44);
  const p = num(form.price), v = num(form.volume);
  const calc = $("#calc");
  if (p>0 && v>0) {
    const perL = p/v*100, p33 = p*33/v;
    calc.innerHTML = `Soit <b>${fmt(perL,2)} € le litre</b> et <b>${fmt(sc/p33,1)} points par euro</b> (ramené à 33 cl), le critère du classement qualité/prix.`;
  } else calc.textContent = "Indique le prix pour entrer dans le classement qualité/prix.";
}
async function submitForm(){
  const name = $("#fName").value.trim();
  if (!name) { $("#fName").focus(); toast("Donne un nom à la bière."); return; }
  const prev = form.id ? state.tastings.find(t=>t.id===form.id) : null;
  const t = {
    id: form.id || ("t" + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
    uid: prev ? prev.uid : state.uid, pseudo: state.pseudo,
    name, brewery: $("#fBrew").value.trim(), abv: num($("#fAbv").value) || "",
    style: form.style, color: form.color, foam: form.foam, clarity: form.clarity,
    aromas: form.aromas, flavors: form.flavors, body: form.body, fizz: form.fizz, finish: form.finish,
    oeil: form.oeil, nez: form.nez, bouche: form.bouche, texture: form.texture, global: form.global,
    again: form.again, place: $("#fPlace").value.trim(), ambiance: form.ambiance,
    price: num($("#fPrice").value) || "", volume: num(form.volume) || 33,
    comment: $("#fComment").value.trim(), ts: prev ? prev.ts : Date.now()
  };
  const btn = document.querySelector('[data-act="save"]'); btn.disabled = true; btn.textContent = "Enregistrement…";
  const ok = await saveTasting(t);
  if (ok) { closeForm(); toast(`${t.name} : ${scoreOf(t)}/100, proost !`); state.tab = prev ? state.tab : "feed"; render(); window.scrollTo(0,0); }
  else { btn.disabled = false; btn.textContent = "Réessayer"; }
}

/* ---------- Prénom ---------- */
let afterName = null;
function askName(cb){
  afterName = cb || null;
  $("#nameInput").value = state.pseudo || "";
  $("#nameModal").classList.add("open");
  setTimeout(()=>$("#nameInput").focus(), 50);
}
async function saveName(){
  const v = $("#nameInput").value.trim();
  if (!v) { $("#nameInput").focus(); return; }
  const changed = state.pseudo && state.pseudo !== v;
  state.pseudo = v; ls.set("bb-pseudo", v);
  $("#nameModal").classList.remove("open");
  render();
  if (changed && !state.readOnly) { for (const t of state.tastings.filter(t=>t.uid===state.uid)) await saveTasting({...t, pseudo:v}); }
  const cb = afterName; afterName = null; if (cb) cb();
}

/* ---------- Événements ---------- */
document.addEventListener("click", async e => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.dataset.tab) { state.tab = el.dataset.tab; render(); window.scrollTo(0,0); return; }
  if (el.id === "addBtn" || el.dataset.act === "add") { openForm(null); return; }
  if (el.id === "meBtn") { askName(); return; }
  if (el.id === "nameSave") { saveName(); return; }
  if (el.dataset.act === "close") { closeForm(); return; }
  if (el.dataset.act === "save") { submitForm(); return; }
  if (el.dataset.sort) { state.sort = el.dataset.sort; render(); return; }
  if (el.dataset.feed) { state.feedMine = el.dataset.feed === "mine"; render(); return; }
  if (el.dataset.open) { const k = el.dataset.open; if (el.classList.contains("pod")) { state.open.add(k); render(); const r=document.querySelector(`.row[data-open="${CSS.escape(k)}"]`); r && r.scrollIntoView({behavior:"smooth",block:"center"}); } else { state.open.has(k)?state.open.delete(k):state.open.add(k); render(); } return; }
  if (el.dataset.edit) { const t = state.tastings.find(x=>x.id===el.dataset.edit); if (t) openForm(t); return; }
  if (el.dataset.del) { const t = state.tastings.find(x=>x.id===el.dataset.del); if (t && confirm(`Supprimer ta fiche « ${t.name} » ?`)) { if (await deleteTasting(t.id)) toast("Fiche supprimée"); } return; }
  if (!form) return;
  if (el.dataset.chip) {
    const f = el.dataset.chip, v = el.dataset.val;
    if (el.dataset.multi === "1") { form[f] = form[f].includes(v) ? form[f].filter(x=>x!==v) : [...form[f], v]; el.setAttribute("aria-pressed", String(form[f].includes(v))); }
    else {
      const val = f==="volume" ? parseInt(v) : v;
      form[f] = form[f]===val ? (f==="volume"?33:"") : val;
      el.parentElement.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String((f==="volume"?parseInt(c.dataset.val):c.dataset.val)===form[f])));
    }
    updateLive(); return;
  }
  if (el.dataset.color) { form.color = el.dataset.color; document.querySelectorAll("[data-color]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.color===form.color))); updateLive(); return; }
  if (el.dataset.star) { const i = +el.dataset.star; form.ambiance = form.ambiance===i ? 0 : i; document.querySelectorAll("[data-star]").forEach(s=>{ s.classList.toggle("on", form.ambiance>=+s.dataset.star); s.setAttribute("aria-checked", String(form.ambiance===+s.dataset.star)); }); return; }
  if (el.id === "fAgain") { form.again = !form.again; el.setAttribute("aria-checked", String(form.again)); return; }
});
document.addEventListener("input", e => {
  const r = e.target;
  if (r.dataset && r.dataset.range && form) {
    form[r.dataset.range] = parseFloat(r.value);
    r.style.setProperty("--p", (r.value*10)+"%");
    $("#o-"+r.dataset.range).textContent = fmt(parseFloat(r.value),1);
    updateLive();
  }
  if (r.id === "fPrice") updateLive();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && form) closeForm();
  if (e.key === "Enter" && e.target.id === "nameInput") saveName();
});

render();
if (!state.pseudo) askName();
initStore();
})();
</script>
</body>
</html>
```
