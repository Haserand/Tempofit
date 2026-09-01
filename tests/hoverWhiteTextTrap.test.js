import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 01/09, check-up de reprise — repéré via 2
// captures d'écran comparant "Mes Statistiques" (texte blanc invisible sur
// fond clair) et "Découvrir" (même style d'état vide, mais correctement
// visible)) — MÊME FAMILLE DE PIÈGE, déjà rencontrée et corrigée à la main
// À CHAQUE FOIS séparément, sans jamais laisser de garde-fou derrière :
//   - RoutinesView.jsx, 29/07 ("Centraliser les règles de couleur") : un
//     `hover:text-white` en dur remplacé par `hover:text-main`.
//   - GeneratorWizard.jsx, même famille documentée explicitement dans son
//     propre commentaire ("un blanc en dur serait invisible en thème
//     clair").
//   - StatsView.jsx / ProfileView.jsx / PlaylistDetailView.jsx, 01/09 (ce
//     check-up) : 3 nouvelles occurrences du MÊME piège, invisibles tant
//     que personne ne compare une capture d'écran en thème clair.
//
// Principe du piège : `text-white`/`hover:text-white` écrit EN DUR (pas
// `dark:text-white`, qui lui ne s'applique QUE dans le thème sombre où il
// est sans risque) sur un élément posé sur un fond ADAPTATIF (`bg-base`,
// `cardBg`, ou carrément aucun fond — la page elle-même), donc clair en
// thème clair : le texte devient blanc sur fond blanc/clair, invisible.
// `text-main`/`textHighlight` (useTheme.js) est l'équivalent adaptatif déjà
// utilisé PARTOUT ailleurs dans ce projet pour ce cas précis.
//
// ⚠️ CE GARDE-FOU NE FLAGUE VOLONTAIREMENT PAS TOUT `text-white` DU PROJET
// (bien plus permissif que ça) — seulement `hover:text-white`/`text-white`
// SANS aucune classe de fond coloré/opaque associée sur la même ligne (un
// bouton avec `bgAccentClass`/`bg-black`/`bg-primary`... à côté reste tout à
// fait légitime : le fond y est TOUJOURS coloré, quel que soit le thème,
// donc le blanc y est sans risque). Cette vérification "même ligne" est un
// choix délibéré (comme `DANGEROUS_CONCAT`, tailwindConcatTrap.test.js) :
// simple, fiable sur ce projet où une classe Tailwind et son contexte
// tiennent quasi toujours sur une seule ligne de JSX.
//
// EXCEPTIONS DOCUMENTÉES (liste blanche, même esprit que NO_SINGLE_SUBJECT,
// testFileIdentityTrap.test.js) : la famille PlaylistHeader*.jsx utilise un
// fond FIXE volontairement sombre, INDÉPENDANT du thème choisi (verre
// dépoli façon en-tête d'album Spotify — voir la docstring de
// PlaylistHeader.jsx) — `text-white` y est un choix assumé, jamais un bug.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');

// Chaque entrée est un fichier ENTIER dont TOUT le fond est fixe et
// indépendant du thème choisi (jamais `bg-base`/`cardBg` adaptatif) —
// vérifié manuellement pour chacun avant ajout ici, jamais une exemption de
// confort. Un fichier normal (fond adaptatif à un endroit, coloré à un
// autre) ne doit PAS être ajouté ici : voir plutôt `SAFE_BG_NEARBY`
// ci-dessus, qui couvre déjà ce cas au cas par cas.
const ALLOWLISTED_FIXED_DARK_FILES = new Set([
  // Verre dépoli sombre FIXE façon en-tête d'album Spotify, volontairement
  // indépendant du thème clair/sombre (voir la docstring de
  // PlaylistHeader.jsx, section "Refonte visuelle").
  'components/views/PlaylistDetail/PlaylistHeader.jsx',
  'components/views/PlaylistDetail/PlaylistHeaderActions.jsx',
  'components/views/PlaylistDetail/PlaylistHeaderBadges.jsx',
  'components/views/PlaylistDetail/PlaylistHeaderCover.jsx',
  'components/views/PlaylistDetail/PlaylistHeaderMeta.jsx',
  'components/views/PlaylistDetail/PlaylistHeaderTitleBlock.jsx',
  // Cartes-images à partager (html2canvas) — dégradé de couleurs FIXE en
  // arrière-plan (voir leur propre docstring), jamais le thème de l'app :
  // ces cartes sont pensées pour être exportées telles quelles, identiques
  // quel que soit le thème choisi au moment du partage.
  'components/shared/GlobalStatsShareCard.jsx',
  'components/shared/SessionSummaryCard.jsx',
  // Logo cliquable en haut de la Sidebar : icône dans un badge
  // `${bgAccentClass}` (toujours coloré), mais séparé d'elle par un long
  // commentaire documentant un ajustement de taille — hors de portée de la
  // fenêtre de lignes de ce garde-fou (voir SAFE_BG_NEARBY/CONTEXT_LINES_*),
  // vérifié manuellement.
  'components/shared/Sidebar.jsx',
]);

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Préserve le nombre de lignes en retirant les commentaires (remplace leur
// contenu par des retours à la ligne plutôt que par une chaîne vide) — sinon
// un commentaire de bloc multi-lignes décale tous les numéros de ligne
// rapportés dans le message d'erreur par rapport au fichier réel.
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/([^:])\/\/.*$/gm, '$1');
}

