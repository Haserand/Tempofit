import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 29/07, suite à 2 occurrences réelles du
// même bug : PendingUnsaveModal.jsx, puis ShareModal.jsx) — Tailwind (JIT
// puis moteur Oxide en v4) ne génère du CSS que pour les classes qui
// apparaissent en TOUTES LETTRES, en une seule chaîne, quelque part dans
// les fichiers qu'il scanne. Dès qu'un préfixe de variante ("hover:",
// "focus:", "dark:", "md:"...) est concaténé dynamiquement à une variable
// JS (`"hover:" + x` ou même `${x}` juste après un ":"), la classe
// complète n'existe nulle part littéralement dans le code source — le
// style ne s'applique alors QUE si, par pure coïncidence, le même texte
// existe déjà ailleurs dans le projet (ce qui a été le cas les 2 fois,
// d'où le bug resté invisible en local ET en prod jusqu'à un audit manuel).
// Ce test remplace l'audit manuel par une vérification systématique.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');

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

// Liste volontairement restreinte aux VRAIES variantes Tailwind utilisées
// (ou susceptibles de l'être) dans ce projet — pas un `[\w-]+:` générique,
// pour ne pas confondre avec un texte qui ressemble à un préfixe mais n'en
// est pas un (ex: `"song:" + title` dans searchEngine.js/spotifyEngine.js,
// qui construit une requête pour l'API GetSongBPM, rien à voir avec Tailwind).
const KNOWN_VARIANTS =
  '(?:hover|focus|focus-within|focus-visible|active|disabled|dark|group-hover|group-focus|peer-hover|peer-focus|peer-checked|checked|first|last|odd|even|placeholder|before|after|sm|md|lg|xl|2xl)';

// Cas n°1 (le plus fréquent) : une chaîne littérale ('/"/`) qui SE TERMINE
// par un ou plusieurs préfixes de variante connus (ex: "hover:",
// "dark:hover:") sans aucun nom de classe après le dernier ':',
// immédiatement suivie d'une concaténation `+`. Le préfixe peut être seul
// dans la chaîne OU précédé d'autres classes déjà écrites en toutes
// lettres (ex: "px-6 py-3 font-medium hover:" + x, trouvé dans
// CustomActivityModal.jsx — la 1re version de ce garde-fou, qui exigeait
// que TOUTE la chaîne ne soit QUE le préfixe, ratait ce cas).
//   "hover:" + textHighlight                     ← détecté
//   " hover:" + textMuted + " hover:" + x         ← détecté (2 fois)
//   "px-6 py-3 font-medium hover:" + textHighlight ← détecté
//   "disabled:opacity-60 " + inputBorder          ← PAS détecté (classe
//                                                    complète déjà écrite
//                                                    en toutes lettres)
const DANGEROUS_CONCAT = new RegExp(`(?<=[\\s'"\`]|^)((?:${KNOWN_VARIANTS}:)+)['"\`]\\s*\\+`, 'g');

// Cas n°2 (plus rare, pas encore rencontré ici mais même famille) : un
// préfixe de variante suivi directement d'une interpolation de template
// literal, ex. `hover:${accentClass}` — la classe entière est dynamique.
const DANGEROUS_TEMPLATE_INTERP = new RegExp(`\\b${KNOWN_VARIANTS}:\\$\\{`, 'g');

// Retire les commentaires JS (// ligne et /* bloc */) avant analyse, pour
// ne pas flaguer du texte de DOCUMENTATION qui mentionne le piège en
// exemple (ex: un commentaire expliquant qu'un bug a été corrigé, comme
// dans PendingUnsaveModal.jsx, qui cite littéralement `"hover:" + x`).
// Approche volontairement simple (pas un vrai tokenizer JS) : suffisante
// ici car le code du projet n'a pas de cas piégeux (pas de "//" ou "/*"
// à l'intérieur d'une chaîne de classes Tailwind).
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

describe('Garde-fou anti-piège Tailwind JIT (préfixe de variante concaténé dynamiquement)', () => {
  const files = walk(SRC_DIR);
  // Sanity check : si cette liste est vide, le test ne prouve rien.
  it('a bien trouvé des fichiers source à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('ne contient aucun préfixe de variante Tailwind concaténé via "+" à une variable', () => {
    const offenders = [];
    for (const file of files) {
      const content = stripComments(fs.readFileSync(file, 'utf-8'));
      content.split('\n').forEach((line, i) => {
        DANGEROUS_CONCAT.lastIndex = 0;
        let m;
        while ((m = DANGEROUS_CONCAT.exec(line))) {
          offenders.push(
            `${path.relative(SRC_DIR, file)}:${i + 1} → "${m[1]}" concaténé dynamiquement (contexte: ${line.trim().slice(0, 100)})`
          );
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        'Piège Tailwind JIT détecté (voir passation 29/07 — PendingUnsaveModal.jsx / ShareModal.jsx) :\n' +
          offenders.join('\n') +
          '\n\nCes classes ne fonctionnent que par coïncidence si le token littéral complet existe déjà ailleurs dans le projet. ' +
          'Écrire la classe en toutes lettres (ex: "hover:text-main" plutôt que "hover:" + variable).'
      );
    }
    expect(offenders).toEqual([]);
  });

  it('ne contient aucun préfixe de variante Tailwind directement suivi d\'une interpolation ${...}', () => {
    const offenders = [];
    for (const file of files) {
      const content = stripComments(fs.readFileSync(file, 'utf-8'));
      content.split('\n').forEach((line, i) => {
        DANGEROUS_TEMPLATE_INTERP.lastIndex = 0;
        let m;
        while ((m = DANGEROUS_TEMPLATE_INTERP.exec(line))) {
          offenders.push(
            `${path.relative(SRC_DIR, file)}:${i + 1} → variante suivie de "\${...}" (contexte: ${line.trim().slice(0, 100)})`
          );
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        'Piège Tailwind JIT (variante + interpolation directe) détecté :\n' +
          offenders.join('\n') +
          '\n\nLa classe complète (variante + utilitaire) doit apparaître en toutes lettres quelque part dans le code source.'
      );
    }
    expect(offenders).toEqual([]);
  });
});
