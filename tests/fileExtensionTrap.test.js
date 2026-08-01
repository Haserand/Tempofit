import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 01/08, sur remarque directe de
// l'utilisateur : "je me plante parfois sur les extensions de fichiers à
// cause d'un mauvais copier/coller") — un fichier qui contient du VRAI JSX
// mais se retrouve sauvegardé en `.js` (au lieu de `.jsx`) casse le build
// SILENCIEUSEMENT au niveau du bundler, pas d'une simple erreur de lint :
// `@vitejs/plugin-react` n'applique sa transformation JSX (JSX → appels
// React.createElement) qu'aux fichiers `.jsx`/`.tsx` par défaut — un
// fichier `.js` contenant du JSX échoue au parsing avec une erreur de
// syntaxe généralement peu explicite (voir déjà le commentaire de
// vite.config.js à ce sujet, pour la raison symétrique côté `tests/`).
// Autrement dit : remplacer par erreur `ShareModal.jsx` par un fichier
// nommé `ShareModal.js` (même contenu, juste la mauvaise extension) ne
// serait PAS détecté par le garde-fou noDuplicateFiles.test.js (les 2
// fichiers ne coexisteraient pas, l'ancien .jsx aurait simplement disparu)
// — seul CE test-ci attrape ce cas précis.
//
// Principe : scanner tout `.js` de `src/`/`tests/` à la recherche de motifs
// syntaxiquement propres au JSX (balise fermante `</Nom`, fragment `<>`/
// `</>`, ou balise auto-fermante `/>`) — ces 3 motifs n'ont, par
// construction, aucune raison d'apparaître dans du JS/TS classique (pas de
// generics `<T>` dans ce projet, pas de TypeScript). Vérifié manuellement à
// l'écriture de ce test : 0 faux positif sur l'intégralité du projet actuel.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const TESTS_DIR = path.resolve(__dirname);

function walkJsOnly(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkJsOnly(full));
    } else if (/\.js$/.test(entry.name) && full !== __filename) {
      // .jsx exclu volontairement : c'est justement l'extension attendue
      // pour du JSX, rien à vérifier dessus ici. CE fichier (__filename)
      // exclu aussi : sa propre regex JSX_ONLY_MARKERS contient
      // littéralement les motifs recherchés (faux positif garanti sinon,
      // repéré en testant ce garde-fou avant de le livrer).
      files.push(full);
    }
  }
  return files;
}

// Même approche que tailwindConcatTrap.test.js : retire les commentaires
// avant analyse, pour ne pas flaguer une docstring qui CITE du JSX en
// exemple (ex: la docstring de GlobalStatsShareCard.jsx qui mentionne
// littéralement `<GlobalStatsShareCard />`).
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

// Balise fermante (</Nom ou </>), fragment ouvrant (<>), ou balise
// auto-fermante (/>) — volontairement PAS de détection de balise ouvrante
// seule (<Nom ou <div) : trop de faux positifs possibles avec des
// comparateurs numériques collés sans espace (ex: `a<b`), alors que ces 3
// motifs-ci n'ont aucune signification légitime en JS/JSX en dehors du JSX
// lui-même.
const JSX_ONLY_MARKERS = /<\/[A-Za-z]|<>|<\/>|\/>/;

describe('Garde-fou anti-régression : aucun fichier .js ne doit contenir du JSX (piège d\'extension)', () => {
  const files = [...walkJsOnly(SRC_DIR), ...walkJsOnly(TESTS_DIR)];

  it('a bien trouvé des fichiers .js à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('ne contient aucun motif JSX (balise fermante, fragment, auto-fermante) dans un fichier .js', () => {
    const offenders = [];
    for (const file of files) {
      const content = stripComments(fs.readFileSync(file, 'utf-8'));
      content.split('\n').forEach((line, i) => {
        if (JSX_ONLY_MARKERS.test(line)) {
          offenders.push(
            `${path.relative(path.resolve(__dirname, '..'), file)}:${i + 1} → ${line.trim().slice(0, 100)}`
          );
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        'Motif JSX détecté dans un fichier .js (voir passation 01/08 — piège d\'extension ' +
          'après copier/coller) :\n' +
          offenders.join('\n') +
          '\n\nSi ce fichier contient réellement du JSX, il doit être renommé en .jsx — ' +
          '@vitejs/plugin-react n\'applique sa transformation JSX qu\'aux fichiers .jsx/.tsx, ' +
          'un .js contenant du JSX casse le build au parsing. Si c\'est un faux positif ' +
          '(motif JSX-like dans une chaîne/regex légitime), ajuster JSX_ONLY_MARKERS ci-dessus ' +
          'plutôt que d\'ignorer l\'alerte.'
      );
    }
    expect(offenders).toEqual([]);
  });
});
