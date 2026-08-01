import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 01/08, suite à un incident réel) —
// ShareModal.jsx était devenu, suite à une manipulation malheureuse,
// une copie OCTET POUR OCTET de SearchModal.jsx (même code, même nom de
// fonction exportée). Régression totalement silencieuse : aucune erreur de
// build/lint, `ShareModal.jsx` restait un fichier .jsx syntaxiquement
// valide — juste le mauvais contenu. Conséquence réelle en prod : le bouton
// "Partager" ne faisait plus rien nulle part dans l'app. Découverte
// uniquement en écrivant les tests de ShareModal.jsx (Palier 3/4), donc
// tardivement. Ce test remplace la chance (écrire un test sur CE fichier
// précis au bon moment) par une vérification systématique de TOUT `src/` à
// chaque run — le même piège sur n'importe quel autre fichier serait
// désormais détecté immédiatement, avant même un déploiement.
//
// Principe : hash SHA-256 du contenu de chaque fichier source ; 2 fichiers
// DIFFÉRENTS ne devraient jamais avoir le même hash dans ce projet (aucun
// fichier n'est un simple ré-export/proxy d'un autre — vérifié manuellement
// à l'écriture de ce test, voir la liste EXPECTED_ALLOWED_DUPLICATES
// ci-dessous si ça change un jour). Un même fichier qui s'auto-compare n'est
// bien sûr pas un doublon — seules les PAIRES de chemins distincts comptent.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');

// Sous ce seuil (octets), on ignore le fichier : un doublon accidentel de 2
// fichiers minuscules (ex: 2 constantes d'1 ligne qui valent la même chose
// par coïncidence) n'a rien à voir avec le vrai risque visé ici (un fichier
// ENTIER écrasé par le contenu d'un autre). Le plus petit fichier source
// réel du projet à ce jour dépasse largement ce seuil (~950 octets) — 200
// laisse une marge confortable sans perdre en capacité de détection.
const MIN_SIZE_BYTES = 200;

// Cas légitimes connus où 2 fichiers PEUVENT être strictement identiques
// (aucun à ce jour) — chemins relatifs à SRC_DIR, toujours en PAIRE triée.
// Si un jour un vrai cas légitime apparaît (peu probable dans ce projet),
// l'ajouter ici plutôt que de supprimer/affaiblir le test.
const EXPECTED_ALLOWED_DUPLICATES = new Set([]);

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

function hashFile(file) {
  const content = fs.readFileSync(file, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Garde-fou anti-régression : aucun fichier source ne doit être un doublon exact d\'un autre', () => {
  const files = walk(SRC_DIR).filter(f => fs.statSync(f).size >= MIN_SIZE_BYTES);

  // Sanity check : si cette liste est vide/anormalement courte, le test ne
  // prouve rien (ex: mauvais chemin SRC_DIR après un futur déplacement).
  it('a bien trouvé des fichiers source à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('ne contient aucune paire de fichiers strictement identiques (contenu octet pour octet)', () => {
    const byHash = new Map(); // hash -> [chemins]
    for (const file of files) {
      const hash = hashFile(file);
      const rel = path.relative(SRC_DIR, file);
      if (!byHash.has(hash)) byHash.set(hash, []);
      byHash.get(hash).push(rel);
    }

    const offenders = [];
    for (const paths of byHash.values()) {
      if (paths.length < 2) continue;
      const pairKey = [...paths].sort().join(' <-> ');
      if (EXPECTED_ALLOWED_DUPLICATES.has(pairKey)) continue;
      offenders.push(pairKey);
    }

    if (offenders.length > 0) {
      throw new Error(
        'Fichiers source identiques détectés (voir passation 01/08 — incident réel ' +
          'ShareModal.jsx devenu une copie de SearchModal.jsx, régression totalement ' +
          'silencieuse jusqu\'à la découverte manuelle) :\n' +
          offenders.map(o => `  - ${o}`).join('\n') +
          '\n\nSi cette duplication est VOLONTAIRE et légitime, ajouter la paire ' +
          '(triée, séparée par " <-> ") à EXPECTED_ALLOWED_DUPLICATES en tête de ce fichier. ' +
          'Sinon, l\'un des deux fichiers a très probablement écrasé le contenu de l\'autre par erreur.'
      );
    }
    expect(offenders).toEqual([]);
  });
});
