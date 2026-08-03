import { curatedSessions, naughtyCuratedSessions, fakeCloneCountForId } from './curatedSessions';
import { buildCoverUrl } from '../utils/coverArt';

/**
 * officialVitrineProfile.js — Feature Sociale "Cold Start" (02/08). Profil
 * de démonstration "@tempofit_officiel", jamais stocké en base, entièrement
 * reconstruit CÔTÉ CLIENT à chaque visite — sert de vitrine aux nouveaux
 * visiteurs (y compris NON connectés, voir le raisonnement Login Wall dans
 * ProfileView.jsx) pour montrer le potentiel de l'app avant même la
 * création d'un compte.
 *
 * ✅ Collision avec un vrai compte — RÉSOLUE depuis (relecture globale,
 * 02/08) : au moment où cette vitrine a été écrite, rien n'empêchait
 * encore un vrai utilisateur de réserver le pseudo `tempofit_officiel`
 * lui-même (il matche le format valide `^[a-z0-9_]{3,20}$`). Depuis le
 * chantier "Correctif UX — pseudos réservés" (voir src/utils/username.js
 * ET la contrainte SQL `profiles_username_not_reserved`,
 * supabase-schema.sql), ce pseudo précis est désormais BLOQUÉ des DEUX
 * côtés (frontend ET base de données) — il contient "tempofit", capté par
 * le motif réservé, et ne bénéficie pas de l'exception (réservée à
 * `tempofit_admin` uniquement). Vérifié : `isReservedUsername('tempofit_officiel')`
 * renvoie bien `true`. Un vrai compte ne peut donc structurellement plus
 * jamais entrer en collision avec cette vitrine.
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
// `{...row.content, ...}`.
//
// ⚠️ CORRIGÉ (02/08, retour direct : "la vitrine ne montre pas toutes les
// fonctionnalités") — `content.tracks` MANQUAIT ici depuis le début (voir
// l'ancienne version de ce commentaire, qui le justifiait comme un choix
// volontaire "un template n'a pas de vrais tracks pré-calculés dans
// content"). C'était vrai au moment où ce fichier a été écrit, mais le
// chantier "Recherche & filtres sur les profils publics" (`useProfileSearchFilter.js`)
// est arrivé APRÈS et extrait les genres d'une playlist via
// `content.tracks` — sans ce champ, TOUTE playlist de la vitrine
// remontait 0 genre, invisible pour le filtre genre ET la recherche
// textuelle sur les genres, silencieusement (`extractGenres` replie sur
// `[]` sans jamais planter). `template.tracks` est déjà disponible juste
// au-dessus (utilisé pour `totalDuration`/`avgBpm`) — l'ajouter à
// `content` ne coûte rien de plus à calculer, juste à exposer.
//
// `description`/`clone_count` (même chantier de correctif) — AJOUTÉS ici
// pour que la vitrine démontre RÉELLEMENT ces 2 fonctionnalités à un
// visiteur non connecté, pas seulement les stats/genres/BPM déjà en
// place. Même philosophie que `FAKE_SPORT_SESSIONS`/`FAKE_INTIMATE_SESSIONS`
// plus haut : "ambitieux mais volontairement faux", déterministe (jamais
// `Math.random()` — un rendu de plus ne doit jamais afficher un nombre
// différent du précédent). `fakeCloneCountForId` : importée de
// curatedSessions.js (PAS redéfinie ici) — voir sa docstring là-bas :
// partagée avec `TemplateCard.jsx` (Découvrir), pour qu'un même template
// affiche TOUJOURS le même nombre, qu'on le consulte depuis Découvrir ou
// depuis cette vitrine.
const CATEGORY_DESCRIPTIONS = {
  'Cardio Express': "Une session courte et intense, pensée pour un cardio efficace même avec un emploi du temps chargé.",
  'Endurance Fondamentale': "Un rythme régulier pour construire ton endurance de fond, séance après séance.",
  'Force & Renfo': "De quoi accompagner une séance de renforcement musculaire, sans jamais casser le rythme.",
  'Race Day / Performance': "La sélection pensée pour le jour J — quand chaque BPM compte.",
  'Récupération & Flow': "Un tempo plus doux, pour une séance de récupération active, sans se presser.",
  'Rythmes Sensuels': "Une ambiance plus intime, pensée pour un moment à part.",
};

function templateToVitrineRow(template, isIntimate) {
  const totalDuration = template.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const avgBpm = template.tracks.length > 0
    ? Math.round(template.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / template.tracks.length)
    : null;
  return {
    id: `vitrine-${template.id}`,
    is_public: true,
    is_intimate: isIntimate,
    clone_count: fakeCloneCountForId(template.id),
    content: {
      name: template.title,
      workoutType: template.workoutType,
      totalDuration,
      config: { bpm: avgBpm },
      coverUrl: buildCoverUrl(template.title),
      tracks: template.tracks,
      description: CATEGORY_DESCRIPTIONS[template.category] || undefined,
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

// Routines fictives de la vitrine (brief "Recherche & filtres sur les
// profils publics", chantier annexe, 02/08) — PAS de conversion depuis un
// template existant comme `templateToVitrineRow` ci-dessus :
// `curatedSessions.js` ne contient que des PLAYLISTS (vraies pistes + BPM),
// aucune routine n'existe dans le catalogue statique. Écrites à la main,
// dans la forme RÉELLE lue par `PublicItemCard`/`useProfileSearchFilter`
// (ProfileView.jsx) pour une routine — vérifiée dans le code actuel, pas
// devinée : `name`/`coverIcon`/`workoutType`/`bpm`/`selectedGenres`, une
// CIBLE plutôt qu'un résultat généré (`targetMode: 'distance'|'time'` +
// `distanceVal`/`distanceUnit` OU `hours`/`minutes`) — jamais
// `content.tracks`/`content.totalDuration`, qui n'existent que pour une
// playlist déjà générée.
//
// Genres ADAPTÉS aux valeurs canoniques réelles du catalogue
// (`musicCatalog.js`, `STANDARD_GENRES`/`NAUGHTY_GENRES`/`EXTRA_GENRES`) —
// le brief proposait "Hip-Hop"/"Lo-fi"/"Électro", qui n'existent PAS tels
// quels dans ce projet : remplacés par leurs équivalents réels les plus
// proches ("Rap", pas de mood lo-fi disponible donc retiré, "Electro" sans
// accent — c'est la clé interne réelle, `genreDisplayLabel` ne la
// retraduit pas). "Rituel du Soir" (intime) utilise "R&B Sensuel", la
// variante du genre réservée au Mode Intime (`NAUGHTY_GENRES`), pas "R&B"
// tout court (catalogue Sport).
// ⚠️ CORRIGÉ (02/08, même retour direct que templateToVitrineRow plus
// haut) — `description`/`clone_count` manquaient ici aussi : ces routines
// ont été écrites avant que ces 2 fonctionnalités n'existent (voir les
// dates des chantiers respectifs), jamais mises à jour depuis. Valeurs
// FIXES (pas de `fakeCloneCountForId` ici, contrairement aux playlists) —
// seulement 4 routines, une variation à la main reste lisible et évite
// d'introduire un hash pour un si petit nombre d'entrées.
const FAKE_VITRINE_ROUTINES = [
  {
    id: 'vitrine-routine-1', is_public: true, is_intimate: false, clone_count: 34,
    content: {
      name: 'Mon 5km Quotidien', coverIcon: '🏃', workoutType: 'Course à pied',
      targetMode: 'distance', distanceVal: 5, distanceUnit: 'km',
      bpm: 160, selectedGenres: ['Métal', 'Rock'],
      description: "Le rituel du matin, tous les jours ou presque — de quoi enchaîner sans réfléchir à la playlist.",
    },
  },
  {
    id: 'vitrine-routine-2', is_public: true, is_intimate: false, clone_count: 19,
    content: {
      name: 'Sortie Longue Weekend', coverIcon: '🚴', workoutType: 'Cyclisme',
      targetMode: 'time', hours: 1, minutes: 30,
      bpm: 130, selectedGenres: ['Electro', 'Pop'],
      description: "1h30 sur les routes, un tempo qui tient la distance sans jamais lasser.",
    },
  },
  {
    id: 'vitrine-routine-3', is_public: true, is_intimate: false, clone_count: 51,
    content: {
      name: 'HIIT Express', coverIcon: '🔥', workoutType: 'Fractionné',
      targetMode: 'time', hours: 0, minutes: 20, isIntervalMode: true, isCrescendoMode: false,
      bpm: 175, selectedGenres: ['Rap', 'Electro'],
      description: "20 minutes, aucun temps mort — pour les jours où le temps manque mais pas l'envie.",
    },
  },
  {
    id: 'vitrine-routine-4', is_public: true, is_intimate: true, clone_count: 12,
    content: {
      name: 'Rituel du Soir', coverIcon: '🌙', workoutType: 'Ambiance',
      targetMode: 'time', hours: 0, minutes: 25,
      bpm: 90, selectedGenres: ['R&B Sensuel'],
      description: "Un moment rien qu'à soi, en douceur, pour clore la journée autrement.",
    },
  },
];

/**
 * Toutes les "routines partagées" de la vitrine — même principe EXACT que
 * `buildOfficialVitrinePlaylistRows` juste au-dessus (Sport ET Intime
 * confondus, le filtrage par mode déjà existant dans ProfileView.jsx
 * s'applique sans modification) : la seule différence est qu'il n'y a pas
 * de conversion à faire, `FAKE_VITRINE_ROUTINES` est déjà dans la forme
 * finale attendue.
 */
export function buildOfficialVitrineRoutineRows() {
  return FAKE_VITRINE_ROUTINES;
}