// Repère `text-white`/`hover:text-white` NI précédé de `dark:` (déjà sans
// risque, cantonné au thème sombre) NI accompagné d'un vrai `text-white/NN`
// (opacité, même famille que `text-white` mais implicitement déjà posé sur
// un fond coloré dans tous les cas rencontrés ici — voir
// AthleticProfilePanel.jsx). Capture aussi le préfixe `dark:` éventuel (`m[1]`)
// pour l'exclure explicitement, plutôt qu'un lookbehind fixe : `(?:hover:)?`
// étant optionnel, un lookbehind de longueur fixe se ferait contourner en
// matchant directement après "dark:hover:" (le lookbehind ne verrait alors
// que "hover:", pas "dark:"). Volontairement RESTREINT à la variante
// `hover:` + le cas de base sans variante (pas `focus:text-white` etc.,
// jamais rencontré, pour ne pas élargir la surface de faux positifs au-delà
// des incidents réels déjà observés.
const SUSPECT_PATTERN = /(dark:)?(?:hover:)?text-white\b(?!\/)/g;

// Une couleur de fond COLORÉE/OPAQUE à PROXIMITÉ (classe Tailwind, y compris
// interpolée, ou style inline `backgroundColor`) rend le blanc sans risque,
// quel que soit le thème (le fond n'est alors jamais adaptatif). Fenêtre de
// plusieurs lignes (pas seulement la ligne courante) : le cas le plus
// fréquent ici est une icône `text-white` à l'intérieur d'un conteneur
// PARENT coloré (`<div className={bgAccentClass}>`), sur la ligne
// précédente — jamais la même ligne que l'icône elle-même.
const SAFE_BG_NEARBY = /bg-(?!transparent|clip|none)[a-z]+|bg-\$\{|bgAccentClass|bg-black|bg-white\/|gradient|backgroundColor/;
const CONTEXT_LINES_BEFORE = 2;
const CONTEXT_LINES_AFTER = 1;

describe('Garde-fou anti-piège "hover:text-white" en dur sur fond adaptatif', () => {
  const files = walk(SRC_DIR);

  it('a bien trouvé des fichiers source à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('ne contient aucun texte blanc en dur (hors dark:) sans fond coloré associé, en dehors de la liste blanche documentée', () => {
    const offenders = [];
    for (const file of files) {
      const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
      if (ALLOWLISTED_FIXED_DARK_FILES.has(relPath)) continue;

      const content = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        SUSPECT_PATTERN.lastIndex = 0;
        let m;
        while ((m = SUSPECT_PATTERN.exec(line))) {
          if (m[1]) continue; // précédé de "dark:" — sans risque, cantonné au thème sombre.
          const windowStart = Math.max(0, i - CONTEXT_LINES_BEFORE);
          const windowEnd = Math.min(lines.length, i + 1 + CONTEXT_LINES_AFTER);
          const window = lines.slice(windowStart, windowEnd).join('\n');
          if (!SAFE_BG_NEARBY.test(window)) {
            offenders.push(`${relPath}:${i + 1} → ${line.trim().slice(0, 140)}`);
          }
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        'Piège "texte blanc en dur sur fond adaptatif" détecté (voir passation du 01/09 — ' +
          'StatsView.jsx/ProfileView.jsx/PlaylistDetailView.jsx, même famille que RoutinesView.jsx ' +
          'du 29/07 et GeneratorWizard.jsx) :\n' +
          offenders.join('\n') +
          '\n\nRemplacer par `text-main`/`${textHighlight}` (adaptatif clair/sombre, useTheme.js), ' +
          'sauf si l\'élément est VRAIMENT posé sur un fond fixe sombre ou coloré (auquel cas, ajouter ' +
          'le fichier à ALLOWLISTED_FIXED_DARK_FILES ci-dessus avec la justification).'
      );
    }
    expect(offenders).toEqual([]);
  });
});
