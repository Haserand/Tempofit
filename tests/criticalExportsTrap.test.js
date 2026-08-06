import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou anti-régression (créé 05/08, incident RÉEL) — retour direct :
// `tests/contexts/PlaylistDetailContext.test.jsx` échouait EN TOTALITÉ
// (25/25) sur `vitest run`, avec une seule erreur générique répétée
// partout : "Element type is invalid ... got: undefined". Long diagnostic
// (voir PASSATION pour le détail complet) avant de découvrir la vraie
// cause via une recherche GitHub : `src/contexts/PlaylistDetailContext.jsx`
// — le VRAI fichier du composant, `PlaylistDetailProvider`/
// `usePlaylistDetail` — avait été accidentellement écrasé par le CONTENU
// du fichier de test (collé au mauvais endroit, les deux fichiers portant
// presque le même nom). `PlaylistDetailProvider` valait donc `undefined`
// à l'import, d'où l'erreur React sur CHAQUE test qui tentait de le
// monter.
//
// Aucun garde-fou existant à ce moment-là ne pouvait détecter ce cas :
// `noDuplicateFiles.test.js`/`testLocationTrap.test.js`/
// `fileExtensionTrap.test.js` vérifient tous l'EMPLACEMENT ou le NOM d'un
// fichier, jamais si son CONTENU correspond vraiment à ce que son nom/son
// rôle promettent. Un fichier au bon endroit, avec le bon nom, mais dont
// le contenu a été substitué par erreur leur est structurellement
// invisible.
//
// 2 vérifications complémentaires ici, chacune attrapant une variante du
// même incident :
//
// 1. Aucun fichier de `src/` ne doit importer `vitest` (ni
//    `@testing-library/*`) — un composant/contexte réel n'a JAMAIS besoin
//    de ces imports ; leur présence est un signal quasi certain qu'un
//    fichier de TEST a été collé au mauvais endroit. C'est exactement ce
//    qui aurait attrapé l'incident du 05/08 instantanément (le fichier de
//    test importe `vitest` dès sa 1re ligne de code).
//
// 2. Les 3 vrais Context Providers de l'app (GeneratorContext/
//    AudioPlayerContext/PlaylistDetailContext — le cœur architectural du
//    projet, dont une casse est difficile à diagnostiquer précisément
//    parce que l'erreur React qui en résulte est générique et ne pointe
//    jamais vers LA vraie cause) sont importés pour de vrai et on vérifie
//    que leurs exports attendus sont bien des fonctions, pas `undefined`
//    — un filet différent du n°1 : couvre aussi le cas où le contenu
//    substitué ne serait PAS un fichier de test (donc sans import
//    `vitest`), mais un contenu tout aussi invalide pour ce rôle précis.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(__dirname, '../src');

function walkSrcFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkSrcFiles(full));
    } else if (/\.jsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('Garde-fou anti-régression : un fichier src/ ne doit jamais contenir un import de test (incident PlaylistDetailContext.jsx, 05/08)', () => {
  const files = walkSrcFiles(SRC_DIR);

  it('a bien trouvé des fichiers à scanner', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("n'importe jamais 'vitest' ni '@testing-library/*' depuis src/", () => {
    const offenders = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/from ['"](vitest|@testing-library\/)/.test(content)) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        "Fichier(s) sous src/ qui importe(nt) 'vitest'/'@testing-library' — " +
          "signal quasi certain qu'un fichier de TEST a été collé au mauvais " +
          "endroit (voir l'incident du 05/08, PlaylistDetailContext.jsx : le " +
          'contenu du composant réel avait été écrasé par celui de son test) ' +
          ':\n' +
          offenders.map(o => `  - ${o}`).join('\n') +
          '\n\nVérifier le contenu de ce(s) fichier(s) et restaurer le vrai ' +
          'composant/contexte si besoin.'
      );
    }
    expect(offenders).toEqual([]);
  });
});

// Les 3 Providers réels — importés pour de vrai (pas juste scannés en
// texte) : la 2e ligne de défense, voir la docstring en tête de fichier.
describe('Garde-fou anti-régression : les 3 Context Providers exportent bien ce qu\'ils promettent (incident PlaylistDetailContext.jsx, 05/08)', () => {
  it('GeneratorContext.jsx exporte GeneratorProvider et useGeneratorContext (fonctions)', async () => {
    const m = await import('../src/contexts/GeneratorContext.jsx');
    expect(typeof m.GeneratorProvider).toBe('function');
    expect(typeof m.useGeneratorContext).toBe('function');
  });

  it('AudioPlayerContext.jsx exporte AudioPlayerProvider et useAudioPlayer (fonctions)', async () => {
    const m = await import('../src/contexts/AudioPlayerContext.jsx');
    expect(typeof m.AudioPlayerProvider).toBe('function');
    expect(typeof m.useAudioPlayer).toBe('function');
  });

  it('PlaylistDetailContext.jsx exporte PlaylistDetailProvider et usePlaylistDetail (fonctions) — le fichier concerné par l\'incident du 05/08', async () => {
    const m = await import('../src/contexts/PlaylistDetailContext.jsx');
    expect(typeof m.PlaylistDetailProvider).toBe('function');
    expect(typeof m.usePlaylistDetail).toBe('function');
  });
});
