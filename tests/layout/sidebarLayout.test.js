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
    // `pb-3` → `pb-[10px]` (21/08, 3e passe Mode Intime, retour direct :
    // "il manque encore quelques pixels", sans traits précis cette fois) —
    // seul levier restant qui ne rouvre pas SIDEBAR_LINK_PADDING_COMPACT/
    // SIDEBAR_LINK_GAP_COMPACT/SIDEBAR_SECTION_TITLE_MARGIN_COMPACT, déjà
    // resserrées puis explicitement desserrées le 29/07 ("trop agressif,
    // tasse trop la navigation") — volontairement laissées de côté.
    // `pt-[10px]` → `pt-[7px]` (21/08, 4e passe, retour direct : "en gros
    // manque une quinzaine de pixels", -3px avec trait précis cette fois)
    // — le bas (`pb-[10px]`) n'était pas marqué cette fois, resté inchangé.
    expect(SIDEBAR_SCROLL_PADDING_COMPACT).toBe('pt-[7px] pb-[10px] px-4');
    expect(SIDEBAR_FOOTER_LINK_PADDING).toBe('px-3 py-1.5');
  });

  it('séparateur avant "Découvrir" — DISTINCT du séparateur Création/Mon Espace, resserré de 10px en bas puis ancré au bloc du bas (01/09)', () => {
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN).toBe('mt-4 mb-[23px]');
    // `mt-4` : SANS effet réel sur la position absolue de la ligne depuis
    // l'ajout de l'espaceur flexible juste avant (01/09, voir Sidebar.jsx,
    // `<div className="flex-1">` avant ce séparateur, dans un `<nav
    // className="flex flex-col h-full">`) — la ligne est désormais ANCRÉE
    // au bas de la nav (donc au pied de page juste en dessous), pas
    // positionnée depuis le haut. Gardé néanmoins pour le cas où le
    // contenu de la nav dépasse la hauteur disponible (Mode Intime, petit
    // écran) : l'espaceur vaut alors 0px, `overflow-y-auto` prend le
    // relais, et la ligne redevient positionnée depuis le haut comme
    // avant — ce `mt` redevient pertinent dans CE cas précis.
    // `mb-[23px]` (23px, contre `mb-2.5`/10px avant) : LE vrai levier
    // maintenant que la ligne est ancrée au bas — ce qui vient APRÈS elle
    // (cette marge + "Découvrir") détermine sa distance au bas réel de la
    // nav. Valeur mesurée réellement via Playwright (vrai Chromium en
    // cache, voir CLAUDE-SANDBOX-VERIFICATION.md), PAS calculée à la main
    // comme l'avait été, faute de mieux à l'époque, le calcul similaire du
    // 22/08 (`creditRowHeight`, retiré depuis).
    const mbDiscover = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN.match(/mb-\[(\d+)px\]/)[1]);
    expect(mbDiscover).toBeGreaterThan(0);
  });

  it('marge après le bouton "Quitter le Mode Intime" — 13px après 3 passes de resserrement (retours directs successifs le 21/08)', () => {
    // Anciennes valeurs (mb-5/20px, mb-[18px], mb-[16px]) volontairement
    // PAS testées ici : chaque retour direct désynchronise un peu plus
    // cette constante de SIDEBAR_SEPARATOR_MARGIN (restée à 20px tout du
    // long, jamais mentionnée dans aucune des demandes) — l'égalité testée
    // avant le 1er correctif n'était vraie qu'à ce moment précis, pas un
    // invariant à préserver.
    expect(SIDEBAR_NAUGHTY_EXIT_MARGIN_BOTTOM).toBe('mb-[13px]');
  });

  it('variantes Mode Intime des 2 séparateurs — 3 passes de resserrement le 21/08, DISTINCTES des variantes normales, jusqu\'ici partagées sans distinction', () => {
    expect(SIDEBAR_SEPARATOR_MARGIN_COMPACT).toBe('mt-[13px] mb-5');
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT).toBe('mt-[13px] mb-2.5');
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

    // Le "mb" du séparateur PARTAGÉ (Création/Mon Espace) reste IDENTIQUE
    // entre normal et compact — seul son "mt" devait bouger d'après les
    // traits rouges du 21/08.
    expect(SIDEBAR_SEPARATOR_MARGIN_COMPACT).toContain('mb-5');
    // ⚠️ Le "mb" du séparateur DÉCOUVRIR, lui, DIVERGE désormais entre
    // normal et compact depuis le 01/09 (contrairement à ce qui était vrai
    // jusqu'ici) : la variante NORMALE a été ancrée au bloc du bas
    // (`mb-[23px]`, voir le test dédié plus haut) sur demande explicite
    // avec capture d'écran en thème standard — la variante Mode Intime
    // n'a PAS été concernée par cette demande (capture montrait des icônes
    // rouges, pas roses) et garde donc sa valeur d'origine, désormais
    // délibérément différente plutôt qu'un oubli.
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

describe('Sidebar.jsx — ancrage du séparateur "Découvrir" au bloc du bas (01/09)', () => {
  it('la nav est étirée sur toute la hauteur disponible (h-full) avec un espaceur flexible avant le séparateur Découvrir', () => {
    // Garde-fou structurel : SANS `h-full` sur `<nav>` ET l'espaceur
    // `flex-1` juste avant le séparateur, la ligne au-dessus de
    // "Découvrir" perd son ancrage au bas de la Sidebar et redevient
    // positionnée depuis le haut (régression silencieuse vers le
    // comportement d'avant le 01/09 — voir mesure Playwright réelle dans
    // historique/bloc-12.md : écart constant de 0px à 5 hauteurs de
    // fenêtre testées avec cet ancrage, contre un écart proportionnel à la
    // hauteur de fenêtre sans lui).
    expect(SIDEBAR_JSX).toMatch(/<nav className="flex flex-col h-full">/);
    // L'espaceur doit apparaître AVANT le séparateur Découvrir dans le
    // texte source (l'ordre DOM détermine l'ordre visuel) — vérifié par
    // position d'index plutôt que juste "contient les deux", pour repérer
    // un futur réordonnancement accidentel. Cherche l'attribut seul
    // (`className="flex-1"`), pas la balise complète avec sa fermeture
    // (`<div ...></div>`) : ce fichier est un `.js`, et une balise
    // fermante littérale y déclenche à tort le garde-fou anti-JSX-dans-.js
    // (voir fileExtensionTrap.test.js, repéré en livrant ce test).
    const spacerIndex = SIDEBAR_JSX.indexOf('className="flex-1"');
    const separatorIndex = SIDEBAR_JSX.indexOf('${discoverSeparatorMargin}');
    expect(spacerIndex).toBeGreaterThan(-1);
    expect(separatorIndex).toBeGreaterThan(-1);
    expect(spacerIndex).toBeLessThan(separatorIndex);
  });
});
