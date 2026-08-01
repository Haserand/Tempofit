import { describe, it, expect } from 'vitest';
import {
  computeZonesFromBaseBpm,
  getDefaultBaseBpm,
  buildDefaultPreviewProfile,
  getZoneSpacingForActivity,
  isCadenceIntentEligible,
  emptyProfile,
  ATHLETIC_BPM_FLOOR,
} from '../../src/athleticZones.js';

/**
 * athleticZones.test.js — sécurise la logique de calcul des zones BPM
 * athlétiques (src/athleticZones.js), extraite de useAthleticProfile.js
 * (qui, lui, reste intestable sans un vrai environnement React — voir la
 * note de scope tout en bas de ce fichier).
 *
 * Converti depuis une version node:test (session du 26/07/2026) — même
 * noms de tests, mêmes valeurs attendues, déjà vérifiées par exécution
 * réelle des fonctions avant d'écrire les assertions. Cette conversion
 * elle-même n'a PAS pu être exécutée dans le sandbox où elle a été écrite
 * (pas d'accès npm) — à faire tourner ici via `npm run test:run` avant de
 * s'y fier.
 */

describe('computeZonesFromBaseBpm', () => {
  it('espace les 4 zones symétriquement autour du BPM de base', () => {
    expect(computeZonesFromBaseBpm(160, 15)).toEqual({
      zone1: 145, zone2: 160, zone3: 175, zone4: 190,
    });
  });

  it('utilise l\'espacement par défaut (10) si non fourni', () => {
    expect(computeZonesFromBaseBpm(100)).toEqual({
      zone1: 90, zone2: 100, zone3: 110, zone4: 120,
    });
  });

  it(`ne descend jamais sous le plancher (${ATHLETIC_BPM_FLOOR} BPM), même si ça aplatit plusieurs zones`, () => {
    // Cas volontairement extrême : un BPM de base très bas peut faire
    // coïncider zone1/zone2/zone3 au plancher — comportement ASSUMÉ (sécurité
    // contre une Zone 1 absurde), pas un bug à masquer.
    expect(computeZonesFromBaseBpm(30, 10)).toEqual({
      zone1: 40, zone2: 40, zone3: 40, zone4: 50,
    });
  });
});

describe('getDefaultBaseBpm', () => {
  it('renvoie le BPM par défaut connu pour Course à pied', () => {
    expect(getDefaultBaseBpm('Course à pied')).toBe(160);
  });

  it('renvoie le BPM par défaut connu pour Cyclisme', () => {
    expect(getDefaultBaseBpm('Cyclisme')).toBe(140);
  });

  it('replie sur "Autre" (140) pour une activité inconnue', () => {
    expect(getDefaultBaseBpm('Kayak')).toBe(140);
  });
});

describe('getZoneSpacingForActivity', () => {
  it('espacement "Énergie" (par défaut) large pour Course à pied', () => {
    expect(getZoneSpacingForActivity('Course à pied')).toBe(15);
  });

  it('espacement "Synchro cadence" resserré pour Course à pied', () => {
    expect(getZoneSpacingForActivity('Course à pied', 'sync')).toBe(6);
  });

  it('replie sur l\'espacement par défaut (10) pour une activité inconnue en mode Énergie', () => {
    expect(getZoneSpacingForActivity('Kayak')).toBe(10);
  });

  it('replie sur l\'espacement Synchro par défaut (4) pour une activité inconnue en mode Synchro', () => {
    expect(getZoneSpacingForActivity('Kayak', 'sync')).toBe(4);
  });
});

describe('buildDefaultPreviewProfile', () => {
  it('profil aperçu "Énergie" pour Course à pied : combine BPM par défaut + espacement large', () => {
    expect(buildDefaultPreviewProfile('Course à pied')).toEqual({
      isConfigured: false, targetBpm: 160, cadenceIntent: 'energy',
      zone1: 145, zone2: 160, zone3: 175, zone4: 190,
    });
  });

  it('profil aperçu "Synchro" pour Cyclisme : même BPM de base, espacement resserré', () => {
    expect(buildDefaultPreviewProfile('Cyclisme', 'sync')).toEqual({
      isConfigured: false, targetBpm: 140, cadenceIntent: 'sync',
      zone1: 137, zone2: 140, zone3: 143, zone4: 146,
    });
  });

  it('reste cohérent pour une activité personnalisée (repli "Autre" + espacement par défaut)', () => {
    expect(buildDefaultPreviewProfile('__custom__')).toEqual({
      isConfigured: false, targetBpm: 140, cadenceIntent: 'energy',
      zone1: 130, zone2: 140, zone3: 150, zone4: 160,
    });
  });
});

describe('isCadenceIntentEligible', () => {
  it('la Musculation n\'est PAS éligible au mode Synchro (pas de rythme cyclique)', () => {
    expect(isCadenceIntentEligible('Musculation')).toBe(false);
  });

  it('toute autre activité (y compris personnalisée) est éligible par défaut', () => {
    expect(isCadenceIntentEligible('Elliptique')).toBe(true);
    expect(isCadenceIntentEligible('Course à pied')).toBe(true);
  });
});

describe('emptyProfile', () => {
  it('renvoie un profil non configuré, zones à null, intention "energy" par défaut', () => {
    expect(emptyProfile()).toEqual({
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
