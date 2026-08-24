// Premier fichier de test pour bottomBarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. Ce fichier n'exporte que des
// constantes numériques pures (pas de logique à proprement parler), mais sa
// RAISON D'ÊTRE documentée est un vrai risque de désynchronisation : ce
// nombre DOIT rester égal à la classe Tailwind `h-[70px]` écrite en dur dans
// BottomBarShell.jsx (impossible de la générer par interpolation, piège JIT
// déjà documenté dans ce projet). Un test qui vérifie seulement "la
// constante vaut 70" ne protège de rien — celui-ci lit le VRAI contenu du
// fichier concerné pour confirmer que rien n'a divergé.
//
// ⚠️ RÉÉCRIT (22/08, même jour que la création du fichier testé, suite
// directe du chantier qui a produit BottomBarShell.jsx — voir sa
// docstring/le README pour le raisonnement complet) : ce fichier vérifiait
// avant DEUX constantes séparées (`MINI_PLAYER_BAR_HEIGHT_PX`/
// `GUEST_MODE_BAR_HEIGHT_PX`), chacune synchronisée avec sa PROPRE classe
// dans MiniPlayerBar.jsx/GuestModeBar.jsx — ces 2 classes ont fusionné en
// UNE SEULE (BottomBarShell.jsx, partagé par les 2 barres), donc le risque
// à vérifier aussi.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOTTOM_BAR_HEIGHT_PX } from '../../src/layout/bottomBarLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf-8');
}

describe('bottomBarLayout — valeur actuelle', () => {
  it('exporte un nombre (pas une chaîne, pas une classe Tailwind)', () => {
    expect(typeof BOTTOM_BAR_HEIGHT_PX).toBe('number');
  });
});

describe('bottomBarLayout — synchronisation avec la classe Tailwind écrite en dur (le vrai risque documenté)', () => {
  it('BOTTOM_BAR_HEIGHT_PX correspond bien à la classe h-[...px] réellement présente dans BottomBarShell.jsx', () => {
    const content = readSrc('components/shared/BottomBarShell.jsx');
    expect(content).toContain(`h-[${BOTTOM_BAR_HEIGHT_PX}px]`);
  });

  it('MiniPlayerBar.jsx/GuestModeBar.jsx n\'ont PLUS leur propre <div className={`h-[...px]`... — utilisent BottomBarShell', () => {
    // ⚠️ Test qui aurait détecté la régression du 22/08 (72px oublié dans
    // GuestModeBar.jsx pendant que MiniPlayerBar.jsx passait à 70px) —
    // vérifie maintenant l'INVERSE : qu'aucun `<div>` ne s'ouvre plus avec
    // une classe `h-[...px]` en tête dans ces 2 fichiers (signe qu'une
    // régression future aurait réintroduit la duplication que ce refactor
    // a éliminée). Motif précis (pas juste `h-[\d+px]` n'importe où dans le
    // fichier) : les commentaires explicatifs de ces 2 fichiers mentionnent
    // légitimement d'anciennes valeurs historiques (90px, 72px, 64px) en
    // texte libre, qui ne doivent pas faire échouer ce test.
    const mini = readSrc('components/shared/MiniPlayerBar.jsx');
    const guest = readSrc('components/shared/GuestModeBar.jsx');
    expect(mini).not.toMatch(/className=\{?`?h-\[\d+px\]/);
    expect(guest).not.toMatch(/className=\{?`?h-\[\d+px\]/);
  });
});
