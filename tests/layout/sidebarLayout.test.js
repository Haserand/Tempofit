// Premier fichier de test pour sidebarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. 13 constantes issues d'un
// réglage fin en plusieurs passes (voir la docstring du fichier — 9 à
// l'origine, +1 le 21/08 pour "Découvrir", +1 le même jour pour
// l'asymétrie Création/Mon Espace en Mode Intime, +2 encore le même jour
// pour resserrer spécifiquement le Mode Intime de 2px par écart) — ce test
// fige les valeurs ACTUELLES pour qu'un futur ajustement accidentel
// (plutôt que délibéré) se voie immédiatement, et vérifie qu'elles
// restent bien importées par Sidebar.jsx plutôt que recopiées en dur.

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
  SIDEBAR_SEPARATOR_MARGIN_COMPACT,
  SIDEBAR_DISCOVER_SEPARATOR_MARGIN,
  SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT,
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
    // `py-3` symétrique → `pt-[10px] pb-3` (21/08, 2e passe Mode Intime,
    // retour direct : "il manque encore quelques pixels, à peu près
    // autant que pour la précédente passe") — seul le HAUT a bougé (12→10,
    // -2px), le bas reste à 12px (`pb-3`), jamais concerné par cette
    // demande (qui ne visait que la visibilité de "Découvrir" en HAUT).
    expect(SIDEBAR_SCROLL_PADDING_COMPACT).toBe('pt-[10px] pb-3 px-4');
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

  it('marge après le bouton "Quitter le Mode Intime" — 16px après 2 passes de resserrement (retours directs : "supprime 2 pixels à chaque trait rouge...", puis "il manque encore quelques pixels, à peu près autant que pour la précédente passe")', () => {
    // Anciennes valeurs (mb-5/20px, puis mb-[18px]) volontairement PAS
    // testées ici : chaque retour direct désynchronise un peu plus cette
    // constante de SIDEBAR_SEPARATOR_MARGIN (restée à 20px tout du long,
    // jamais mentionnée dans aucune des 2 demandes) — l'égalité testée
    // avant le 1er correctif n'était vraie qu'à ce moment précis, pas un
    // invariant à préserver.
    expect(SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM).toBe('mb-[16px]');
  });

  it('variantes Mode Intime des 2 séparateurs — 2 passes de resserrement le 21/08, DISTINCTES des variantes normales, jusqu\'ici partagées sans distinction', () => {
    expect(SIDEBAR_SEPARATOR_MARGIN_COMPACT).toBe('mt-[16px] mb-5');
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT).toBe('mt-[16px] mb-2.5');
    // Seul le HAUT (mt) est resserré par rapport aux variantes normales —
    // le bas (mb) reste identique dans les 2 cas, jamais marqué en rouge.
    // Comparaison structurelle : le "mt" compact doit être STRICTEMENT
    // inférieur au "mt"/"my" normal correspondant.
    const mtSeparatorCompact = parseFloat(SIDEBAR_SEPARATOR_MARGIN_COMPACT.match(/mt-\[(\d+)px\]/)[1]);
    const mySeparatorNormal = parseFloat(SIDEBAR_SEPARATOR_MARGIN.match(/my-([\d.]+)/)[1]) * 4; // unités Tailwind → px
    expect(mtSeparatorCompact).toBeLessThan(mySeparatorNormal);

    const mtDiscoverCompact = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT.match(/mt-\[(\d+)px\]/)[1]);
    const mtDiscoverNormal = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN.match(/mt-([\d.]+)/)[1]) * 4;
    expect(mtDiscoverCompact).toBeLessThan(mtDiscoverNormal);

    // Le "mb" (bas), lui, doit rester IDENTIQUE entre normal et compact —
    // seul le haut devait bouger d'après les traits rouges.
    expect(SIDEBAR_SEPARATOR_MARGIN_COMPACT).toContain('mb-5');
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT).toContain('mb-2.5');
  });
});

describe('sidebarLayout — importé par Sidebar.jsx (pas recopié en dur)', () => {
  it('les 13 constantes sont bien importées depuis ce module', () => {
    expect(SIDEBAR_JSX).toMatch(/from ['"].*sidebarLayout['"]/);
    for (const name of [
      'SIDEBAR_LINK_PADDING', 'SIDEBAR_LINK_GAP', 'SIDEBAR_SECTION_TITLE_MARGIN',
      'SIDEBAR_LINK_PADDING_COMPACT', 'SIDEBAR_LINK_GAP_COMPACT', 'SIDEBAR_SECTION_TITLE_MARGIN_COMPACT',
      'SIDEBAR_SEPARATOR_MARGIN', 'SIDEBAR_SEPARATOR_MARGIN_COMPACT',
      'SIDEBAR_DISCOVER_SEPARATOR_MARGIN', 'SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT',
      'SIDEBAR_SCROLL_PADDING', 'SIDEBAR_SCROLL_PADDING_COMPACT',
      'SIDEBAR_FOOTER_LINK_PADDING', 'SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM',
    ]) {
      expect(SIDEBAR_JSX).toContain(name);
    }
  });
});
