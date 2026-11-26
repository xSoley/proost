# Proost

La cave numérique de dégustation entre amis. Vite + React + TypeScript, Supabase (auth, Postgres, stockage, temps réel), déployé sur Vercel.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les deux clés
npm run dev            # http://localhost:5173 (et l'IP locale pour tester sur téléphone)
```

## Mise en place (à faire une fois, à la main)

### 1. Supabase
1. Créer un compte sur [supabase.com](https://supabase.com) → **New project** (offre gratuite). Choisir une région européenne (ex. Frankfurt / Paris), noter le mot de passe de la base.
2. **SQL Editor** → **New query** → coller tout le contenu de `supabase/migrations/20261126000000_init.sql` → **Run**. Les migrations suivantes (dossier `supabase/migrations`) s'appliquent de la même façon, dans l'ordre.
3. **Project Settings → API** (ou **Connect**) : copier
   - *Project URL* → `VITE_SUPABASE_URL`
   - clé *publishable* → `VITE_SUPABASE_PUBLISHABLE_KEY` (l'ancienne clé *anon* fonctionne aussi sous `VITE_SUPABASE_ANON_KEY`). Jamais la clé secrète / `service_role`.
4. **Authentication → Sign In / Providers → Email** : laisser *Email* activé.
   - *Confirm email* : activé par défaut (l'utilisateur doit cliquer un lien avant la 1re connexion). Le désactiver si on veut pouvoir s'inscrire au bar sans passer par sa boîte mail.
   - *Minimum password length* : 6.
5. **Authentication → URL Configuration** :
   - *Site URL* : l'URL Vercel de production, ex. `https://proost.vercel.app`
   - *Redirect URLs* : ajouter `https://proost.vercel.app/**` et `http://localhost:5173/**`
   (nécessaire pour les liens de confirmation et de mot de passe oublié).

### 2. GitHub
1. Créer un dépôt vide (privé) nommé `proost` sur github.com.
2. Dans ce dossier :
   ```bash
   git remote add origin https://github.com/xSoley/proost.git
   git push -u origin main
   ```

### 3. Vercel
1. Sur [vercel.com](https://vercel.com) → **Add New → Project** → importer le dépôt GitHub `proost`.
2. Framework : *Vite* (détecté automatiquement). Build : `npm run build`, dossier : `dist`.
3. **Environment Variables** : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` → **Deploy**.
4. Chaque `git push` sur `main` redéploie automatiquement.
5. Reporter l'URL obtenue dans Supabase (étape 1.5).

## Structure
- `src/styles/global.css` : CSS du prototype, repris tel quel, + quelques ajouts.
- `src/categories/beer.ts` : critères de notation, pondérations et référentiels de la bière (ajouter `wine.ts` plus tard).
- `supabase/migrations/` : schéma SQL versionné (tables, RLS, stockage, RPC).

## Tester les règles de sécurité
```bash
node --env-file=.env.local scripts/test-rls.mjs
```
Crée deux comptes jetables (Alice et Bob), vérifie qui voit, modifie et lit quoi (fiches, groupes, photos), puis les supprime.

```bash
node --env-file=.env.local scripts/test-groups.mjs
```
Invitation, temps réel, régénération du code, retrait d'un membre, départ, suppression d'un groupe (trois comptes jetables).

```bash
npm run build && npx vite preview --port 4173   # dans un autre terminal
node --env-file=.env.local scripts/test-devices.mjs
```
Sur iPhone et Android émulés (Chrome) : inscription, installabilité PWA, fiche avec photo, ouverture hors ligne, fiche hors ligne puis envoi au retour du réseau. Captures dans `test-captures/`.

## Installer l'appli sur son téléphone
- **iPhone (Safari)** : ouvrir le site → bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir le site → menu ⋮ → « Installer l'application » (ou la bannière proposée).

Une fois installée, Proost s'ouvre en plein écran, même sans réseau : les fiches notées hors ligne partent toutes seules au retour du réseau.
