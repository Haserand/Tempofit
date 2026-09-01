import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 02/08, suite à une relecture qui a trouvé
// 10 fichiers de test dont le NOM SUR LE DISQUE avait la mauvaise casse —
// ex: `Importsharedplaylistmodal.test.jsx` au lieu de
// `ImportSharedPlaylistModal.test.jsx` — alors que le CONTENU du fichier,
// lui, importait bien le bon composant. Conséquence réelle : totalement
// silencieux pour Vitest (qui scanne par motif `*.test.jsx`, indifférent à
// la casse du nom), aucune erreur de build — juste une incohérence qui
// aurait pu, un jour, cacher un VRAI problème (le même type d'incident que
// `noDuplicateFiles.test.js` guette déjà, mais côté nommage plutôt que côté
// contenu dupliqué : voir la passation du 01/08, §7 point 3 — un mélange de
// contenu entre `PlaylistCharts.test.jsx` et `PlaylistDetailView.test.jsx`
// s'était déjà produit une fois pendant une réorganisation manuelle des
// fichiers de test via l'interface GitHub).
//
// Principe : pour chaque fichier `tests/**/Sujet.test.jsx` (hors la liste
// blanche ci-dessous), au moins UN import relatif vers `src/` doit
// correspondre à `Sujet` — soit par le nom de fichier importé (cas le plus
// courant : `import Sujet from "chemin/vers/Sujet.jsx"`), soit par un import
// nommé exact (`import { sujet } from "chemin/vers/fichierPartagé.js"`, pour un test qui
// cible une fonction précise au sein d'un plus gros fichier partagé — ex.
// `fetchInBatches.test.js` teste une fonction de `musicEngine.js`, pas un
// fichier `fetchInBatches.js` qui n'existe pas). La comparaison est
// SENSIBLE À LA CASSE — c'est justement ce qui aurait détecté l'incident
// d'origine, une comparaison insensible à la casse ne l'aurait pas repéré.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.resolve(__dirname, '.');

// Fichiers garde-fous globaux, sans UN sujet précis à tester — ils scannent
// tout le projet eux-mêmes plutôt que d'importer un composant donné. Si un
// futur garde-fou du même genre est ajouté (à la racine de tests/, comme
// les 3 ci-dessous), l'ajouter ici plutôt que de l'exempter en douce
// ailleurs.
const NO_SINGLE_SUBJECT = new Set([
  'fileExtensionTrap.test.js',
  'noDuplicateFiles.test.js',
  'tailwindConcatTrap.test.js',
  'testFileIdentityTrap.test.js', // ce fichier lui-même
  'testLocationTrap.test.js', // garde-fou global (05/08), même famille
  'criticalExportsTrap.test.js', // garde-fou global (05/08), même famille
  'flexDependentClassTrap.test.js', // garde-fou global (22/08), même famille
  'hoverWhiteTextTrap.test.js', // garde-fou global (01/09), même famille
]);

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.test\.jsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Capture chaque `import Truc from "chemin"` STATIQUE (suffisant ici — un
// `vi.mock()`/`import()` dynamique n'est pas le signal recherché : c'est
// bien l'import réel du sujet testé qui doit correspondre à son nom).
const IMPORT_LINE = /import\s+([^;]+?)\s+from\s+['"](\.\.[^'"]+)['"]/g;

function extractSrcImports(content) {
  const results = [];
  let m;
  IMPORT_LINE.lastIndex = 0;
  while ((m = IMPORT_LINE.exec(content)) !== null) {
    const [, clause, importPath] = m;
    if (importPath.includes('/src/')) results.push({ clause, importPath });
  }
  return results;
}

function matchesSubject(content, stem) {
  return extractSrcImports(content).some(({ clause, importPath }) => {
    const importStem = path.basename(importPath).replace(/\.(jsx?|tsx?)$/, '');
    if (importStem === stem) return true;
    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      const names = named[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
      if (names.includes(stem)) return true;
    }
    return false;
  });
}

describe('Garde-fou anti-régression : le nom de fichier de chaque test correspond bien (casse comprise) au sujet qu\'il importe réellement', () => {
  const files = walk(TESTS_DIR);

  // Sanity check : si cette liste est anormalement courte, le test ne
  // prouve rien (ex: mauvais chemin TESTS_DIR après un futur déplacement).
  it('a bien trouvé des fichiers de test à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('chaque fichier de test (hors garde-fous globaux) importe un sujet dont le nom correspond exactement, casse comprise, à son propre nom de fichier', () => {
    const offenders = [];
    for (const file of files) {
      const base = path.basename(file);
      if (NO_SINGLE_SUBJECT.has(base)) continue;
      const stem = base.replace(/\.test\.jsx?$/, '');
      const content = fs.readFileSync(file, 'utf-8');
      if (!matchesSubject(content, stem)) {
        offenders.push(path.relative(TESTS_DIR, file));
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        'Fichier(s) de test dont le nom ne correspond à AUCUN import du sujet ' +
          'attendu (voir l\'incident du 02/08 — 10 fichiers renommés avec la ' +
          'mauvaise casse, contenu correct mais nom trompeur) :\n' +
          offenders.map(o => `  - ${o}`).join('\n') +
          '\n\nVérifier : (1) le nom du fichier a-t-il la bonne casse ' +
          '(ex: `TrackItem.test.jsx`, pas `Trackitem.test.jsx`) ? ' +
          '(2) le contenu importe-t-il vraiment le bon composant, ou a-t-il ' +
          'été écrasé par le contenu d\'un autre fichier lors d\'une ' +
          'manipulation manuelle ? Si ce fichier teste légitimement plusieurs ' +
          'sujets sans nom de fichier dédié, l\'ajouter à NO_SINGLE_SUBJECT ' +
          'en tête de ce fichier.'
      );
    }
    expect(offenders).toEqual([]);
  });
});
