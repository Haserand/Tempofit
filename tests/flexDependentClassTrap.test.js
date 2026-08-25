import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 22/08, suite à un bug réel dans
// BottomBarShell.jsx — voir README, section dédiée, et
// GuestModeBar.jsx/MiniPlayerBar.jsx pour le détail complet) : plusieurs
// classes Tailwind (`flex-col`, `flex-row`, `items-*`, `justify-*`...) ne
// produisent RIEN sans leur classe PRÉREQUISE (`flex` ou `grid`) posée sur
// le MÊME élément. `BottomBarShell.jsx` acceptait un `innerClassName`
// transmis par chaque appelant (`GuestModeBar.jsx`/`MiniPlayerBar.jsx`) —
// un appelant a un jour transmis `flex-col items-center justify-center`
// SANS jamais inclure `flex` (ni dans sa propre chaîne, ni dans le
// template de base du composant partagé) : ces 3 classes n'avaient
// littéralement AUCUN effet, invisible à la simple lecture du JSX (rien
// n'y est "faux" en apparence — juste incomplet). Trouvé uniquement par
// une vraie mesure de rendu (Playwright), après 2 tentatives de correctif
// basées sur un raisonnement théorique erroné.
//
// `BottomBarShell.jsx` lui-même est désormais corrigé à la racine (`flex`
// posé dans SON PROPRE template de base, plus besoin qu'un appelant y
// pense) — ce garde-fou ne couvre donc PAS son prop `innerClassName`
// (voir plus bas pourquoi). `ModalShell.jsx` partage en revanche la MÊME
// conception à risque (`cardClassName`, entièrement libre, `flex`
// optionnel plutôt qu'imposé) sans avoir aujourd'hui le même bug,
// uniquement parce que chaque appelant ACTUEL qui utilise `flex-col`
// pense aussi à inclure `flex` dans la même chaîne. Ce garde-fou
// remplace cette vigilance manuelle par une vérification systématique,
// pour CE composant et tout futur composant partagé qui adopterait la
// même conception (prop de classes personnalisées transmise telle
// quelle, sans garantie de `flex`/`grid` à la source).

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

// Classes qui n'ont d'effet QUE sur un conteneur flex ou grid — jamais
// seules. Liste volontairement limitée à celles réellement utilisées (ou
// susceptibles de l'être) sur ce projet, même esprit que
// tailwindConcatTrap.test.js (éviter les faux positifs génériques).
const FLEX_DEPENDENT = [
  'flex-col', 'flex-col-reverse', 'flex-row', 'flex-row-reverse', 'flex-wrap', 'flex-nowrap',
  'items-center', 'items-start', 'items-end', 'items-baseline', 'items-stretch',
  'justify-center', 'justify-between', 'justify-start', 'justify-end', 'justify-around', 'justify-evenly',
  'content-center', 'content-between', 'content-around', 'content-evenly',
];

// Props de personnalisation connues qui transmettent une chaîne de classes
// TELLE QUELLE à un composant partagé, sans garantie que celui-ci pose lui
// -même `flex`/`grid` de base (contrairement à un simple `className=` sur
// un élément natif, où le développeur voit et contrôle TOUT le reste de la
// chaîne au même endroit — le risque spécifique ici est la classe
// prérequise qui vit dans un AUTRE fichier, invisible au moment d'écrire
// l'appel).
//
// ⚠️ `innerClassName` (BottomBarShell.jsx) volontairement ABSENT de cette
// liste, malgré son nom très proche de `cardClassName` — CE PROP-LÀ est
// désormais protégé À LA SOURCE : `BottomBarShell.jsx` pose `flex` dans
// SON PROPRE template de base, inconditionnellement, depuis le correctif
// du bug qui a motivé ce garde-fou (voir sa docstring). Un appelant peut
// donc transmettre `flex-col`/`items-center` sans jamais risquer ce bug
// précis — l'inclure ici produirait un FAUX POSITIF permanent sur
// `GuestModeBar.jsx`/`MiniPlayerBar.jsx`. `cardClassName` (ModalShell.jsx),
// lui, reste un vrai risque : ce composant-là ne pose PAS `flex` de base
// (certains appelants veulent une simple carte bloc, sans flex du tout),
// donc rien n'empêche structurellement un futur appelant d'oublier `flex`
// en utilisant `flex-col` — d'où ce garde-fou, précisément pour LUI.
const CUSTOM_CLASS_PROPS = ['cardClassName'];

function extractPropStrings(content, propName) {
  // Capture `propName="..."` ou `propName={"..."}` ou `propName={`...`}` —
  // se limite aux valeurs LITTÉRALES (pas une variable/expression), seul
  // cas où on peut vérifier le contenu statiquement.
  const re = new RegExp(`${propName}=(?:"([^"]*)"|\\{\`([^\`]*)\`\\}|\\{"([^"]*)"\\})`, 'g');
  const results = [];
  let m;
  while ((m = re.exec(content))) {
    results.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return results;
}

describe('Garde-fou anti-piège Tailwind — classe dépendante (flex-col/items-*/justify-*) sans sa classe prérequise (flex/grid)', () => {
  const files = walk(SRC_DIR);

  it('a bien trouvé des fichiers source à scanner', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('toute prop de classes personnalisées (innerClassName/cardClassName) qui contient une classe flex-dépendante contient aussi "flex" ou "grid"', () => {
    const offenders = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const propName of CUSTOM_CLASS_PROPS) {
        for (const classString of extractPropStrings(content, propName)) {
          const tokens = classString.split(/\s+/).filter(Boolean);
          const hasDependent = tokens.some(t => FLEX_DEPENDENT.includes(t));
          const hasPrerequisite = tokens.includes('flex') || tokens.includes('grid') || tokens.includes('inline-flex') || tokens.includes('inline-grid');
          if (hasDependent && !hasPrerequisite) {
            offenders.push(
              `${path.relative(SRC_DIR, file)} → ${propName}="${classString}" contient une classe flex-dépendante sans "flex"/"grid"`
            );
          }
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        'Classe Tailwind flex-dépendante sans son prérequis détectée (voir BottomBarShell.jsx/README — bug réel du 22/08) :\n' +
          offenders.join('\n') +
          '\n\n"flex-col"/"items-*"/"justify-*" n\'ont AUCUN effet sans "flex" (ou "grid") sur le même élément. ' +
          'Soit ajouter "flex" à cette chaîne, soit vérifier que le composant qui reçoit cette prop pose déjà "flex" dans son propre template de base.'
      );
    }
    expect(offenders).toEqual([]);
  });
});
