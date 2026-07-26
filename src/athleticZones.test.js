// athleticZones.test.js — tests pour la logique de calcul des zones BPM
// athlétiques (src/athleticZones.js).
//
// Utilise le test runner NATIF de Node (`node:test` + `node:assert`), même
// modèle que src/utils/numberInput.test.js — voir ce fichier pour le détail
// du choix (zéro dépendance à installer, donc exécutable directement avec
// `node --test src/athleticZones.test.js`).
//
// Portée : les fonctions PURES de src/athleticZones.js, extraites cette
// session de useAthleticProfile.js (qui, lui, reste intestable sans React —
// voir la note de scope tout en bas de ce fichier). Toutes les valeurs
// attendues ci-dessous ont été vérifiées par exécution réelle des fonctions
// avant d'écrire les assertions, aucune n'est devinée.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeZonesFromBaseBpm,
  getDefaultBaseBpm,
  buildDefaultPreviewProfile,
  getZoneSpacingForActivity,
  isCadenceIntentEligible,
  emptyProfile,
  ATHLETIC_BPM_FLOOR,
} from './athleticZones.js';

describe('computeZonesFromBaseBpm', () => {
  test('espace les 4 zones symétriquement autour du BPM de base', () => {
    assert.deepStrictEqual(computeZonesFromBaseBpm(160, 15), {
      zone1: 145, zone2: 160, zone3: 175, zone4: 190,
    });
  });

  test('utilise l\'espacement par défaut (10) si non fourni', () => {
    assert.deepStrictEqual(computeZonesFromBaseBpm(100), {
      zone1: 90, zone2: 100, zone3: 110, zone4: 120,
    });
  });

  test(`ne descend jamais sous le plancher (${ATHLETIC_BPM_FLOOR} BPM), même si ça aplatit plusieurs zones`, () => {
    // Cas volontairement extrême : un BPM de base très bas peut faire
    // coïncider zone1/zone2/zone3 au plancher — comportement ASSUMÉ (sécurité
    // contre une Zone 1 absurde), pas un bug à masquer.
    assert.deepStrictEqual(computeZonesFromBaseBpm(30, 10), {
      zone1: 40, zone2: 40, zone3: 40, zone4: 50,
    });
  });
});

describe('getDefaultBaseBpm', () => {
  test('renvoie le BPM par défaut connu pour Course à pied', () => {
    assert.strictEqual(getDefaultBaseBpm('Course à pied'), 160);
  });

  test('renvoie le BPM par défaut connu pour Cyclisme', () => {
    assert.strictEqual(getDefaultBaseBpm('Cyclisme'), 140);
  });

  test('replie sur "Autre" (140) pour une activité inconnue', () => {
    assert.strictEqual(getDefaultBaseBpm('Kayak'), 140);
  });
});

describe('getZoneSpacingForActivity', () => {
  test('espacement "Énergie" (par défaut) large pour Course à pied', () => {
    assert.strictEqual(getZoneSpacingForActivity('Course à pied'), 15);
  });

  test('espacement "Synchro cadence" resserré pour Course à pied', () => {
    assert.strictEqual(getZoneSpacingForActivity('Course à pied', 'sync'), 6);
  });

  test('replie sur l\'espacement par défaut (10) pour une activité inconnue en mode Énergie', () => {
    assert.strictEqual(getZoneSpacingForActivity('Kayak'), 10);
  });

  test('replie sur l\'espacement Synchro par défaut (4) pour une activité inconnue en mode Synchro', () => {
    assert.strictEqual(getZoneSpacingForActivity('Kayak', 'sync'), 4);
  });
});

describe('buildDefaultPreviewProfile', () => {
  test('profil aperçu "Énergie" pour Course à pied : combine BPM par défaut + espacement large', () => {
    assert.deepStrictEqual(buildDefaultPreviewProfile('Course à pied'), {
      isConfigured: false, targetBpm: 160, cadenceIntent: 'energy',
      zone1: 145, zone2: 160, zone3: 175, zone4: 190,
    });
  });

  test('profil aperçu "Synchro" pour Cyclisme : même BPM de base, espacement resserré', () => {
    assert.deepStrictEqual(buildDefaultPreviewProfile('Cyclisme', 'sync'), {
      isConfigured: false, targetBpm: 140, cadenceIntent: 'sync',
      zone1: 137, zone2: 140, zone3: 143, zone4: 146,
    });
  });

  test('reste cohérent pour une activité personnalisée (repli "Autre" + espacement par défaut)', () => {
    assert.deepStrictEqual(buildDefaultPreviewProfile('__custom__'), {
      isConfigured: false, targetBpm: 140, cadenceIntent: 'energy',
      zone1: 130, zone2: 140, zone3: 150, zone4: 160,
    });
  });
});

describe('isCadenceIntentEligible', () => {
  test('la Musculation n\'est PAS éligible au mode Synchro (pas de rythme cyclique)', () => {
    assert.strictEqual(isCadenceIntentEligible('Musculation'), false);
  });

  test('toute autre activité (y compris personnalisée) est éligible par défaut', () => {
    assert.strictEqual(isCadenceIntentEligible('Elliptique'), true);
    assert.strictEqual(isCadenceIntentEligible('Course à pied'), true);
  });
});

describe('emptyProfile', () => {
  test('renvoie un profil non configuré, zones à null, intention "energy" par défaut', () => {
    assert.deepStrictEqual(emptyProfile(), {
      isConfigured: false, targetBpm: null,
      zone1: null, zone2: null, zone3: null, zone4: null,
      cadenceIntent: 'energy',
    });
  });
});

// Note de portée : la fonction "Calculer mes zones" telle qu'exposée à
// l'utilisateur (setBaseBpmForActivity, dans useAthleticProfile.js) N'EST
// PAS testée directement ici — c'est un handler stateful (elle referme sur
// setAthleticProfile). Elle délègue cependant tout son calcul réel à
// computeZonesFromBaseBpm + getZoneSpacingForActivity, ci-dessus : c'est
// cette partie-là, la vraie logique métier, qui est couverte. Si un bug de
// zones incohérentes est de nouveau signalé, la première chose à vérifier
// est que setBaseBpmForActivity appelle bien ces deux fonctions avec les
// bons arguments — pas que leur calcul interne soit faux (couvert ici).
