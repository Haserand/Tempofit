// Premier fichier de test pour bottomBarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. Ce fichier n'exporte que des
// constantes numériques pures (pas de logique à proprement parler), mais sa
// RAISON D'ÊTRE documentée est un vrai risque de désynchronisation : ces
// nombres DOIVENT rester égaux aux classes Tailwind `h-[90px]`/`h-[72px]`
// écrites en dur dans MiniPlayerBar.jsx/GuestModeBar.jsx (impossible de les
// générer par interpolation, piège JIT déjà documenté dans ce projet). Un
// test qui vérifie seulement "la constante vaut 90" ne protège de rien —
// celui-ci lit le VRAI contenu des fichiers concernés pour confirmer que
// rien n'a divergé.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MINI_PLAYER_BAR_HEIGHT_PX, GUEST_MODE_BAR_HEIGHT_PX } from '../../src/layout/bottomBarLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf-8');
}

describe('bottomBarLayout — valeurs actuelles', () => {
  it('exporte deux nombres (pas des chaînes, pas des classes Tailwind)', () => {
    expect(typeof MINI_PLAYER_BAR_HEIGHT_PX).toBe('number');
    expect(typeof GUEST_MODE_BAR_HEIGHT_PX).toBe('number');
  });
});

describe('bottomBarLayout — synchronisation avec les classes Tailwind écrites en dur (le vrai risque documenté)', () => {
  it('MINI_PLAYER_BAR_HEIGHT_PX correspond bien à la classe h-[...px] réellement présente dans MiniPlayerBar.jsx', () => {
    const content = readSrc('components/shared/MiniPlayerBar.jsx');
    expect(content).toContain(`h-[${MINI_PLAYER_BAR_HEIGHT_PX}px]`);
  });

  it('GUEST_MODE_BAR_HEIGHT_PX correspond bien à la classe h-[...px] réellement présente dans GuestModeBar.jsx', () => {
    const content = readSrc('components/shared/GuestModeBar.jsx');
    expect(content).toContain(`h-[${GUEST_MODE_BAR_HEIGHT_PX}px]`);
  });

  // ⚠️ Test "Sidebar.jsx importe bien les 2 constantes..." RETIRÉ (22/08,
  // retour direct — "l'accessibilité de la navigation du menu doit être
  // privilégiée") : Sidebar.jsx forçait avant la hauteur de son pied de
  // page (Réglages + crédit) à correspondre à ces constantes
  // (`creditRowHeight`), pour un alignement de bordure purement cosmétique
  // avec MiniPlayerBar/GuestModeBar — au prix de rogner l'espace
  // disponible pour la nav scrollable juste au-dessus (même conteneur
  // `flex flex-col h-full`). Ce mécanisme est retiré, Sidebar.jsx n'importe
  // donc plus ces constantes du tout — cette assertion n'a plus de risque
  // à garder, ni de sens à vérifier. Les 2 tests ci-dessus (synchronisation
  // MiniPlayerBar/GuestModeBar avec leurs propres classes Tailwind
  // `h-[...px]`) restent, eux, pleinement valides : le risque de
  // désynchronisation qu'ils protègent existe toujours, indépendamment de
  // Sidebar.jsx.
});
