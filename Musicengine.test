import { describe, it, expect } from 'vitest';
import { deduceCrescendoBpm, buildCrescendoSegments, pickByDurationProximity, recalculateTimeline } from '../src/musicEngine.js';

/**
 * musicEngine.test.js — sécurise le cœur du moteur de génération : dérivation
 * du BPM Échauffement/Retour au calme (mode Crescendo), découpage en segments,
 * et recalcul de la timeline d'une playlist (horodatages + durée totale).
 *
 * Toutes les fonctions testées ici sont PURES (aucun setState, aucun appel
 * réseau) — voir la docstring en tête de musicEngine.js. C'est ce qui permet
 * de les tester en pur Node/Vitest, sans navigateur.
 *
 * Lien avec l'audit précédent : `applyProfileBpmIfUntouched` (useGeneratorForm.js)
 * n'est PAS testée ici directement — c'est une fonction React stateful (elle
 * referme sur le state du wizard), pas une fonction pure isolée. Elle délègue
 * cependant tout son calcul à `deduceCrescendoBpm`, ci-dessous — c'est cette
 * partie-là, la vraie logique métier, qui est couverte.
 */

describe('deduceCrescendoBpm', () => {
  it('déduit un échauffement à -30 BPM et un retour au calme à -45 BPM du BPM cible (arrondis au multiple de 5)', () => {
    expect(deduceCrescendoBpm(160)).toEqual({ warmupBpm: 130, cooldownBpm: 115 });
  });

  it('ne descend jamais sous le plancher fourni (bpmFloor)', () => {
    // BPM cible très bas : sans plancher, l'échauffement/retour au calme
    // tomberait à des valeurs absurdes (voire négatives) — le floor doit primer.
    const result = deduceCrescendoBpm(90, 80);
    expect(result.warmupBpm).toBeGreaterThanOrEqual(80);
    expect(result.cooldownBpm).toBeGreaterThanOrEqual(80);
  });

  it('retombe sur un BPM cible par défaut de 120 si la valeur fournie est invalide (NaN/undefined)', () => {
    // parseInt(undefined) || 120 -> 120 ; warmup = max(80, round((120-30)/5)*5) = 90
    expect(deduceCrescendoBpm(undefined)).toEqual({ warmupBpm: 90, cooldownBpm: 80 });
  });
});

describe('buildCrescendoSegments', () => {
  it('découpe une séance d\'1h (15%/15%) en 3 segments Échauffement/Cœur/Retour au calme', () => {
    const segments = buildCrescendoSegments('time', 160, 1, 0, null, null, null, 80, 15, 15);
    expect(segments).toHaveLength(3);
    expect(segments.map(s => s._crescendoLabel)).toEqual(['Échauffement', 'Cœur de séance', 'Retour au calme']);
    // 60min à 15%/15% -> 9min / 42min / 9min
    expect(segments.map(s => s.durationValue)).toEqual([9, 42, 9]);
    expect(segments[0].bpm).toBe(130); // = deduceCrescendoBpm(160).warmupBpm
    expect(segments[1].bpm).toBe(160); // BPM cible, inchangé au cœur de séance
    expect(segments[2].bpm).toBe(115); // = deduceCrescendoBpm(160).cooldownBpm
  });

  it('retombe sur un seul segment (pas de 3 phases) en dessous de 10 minutes', () => {
    // 8 minutes : distinguer 3 phases n'a plus de sens (voir docstring de la fonction)
    const segments = buildCrescendoSegments('time', 160, 0, 8, null, null, null, 80, 15, 15);
    expect(segments).toHaveLength(1);
    expect(segments[0].bpm).toBe(160);
    expect(segments[0].durationValue).toBe(8);
  });

  it('respecte un BPM échauffement/retour au calme forcé manuellement, sans jamais passer sous le plancher', () => {
    const segments = buildCrescendoSegments('time', 160, 1, 0, null, null, null, 80, 15, 15, /* manualWarmupBpm */ 50, /* manualCooldownBpm */ 60);
    expect(segments[0].bpm).toBe(80); // 50 forcé, mais reclampé au plancher (80)
    expect(segments[2].bpm).toBe(80); // idem pour 60
  });
});

describe('pickByDurationProximity', () => {
  it('renvoie l\'unique candidat sans ambiguïté possible', () => {
    const only = [{ duration: 200 }];
    expect(pickByDurationProximity(only, 180)).toBe(only[0]);
  });

  it('ne choisit jamais un candidat hors du top 3 par proximité de durée', () => {
    const candidates = [
      { duration: 500 }, // très loin de la cible
      { duration: 185 }, // proche
      { duration: 190 }, // proche
      { duration: 175 }, // proche
      { duration: 600 }, // très loin
    ];
    const closeOnes = [candidates[1], candidates[2], candidates[3]];
    // Répété pour couvrir l'aléatoire interne (parmi le top 3) sans faux négatif
    for (let i = 0; i < 20; i++) {
      const picked = pickByDurationProximity(candidates, 180);
      expect(closeOnes).toContain(picked);
    }
  });
});

describe('recalculateTimeline', () => {
  it('calcule les horodatages de départ en tenant compte du crossfade, et la durée totale', () => {
    const playlist = {
      tracks: [{ duration: 200 }, { duration: 180 }, { duration: 220 }],
      crossfade: 3,
      avgPace: 330,
    };
    const result = recalculateTimeline(playlist);

    expect(result.tracks[0].startTimeStr).toBe('0m 00s');
    expect(result.tracks[1].startTimeStr).toBe('3m 17s'); // 200 - 3s de crossfade
    expect(result.tracks[2].startTimeStr).toBe('6m 14s'); // (200-3) + (180-3)
    // Total = somme des durées - crossfade * (nb morceaux - 1)
    expect(result.totalDuration).toBe(200 + 180 + 220 - 3 * 2);
  });

  it('startDistVal est un NOMBRE, jamais une chaîne (régression documentée : cassait l\'axe Distance du graphique)', () => {
    const result = recalculateTimeline({ tracks: [{ duration: 300 }], crossfade: 0, avgPace: 330 });
    expect(typeof result.tracks[0].startDistVal).toBe('number');
  });
});
