# Deezer Connect (login/synchro favoris) — retiré, voici pourquoi

**Date** : juillet 2026.

## Ce qui a été retiré, et ce qui NE L'A PAS été

TempoFit utilise Deezer à **deux endroits complètement séparés**, à ne pas
confondre :

1. **Le catalogue Deezer** (recherche de titres, résolution du BPM,
   génération de playlists — `musicEngine.js`, `api/deezer.js`) — utilise
   l'API publique de catalogue, **sans inscription développeur nécessaire**.
   Ceci **fonctionne toujours normalement**, aucun rapport avec ce document.

2. **"Se connecter à Deezer"** (importer les titres favoris/artistes suivis
   d'un compte Deezer personnel, façon Spotify) — c'est CETTE partie qui a
   été retirée, documentée ci-dessous.

## Pourquoi

Deezer **n'accepte plus de nouvelles inscriptions d'application** sur son
Dashboard développeur (`developers.deezer.com/myapps`) — confirmé début
2025-2026 par un message du Dashboard lui-même : *"We're not accepting new
application creation at this time. Please check again later."* Sans
inscription, impossible d'obtenir un `App ID`/`Secret Key`, donc impossible
d'authentifier qui que ce soit via ce flow — la fonctionnalité était
entièrement construite (code fonctionnel, jamais testé en conditions
réelles faute d'identifiants) mais restait bloquée dès la 1re étape.

Contrairement à Spotify (bloqué par une exigence Premium + liste blanche,
mais où l'inscription elle-même reste ouverte), ici il n'y a littéralement
aucun moyen de débloquer la situation sans que Deezer rouvre les
inscriptions de leur côté — rien à corriger côté TempoFit.

## Fichiers retirés

- `api/deezer-auth.js` (proxy d'échange code → token)
- `src/deezerImportEngine.js` (fetch titres favoris/artistes suivis)
- `src/hooks/useDeezerImport.js` (hook d'authentification + synchro)
- Le bloc "Deezer" dans `src/components/views/SettingsView.jsx`
- Le câblage correspondant dans `src/App.jsx`

`supabase-schema.sql`/comptes utilisateurs/Spotify : **aucun rapport**, tous
inchangés.

## Comment reconstruire si Deezer rouvre un jour les inscriptions

Le flow technique (déjà validé par la doc officielle Deezer au moment de la
construction initiale) :
- Autorisation : `https://connect.deezer.com/oauth/auth.php?app_id=APP_ID&redirect_uri=REDIRECT_URI&perms=basic_access,email,offline_access`
- Échange du code : `https://connect.deezer.com/oauth/access_token.php?app_id=APP_ID&secret=SECRET&code=CODE&output=json` (renvoie `{access_token, expires}` — `expires: 0` = token permanent, pas de refresh token à gérer)
- Titres favoris : `GET https://api.deezer.com/user/me/tracks?access_token=TOKEN` (pagination via `next`)
- Artistes suivis : `GET https://api.deezer.com/user/me/followings?access_token=TOKEN` (filtrer sur `type === 'artist'`, ce endpoint mélange aussi les amis Deezer suivis)
- OAuth "classique" (pas PKCE) — le secret d'app doit rester dans une fonction serverless (voir la structure d'`api/deezer-auth.js` dans l'historique Git), jamais côté client.

Plutôt que de repartir de zéro, redemander directement ce chantier — cette
note + l'historique Git (si ces fichiers ont été commités avant suppression)
suffisent à le reconstruire à l'identique.
