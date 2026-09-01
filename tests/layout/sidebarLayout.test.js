// Premier fichier de test pour sidebarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. 14 constantes issues d'un
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
  SIDEBAR_DISCOVER_BOTTOM_MARGIN,
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

  it('séparateur avant "Découvrir" — DISTINCT du séparateur Création/Mon Espace, resserré de 10px en bas puis ancré au bloc du bas, réparti pour centrer "Découvrir" (01/09)', () => {
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN).toBe('mt-0 mb-[17px]');
    // `mt-0` (16px de `mt-4` retirés le 01/09, 3e retour direct — "léger
    // scroll" du menu de gauche sur une fenêtre pas trop haute) : SANS
    // effet réel sur la position absolue de la ligne depuis l'ajout de
    // l'espaceur flexible juste avant (voir Sidebar.jsx, `<div
    // className="flex-1">` avant ce séparateur, dans un `<nav
    // className="flex flex-col h-full">`) — la ligne est désormais ANCRÉE
    // au bas de la nav (donc au pied de page juste en dessous), pas
    // positionnée depuis le haut. Contrairement à l'espaceur `flex-1` (qui
    // dégrade proprement à 0px sous contrainte), un `margin` fixe ne cède
    // JAMAIS — `mt-4` consommait donc 16px strictement inutiles (aucun
    // effet visuel) mais TOUJOURS comptés dans le calcul de débordement de
    // la nav, rendant un scroll possible sur des fenêtres où il ne
    // l'aurait pas été sans ce gaspillage. Mis à `mt-0` : aucune perte
    // visuelle dans le cas normal, seul le cas de repli DÉGRADÉ (contenu
    // qui déborde malgré tout) perd un peu de respiration au-dessus de la
    // ligne — compromis accepté.
    // `mb-[17px]` : 3 valeurs successives une fois l'espaceur en place
    // (le vrai levier de position, voir plus haut) — `mb-[23px]` (mesuré
    // via Playwright, écart de 0.0px en bac à sable) → `mb-7`/28px (+5px
    // après un vrai déploiement ayant révélé un résidu) → `mb-[17px]`
    // (28px répartis 17/11 avec SIDEBAR_DISCOVER_BOTTOM_MARGIN, MÊME TOTAL
    // donc la ligne ne bouge pas — seule la répartition change, pour
    // centrer visuellement "Découvrir" au lieu de tout coller au-dessus).
    // Répartition ASYMÉTRIQUE (17/11, pas 14/14) : `SIDEBAR_SCROLL_PADDING`
    // ajoute déjà 6px après "Découvrir" (`pb-1.5`), invisibles à la simple
    // lecture — 14/14 aurait donné 14px perçus avant / 20px après (mesuré
    // réellement, pas supposé). 17/11 compense exactement ce déséquilibre.
    const mbDiscover = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN.match(/mb-\[(\d+)px\]/)[1]);
    expect(mbDiscover).toBeGreaterThan(0);
  });

  it('marge après "Découvrir" — complète le séparateur ci-dessus pour un centrage visuel réel (01/09)', () => {
    expect(SIDEBAR_DISCOVER_BOTTOM_MARGIN).toBe('mb-[11px]');
    // Le total (mb du séparateur + cette marge) doit rester à 28px pour ne
    // jamais déplacer la ligne au-dessus de "Découvrir" — seule la
    // RÉPARTITION entre les deux change la façon dont "Découvrir" se
    // positionne dans l'espace réservé.
    const mbSeparator = parseFloat(SIDEBAR_DISCOVER_SEPARATOR_MARGIN.match(/mb-\[(\d+)px\]/)[1]);
    const mbAfter = parseFloat(SIDEBAR_DISCOVER_BOTTOM_MARGIN.match(/mb-\[(\d+)px\]/)[1]);
    expect(mbSeparator + mbAfter).toBe(28);
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
    // ⚠️ Comparaison "compact < normal" retirée ici (01/09) — plus valide
    // depuis que `SIDEBAR_DISCOVER_SEPARATOR_MARGIN` (normal) est passée à
    // `mt-0` : ce n'est plus une valeur resserrée par un retour direct
    // comme le "mt" compact (13px), c'est un "mt" rendu délibérément
    // INERTE (l'espaceur flexible ajouté le même jour absorbe tout ce qui
    // vient avant le séparateur, voir sa docstring) puis mis à 0 pour ne
    // plus gaspiller d'espace fixe inutile (cause du "léger scroll"
    // signalé ensuite). Les 2 valeurs ne représentent plus la même chose
    // et ne sont donc plus comparables terme à terme — seule la valeur
    // absolue du compact reste vérifiée.
    expect(mtDiscoverCompact).toBe(13);

    // Le "mb" du séparateur PARTAGÉ (Création/Mon Espace) reste IDENTIQUE
    // entre normal et compact — seul son "mt" devait bouger d'après les
    // traits rouges du 21/08.
    expect(SIDEBAR_SEPARATOR_MARGIN_COMPACT).toContain('mb-5');
    // ⚠️ Le "mb" du séparateur DÉCOUVRIR, lui, DIVERGE désormais entre
    // normal et compact depuis le 01/09 (contrairement à ce qui était vrai
    // jusqu'ici) : la variante NORMALE a été ancrée au bloc du bas puis
    // répartie pour centrer "Découvrir" (`mb-[17px]` + `SIDEBAR_DISCOVER_BOTTOM_MARGIN`,
    // voir les tests dédiés plus haut) sur demande explicite avec capture
    // d'écran en thème standard — la variante Mode Intime n'a PAS été
    // concernée par ces demandes (les captures montraient des icônes
    // rouges, pas roses) et garde donc sa valeur d'origine, désormais
    // délibérément différente plutôt qu'un oubli.
    expect(SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT).toContain('mb-2.5');
  });
});

