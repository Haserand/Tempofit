import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 05/08, suite à un incident réel) —
// `EditRoutineModal.test.jsx` avait été livré/sauvegardé dans
// `src/components/modals/` au lieu de `tests/modals/` (viole la
// convention "tests/ en miroir de src/", voir README.md, section Tests).
// Conséquence réelle, totalement SILENCIEUSE : `vite.config.js` restreint
// Vitest à `test.include: ['tests/**/*.test.{js,jsx}']` — un fichier
// `.test.jsx` posé sous `src/` n'est JAMAIS exécuté par `vitest run`, donc
// jamais par le build Vercel réel non plus. Aucune erreur, aucun
// avertissement : le fichier existe, contient des tests d'apparence
// parfaitement valide, et ne tourne tout simplement jamais. Dans le cas
// réel qui a motivé ce garde-fou, TOUTE la couverture de test d'un
// chantier entier (validation "cible à 0", EditRoutineModal.jsx) était
// concernée sans que rien ne le signale.
//
// Aucun des 3 garde-fous existants au moment de l'incident
// (noDuplicateFiles.test.js, testFileIdentityTrap.test.js,
// fileExtensionTrap.test.js) ne détecte ce cas précis : les 3 ne scannent
// QUE `tests/` (voir leur propre `TESTS_DIR`/`SRC_DIR`), donc un fichier
// de test posé HORS de `tests/` leur est structurellement invisible — ce
// test-ci est le seul à scanner le reste du dépôt pour ce motif précis.
//
// Principe : scanner TOUT le dépôt (hors node_modules/dist/tests/ lui-
// même) à la recherche d'un nom de fichier `*.test.js`/`*.test.jsx`. Le
// seul emplacement légitime pour ce motif est `tests/` — n'importe où
// ailleurs (typiquement `src/`, à cause d'un chemin de livraison mal
// recopié) est une régression de ce type précis.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.resolve(__dirname);

// Dossiers à ne jamais descendre : dépendances/build (jamais notre code),
// VCS. `tests/` lui-même est walké séparément plus bas (c'est l'emplacement
// ATTENDU, rien à y signaler).
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

const TEST_FILE_PATTERN = /\.test\.jsx?$/;

function walkForTestFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files = files.concat(walkForTestFiles(path.join(dir, entry.name)));
    } else if (TEST_FILE_PATTERN.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

describe('Garde-fou anti-régression : aucun fichier *.test.js(x) ne doit exister hors de tests/ (incident EditRoutineModal.test.jsx, 05/08)', () => {
  const allTestFiles = walkForTestFiles(REPO_ROOT);

  // Sanity check : si ce nombre est anormalement bas, le scan lui-même est
  // cassé (mauvais REPO_ROOT après un futur déplacement de ce fichier) et
  // ne prouve rien — même principe que les sanity checks des autres
  // garde-fous de ce dossier.
  it('a bien trouvé des fichiers de test à scanner', () => {
    expect(allTestFiles.length).toBeGreaterThan(20);
  });

  it('ne trouve aucun fichier *.test.js(x) en dehors de tests/', () => {
    const offenders = allTestFiles.filter(f => !f.startsWith(TESTS_DIR + path.sep));

    if (offenders.length > 0) {
      throw new Error(
        'Fichier(s) de test trouvé(s) HORS de tests/ — invisible du build ' +
          'Vercel réel (vite.config.js, test.include ne scanne que ' +
          "tests/**), donc jamais exécuté (voir l'incident du 05/08, " +
          'EditRoutineModal.test.jsx) :\n' +
          offenders.map(o => {
            const rel = path.relative(REPO_ROOT, o);
            // Emplacement miroir suggéré, sur le même principe que
            // testFileIdentityTrap.test.js : src/xxx/Yyy.test.jsx ->
            // tests/xxx/Yyy.test.jsx.
            const suggested = rel.startsWith('src' + path.sep)
              ? path.join('tests', rel.slice(('src' + path.sep).length))
              : null;
            return `  - ${rel}` + (suggested ? ` → devrait être ${suggested}` : '');
          }).join('\n') +
          '\n\nDéplacer ce(s) fichier(s) vers son emplacement miroir sous ' +
          "tests/ (créer les dossiers manquants) — vérifier aussi que son " +
          "import relatif vers src/ reste correct depuis le nouvel " +
          'emplacement (le nombre de `../` change).'
      );
    }
    expect(offenders).toEqual([]);
  });
});
