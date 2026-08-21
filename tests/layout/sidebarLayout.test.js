// Premier fichier de test pour sidebarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. 11 constantes issues d'un
// réglage fin en plusieurs passes (voir la docstring du fichier — 9 à
// l'origine, +1 le 21/08 pour "Découvrir", +1 le même jour pour
// l'asymétrie Création/Mon Espace en Mode Intime) — ce test fige les
// valeurs ACTUELLES pour qu'un futur ajustement accidentel (plutôt que
// délibéré) se voie immédiatement, et vérifie qu'elles restent bien
// importées par Sidebar.jsx plutôt que recopiées en dur.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIDEBAR_LINK_PADDING,
  SIDEBAR_LINK_GAP,
  SIDEBAR_SECTION_TITLE_MARGIN,
  SIDEBAR_LINK_PADDING_COMPACT,
  SIDEBAR_LINK_GAP_COMPACT,
  SIDEBAR_SECTION_TITLE_MARGIN_COMPACT,
  SIDEBAR_SEPARATOR_MARGIN,
  SIDEBAR_DISCOVER_SEPARATOR_MARGIN,
  SIDEBAR_SCROLL_PADDING,
  SIDEBAR_SCROLL_PADDING_COMPACT,
  SIDEBAR_FOOTER_LINK_PADDING,
  SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM,
} from '../../src/layout/sidebarLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIDEBAR_JSX = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/shared/Sidebar.jsx'),
  'utf-8',
);

describe('sidebarLayout — valeurs stabilisées actuelles (état final après 9 passes de réglage, voir la docstring)', () => {
  it('variantes normales', () => {
    expect(SIDEBAR_LINK_PADDING).toBe('px-3 py-2.5');
    expect(SIDEBAR_LINK_GAP).toBe('space-y-2');
    expect(SIDEBAR_SECTION_TITLE_MARGIN).toBe('mb-4');
  });

  it('variantes COMPACTES (Mode Intime uniquement)', () => {
    expect(SIDEBAR_LINK_PADDING_COMPACT).toBe('px-3 py-2');
    expect(SIDEBAR_LINK_GAP_COMPACT).toBe('space-y-1.5');
    expect(SIDEBAR_SECTION_TITLE_MARGIN_COMPACT).toBe('mb-2.5');
  });

  it('les variantes compactes restent bien MOINS espacées que les variantes normales (pas juste différentes)', () => {
    // Comparaison structurelle plutôt qu'une simple différence de chaînes —
    // vérifie que le sens du resserrement (compact < normal) reste
    // respecté, ce que 2 simples égalités de chaînes ne garantiraient pas.
    const pyNormal = parseFloat(SIDEBAR_LINK_PADDING.match(/py-([\d.]+)/)[1]);
    const pyCompact = parseFloat(SIDEBAR_LINK_PADDING_COMPACT.match(/py-([\d.]+)/)[1]);
    expect(pyCompact).toBeLessThan(pyNormal);
  });

  it('séparateur Création/Mon Espace et paddings de conteneur', () => {
    expect(SIDEBAR_SEPARATOR_MARGIN).toBe('my-5');
    // `pt-4` inchangé, `pb-1.5` (21/08, retour direct : "réduire l'espace
    // Découvrir de 10px en haut et en bas") — 16px → 6px, la moitié "bas"
    // des -10px demandés (l'autre moitié vit dans
    // SIDEBAR_DISCOVER_SEPARATOR_MARGIN, testée séparément ci-dessous).
    expect(SIDEBAR_SCROLL_PADDING).toBe('pt-4 pb-1.5 px-4');
    expect(SIDEBAR_SCROLL_PADDING_COMPACT).toBe('py-3 px-4');
    expect(SIDEBAR_FOOTER_LINK_PADDING).toBe('px-3 py-1.5');
  });

  it('séparateur avant "Découvrir" — DISTINCT du séparateur Création/Mon Espace, resserré de 10px en bas', () => {
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN).toBe('mt-5 mb-2.5');
    // `mt-5` = même écart que SIDEBAR_SEPARATOR_MARGIN (haut inchangé,
    // jamais mentionné dans la demande) ; `mb-2.5` (10px) contre `mb-5`
    // (20px) qu'aurait donné la constante partagée — la moitié "haut" des
    // -10px demandés autour de "Découvrir".
    const mbDiscover = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN.match(/mb-([\d.]+)/)[1]);
    const mbShared = parseFloat(SIDEBAR_SEPARATOR_MARGIN.match(/my-([\d.]+)/)[1]);
    expect(mbDiscover).toBeLessThan(mbShared);
  });

  it('marge après le bouton "Quitter le Mode Intime" — DOIT rester égale à la moitié basse de SIDEBAR_SEPARATOR_MARGIN (retour direct : "même espace entre Création et sa barre qu\'entre Mes Favoris et sa barre")', () => {
    expect(SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM).toBe('mb-5');
    // Comparaison structurelle plutôt qu'une simple égalité de chaînes —
    // c'est le POINT de cette constante (les 2 écarts doivent matcher),
    // pas un hasard de valeur : si SIDEBAR_SEPARATOR_MARGIN change un jour
    // sans que celle-ci suive, ce test doit le signaler.
    const mbNaughtyExit = parseFloat(SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM.match(/mb-([\d.]+)/)[1]);
    const mbSeparator = parseFloat(SIDEBAR_SEPARATOR_MARGIN.match(/my-([\d.]+)/)[1]);
    expect(mbNaughtyExit).toBe(mbSeparator);
  });
});

describe('sidebarLayout — importé par Sidebar.jsx (pas recopié en dur)', () => {
  it('les 11 constantes sont bien importées depuis ce module', () => {
    expect(SIDEBAR_JSX).toMatch(/from ['"].*sidebarLayout['"]/);
    for (const name of [
      'SIDEBAR_LINK_PADDING', 'SIDEBAR_LINK_GAP', 'SIDEBAR_SECTION_TITLE_MARGIN',
      'SIDEBAR_LINK_PADDING_COMPACT', 'SIDEBAR_LINK_GAP_COMPACT', 'SIDEBAR_SECTION_TITLE_MARGIN_COMPACT',
      'SIDEBAR_SEPARATOR_MARGIN', 'SIDEBAR_DISCOVER_SEPARATOR_MARGIN', 'SIDEBAR_SCROLL_PADDING', 'SIDEBAR_SCROLL_PADDING_COMPACT',
      'SIDEBAR_FOOTER_LINK_PADDING', 'SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM',
    ]) {
      expect(SIDEBAR_JSX).toContain(name);
    }
  });
});