describe('sidebarLayout — importé par Sidebar.jsx (pas recopié en dur)', () => {
  it('les 14 constantes sont bien importées depuis ce module', () => {
    expect(SIDEBAR_JSX).toMatch(/from ['"].*sidebarLayout['"]/);
    for (const name of [
      'SIDEBAR_LINK_PADDING', 'SIDEBAR_LINK_GAP', 'SIDEBAR_SECTION_TITLE_MARGIN',
      'SIDEBAR_LINK_PADDING_COMPACT', 'SIDEBAR_LINK_GAP_COMPACT', 'SIDEBAR_SECTION_TITLE_MARGIN_COMPACT',
      'SIDEBAR_SEPARATOR_MARGIN', 'SIDEBAR_SEPARATOR_MARGIN_COMPACT',
      'SIDEBAR_DISCOVER_SEPARATOR_MARGIN', 'SIDEBAR_DISCOVER_SEPARATOR_MARGIN_COMPACT',
      'SIDEBAR_DISCOVER_BOTTOM_MARGIN',
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
    // historique/bloc-13.md : écart constant de 0px à 5 hauteurs de
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

  it('le conteneur du bouton "Découvrir" porte bien la marge de centrage (discoverBottomMargin)', () => {
    // Garde-fou structurel complémentaire (01/09, retour direct : "le
    // bouton Découvrir n'est plus centré dans son bloc") — SANS cette
    // marge sur le conteneur du bouton lui-même, tout l'espace réservé
    // reviendrait avant "Découvrir" (collé au pied de page), pas réparti
    // des 2 côtés. `isNaughtyMode` doit apparaître dans son calcul (vide
    // en Mode Intime, voir la docstring de `discoverBottomMargin` dans
    // Sidebar.jsx) — non concerné par cette demande, capture en thème
    // standard uniquement.
    expect(SIDEBAR_JSX).toContain('const discoverBottomMargin = isNaughtyMode ? \'\' : SIDEBAR_DISCOVER_BOTTOM_MARGIN;');
    expect(SIDEBAR_JSX).toContain('${discoverBottomMargin}');
  });
});
