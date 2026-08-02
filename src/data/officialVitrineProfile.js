import { curatedSessions, naughtyCuratedSessions } from './curatedSessions';
import { buildCoverUrl } from '../utils/coverArt';

/**
 * officialVitrineProfile.js — Feature Sociale "Cold Start" (02/08). Profil
 * de démonstration "@tempofit_officiel", jamais stocké en base, entièrement
 * reconstruit CÔTÉ CLIENT à chaque visite — sert de vitrine aux nouveaux
 * visiteurs (y compris NON connectés, voir le raisonnement Login Wall dans
 * ProfileView.jsx) pour montrer le potentiel de l'app avant même la
 * création d'un compte.
 *
 * ⚠️ Collision possible, mineure — `tempofit_officiel` est un pseudo au
 * format VALIDE (`^[a-z0-9_]{3,20}$`, voir AuthContext.jsx) : si un jour un
 * vrai utilisateur parvenait à le réserver AVANT que ce court-circuit
 * n'existe (ou si la vérification d'unicité était contournée), son vrai
 * profil deviendrait invisible, masqué par cette vitrine. Risque jugé
 * faible (pseudo clairement de marque, personne ne le choisirait par
 * hasard) mais réel — à traiter séparément si besoin (ex. bloquer ce pseudo
 * précis à l'inscription côté `is_username_available`, supabase-schema.sql)
 * plutôt que dans ce fichier, qui n'a pas la main sur l'inscription.
 */
export const OFFICIAL_VITRINE_USERNAME = 'tempofit_officiel';

// Statistiques ambitieuses mais volontairement FAUSSES (brief explicite :
// "statistiques fictives ambitieuses") — un tableau de fausses séances
// `{ totalDuration, bpm }` (même forme EXACTE que ce que
// `get_public_profile_summary` renvoie pour un vrai profil, voir
// supabase-schema.sql) plutôt que des totaux calculés à la main : le reste
// de ProfileView.jsx (summarizeSessions) les agrège EXACTEMENT comme pour
// un vrai profil, aucune branche de rendu séparée à maintenir. Valeurs
// LÉGÈREMENT variées (pas un `Array(N).fill(...)` identique partout) pour
// ne pas ressembler à des données de test à l'œil — mais dérivées de `i`
// (déterministe), jamais `Math.random()` : un rendu de plus ne doit jamais
// afficher un chiffre différent du précédent.
function buildFakeSessions(count, { minMinutes, maxMinutes, minBpm, maxBpm }) {
  return Array.from({ length: count }, (_, i) => ({
    totalDuration: (minMinutes + (i % (maxMinutes - minMinutes + 1))) * 60,
    bpm: minBpm + (i % (maxBpm - minBpm + 1)),
  }));
}

const FAKE_SPORT_SESSIONS = buildFakeSessions(340, { minMinutes: 22, maxMinutes: 52, minBpm: 128, maxBpm: 172 });
const FAKE_INTIMATE_SESSIONS = buildFakeSessions(85, { minMinutes: 12, maxMinutes: 34, minBpm: 96, maxBpm: 138 });

/**
 * Construit l'objet "profil" mocké — MÊME FORME que ce que
 * `get_public_profile_summary` renvoie pour un vrai profil (`username`,
 * `user_id`, `avatar_url`, `sport_sessions`, `intimate_sessions`) : le
 * reste de ProfileView.jsx (bannière "Aperçu de ton profil", blocs de
 * stats Sport/Intime, cloisonnement par `isNaughtyMode`) fonctionne donc
 * SANS AUCUNE modification, exactement comme pour un profil réel.
 *
 * `user_id: null` — jamais égal à un vrai `user.id` (toujours une chaîne
 * UUID pour un compte réel) : `isSelf` (ProfileView.jsx,
 * `user?.id === profile.user_id`) reste donc TOUJOURS `false` ici, même
 * pour l'équipe TempoFit elle-même connectée — cette vitrine n'est
 * JAMAIS "ton propre profil", quel que soit le visiteur.
 *
 * `avatar_url: null` — pas de nouvel asset image à maintenir : le repli
 * déjà existant (cercle coloré + 1re lettre du pseudo, voir ProfileView.jsx)
 * suffit et reste cohérent avec l'identité visuelle de l'app.
 *
 * Les DEUX tableaux de stats (sport ET intime) sont TOUJOURS renvoyés
 * ensemble, jamais conditionnés à `isNaughtyMode` ICI — c'est le rendu
 * existant de ProfileView.jsx (`showSportBlock`/`showIntimateBlock`, déjà
 * basé sur `isNaughtyMode` du VISITEUR) qui décide lequel afficher. Poser
 * les deux d'un coup évite de reconstruire ce profil à chaque bascule de
 * mode — un seul objet statique suffit pour toute la durée de la visite.
 */
export function buildOfficialVitrineProfile() {
  return {
    username: OFFICIAL_VITRINE_USERNAME,
    user_id: null,
    avatar_url: null,
    sport_sessions: FAKE_SPORT_SESSIONS,
    intimate_sessions: FAKE_INTIMATE_SESSIONS,
  };
}

// Convertit un template du catalogue (data/curatedSessions.js — `title`,
// `tracks`, `workoutType`...) en une "ligne" compatible avec
// PublicItemCard (ProfileView.jsx), qui attend la même forme qu'une VRAIE
// ligne de la table `playlists` (`id`, `content`, `is_intimate`) — mêmes
// champs LUS par ce composant (`content.name`/`workoutType`/
// `totalDuration`/`config.bpm`/`coverUrl`), calculés ici une seule fois
// plutôt que de complexifier PublicItemCard pour qu'il gère 2 formes
// différentes. `_sourceTemplate` : PAS un champ de PublicItemCard, lu
// uniquement par `handleOpenPublicPlaylist` (App.jsx) pour savoir
// qu'il faut ouvrir ce résultat via `openCuratedPlaylist` (reconstruction
// COMPLÈTE avec les vrais titres) plutôt que le raccourci habituel
// `{...row.content, ...}` — un template n'a pas de vrais `tracks`
// pré-calculés dans `content`, contrairement à une vraie playlist.
function templateToVitrineRow(template, isIntimate) {
  const totalDuration = template.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const avgBpm = template.tracks.length > 0
    ? Math.round(template.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / template.tracks.length)
    : null;
  return {
    id: `vitrine-${template.id}`,
    is_public: true,
    is_intimate: isIntimate,
    content: {
      name: template.title,
      workoutType: template.workoutType,
      totalDuration,
      config: { bpm: avgBpm },
      coverUrl: buildCoverUrl(template.title),
    },
    _sourceTemplate: template,
  };
}

/**
 * Toutes les "playlists partagées" de la vitrine — catalogue Sport ET
 * Intime CONFONDUS (même principe que `buildOfficialVitrineProfile` pour
 * les stats) : le filtrage par mode (`visiblePlaylists`, ProfileView.jsx,
 * `row.is_intimate === isNaughtyMode`) est du code EXISTANT, déjà
 * correct — pas besoin de le dupliquer ni de le contourner ici.
 */
export function buildOfficialVitrinePlaylistRows() {
  return [
    ...curatedSessions.map(t => templateToVitrineRow(t, false)),
    ...naughtyCuratedSessions.map(t => templateToVitrineRow(t, true)),
  ];
}
