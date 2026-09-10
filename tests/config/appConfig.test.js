import { describe, it, expect } from 'vitest';
import {
  getZoneForValue,
  getBpmBucketStart,
  getBpmBucketLabel,
  getBpmBucketColor,
  getActivityEmoji,
  getCadenceUnitLabel,
  getRankStyle,
  TROPHIES_DATA,
} from '../../src/appConfig.js';

describe('getZoneForValue', () => {
  const mockProfile = { zone1: 100, zone2: 130, zone3: 150, zone4: 170 };
  const getProfile = (name) => (name === 'Course à pied' ? mockProfile : null);

  it('trouve la zone la plus proche par valeur exacte', () => {
    expect(getZoneForValue(130, 'Course à pied', getProfile)).toEqual(
      expect.objectContaining({ key: 'zone2', shortLabel: 'Endurance' })
    );
  });

  it('classe par PLUS PROCHE VOISIN, pas par bornes fixes', () => {
    // 141 est à 11 de zone2 (130) et 9 de zone3 (150) -> zone3
    expect(getZoneForValue(141, 'Course à pied', getProfile)?.key).toBe('zone3');
  });

  it('en cas d\'égalité de distance, garde la 1re zone rencontrée (ordre ATHLETIC_ZONES)', () => {
    // 140 est à 10 de zone2 ET 10 de zone3 -> zone2 (apparaît en premier)
    expect(getZoneForValue(140, 'Course à pied', getProfile)?.key).toBe('zone2');
  });

  it('renvoie null si le résolveur ne connaît pas cette activité (non configurée)', () => {
    expect(getZoneForValue(130, 'Cyclisme', getProfile)).toBeNull();
  });

  it('renvoie null si value ou getProfileForWorkout sont absents', () => {
    expect(getZoneForValue(null, 'Course à pied', getProfile)).toBeNull();
    expect(getZoneForValue(130, 'Course à pied', null)).toBeNull();
  });
});

describe('getBpmBucketStart / getBpmBucketLabel', () => {
  // Non-régression : cette formule était dupliquée à l'identique dans
  // PlaylistDetailContext.jsx, StatsView.jsx, PlaylistDetailView.jsx et
  // TrackItem.jsx avant extraction ici (session dette technique, prise de
  // recul sur les tests).
  it('regroupe par tranches de 20 BPM, tranche = [start, start+19]', () => {
    expect(getBpmBucketStart(100)).toBe(100);
    expect(getBpmBucketStart(119)).toBe(100);
    expect(getBpmBucketStart(120)).toBe(120);
    expect(getBpmBucketLabel(100)).toBe('100-119');
    expect(getBpmBucketLabel(119)).toBe('100-119');
    expect(getBpmBucketLabel(120)).toBe('120-139');
  });

  it('gère les BPM bas (< 60) et hauts (> 200) sans borne fixe', () => {
    expect(getBpmBucketLabel(59)).toBe('40-59');
    expect(getBpmBucketLabel(220)).toBe('220-239');
  });
});

describe('getBpmBucketColor', () => {
  it('assigne une couleur FIXE par valeur de bucketStart, pas par position dans une liste', () => {
    expect(getBpmBucketColor(0)).toBe('#06b6d4');
    expect(getBpmBucketColor(99)).toBe('#06b6d4');
    expect(getBpmBucketColor(100)).toBe('#6366f1');
    expect(getBpmBucketColor(139)).toBe('#8b5cf6');
    expect(getBpmBucketColor(140)).toBe('#d946ef');
    expect(getBpmBucketColor(160)).toBe('#f43f5e');
  });

  it('même bucketStart -> même couleur, quel que soit l\'appelant (camembert ou badge isolé)', () => {
    expect(getBpmBucketColor(getBpmBucketStart(145))).toBe(getBpmBucketColor(getBpmBucketStart(148)));
  });

  it('replie sur la dernière couleur pour un bucketStart au-delà de 160', () => {
    expect(getBpmBucketColor(999)).toBe('#f43f5e');
  });
});

describe('getActivityEmoji', () => {
  it('renvoie l\'emoji dédié pour chaque activité canonique', () => {
    expect(getActivityEmoji('Course à pied')).toBe('🏃');
    expect(getActivityEmoji('Cyclisme')).toBe('🚴');
    expect(getActivityEmoji('Musculation')).toBe('🏋️');
  });

  it('Mode Intime : "Ambiance" a son propre emoji dédié', () => {
    expect(getActivityEmoji('Ambiance')).toBe('🌶️');
  });

  it('replie sur 🎧 pour "Autre" et toute activité personnalisée/inconnue', () => {
    expect(getActivityEmoji('Autre')).toBe('🎧');
    expect(getActivityEmoji('Escalade')).toBe('🎧');
    expect(getActivityEmoji(undefined)).toBe('🎧');
  });
});

describe('getCadenceUnitLabel', () => {
  it('PPM pour Course à pied', () => {
    expect(getCadenceUnitLabel('Course à pied')).toBe('PPM');
  });

  it('RPM pour Cyclisme', () => {
    expect(getCadenceUnitLabel('Cyclisme')).toBe('RPM');
  });

  it('replie sur "cad/min" pour une activité inconnue', () => {
    expect(getCadenceUnitLabel('Kayak')).toBe('cad/min');
  });
});

describe('getRankStyle', () => {
  it('renvoie le style Or pour le rang 0', () => {
    expect(getRankStyle(0)).toEqual({ emoji: '🥇', border: 'border-yellow-500 ring-2 ring-yellow-500/20' });
  });

  it('renvoie le style Bronze pour le rang 2', () => {
    expect(getRankStyle(2)).toEqual({ emoji: '🥉', border: 'border-amber-700 ring-2 ring-amber-700/20' });
  });

  it('renvoie null au-delà du podium (rang 3+)', () => {
    expect(getRankStyle(3)).toBeNull();
  });

  it('renvoie null pour un rang négatif', () => {
    expect(getRankStyle(-1)).toBeNull();
  });
});

// Garde-fou permanent (01/09, retour direct : "vois-tu des principes à
// généraliser... sur le design des photos des trophées à générer ?") —
// jusqu'ici, l'unicité de `id`/`icon` était vérifiée À LA MAIN à chaque
// ajout de trophée (une recherche manuelle dans le fichier avant
// d'écrire un nouvel emoji) — fiable une fois, deux fois, risqué à mesure
// que la liste grandit (déjà 40 entrées). Un `icon` dupliqué rendrait 2
// trophées visuellement indissociables sur le mur des trophées ET sur
// leurs visuels partageables respectifs (TrophyShareCard.jsx) — la seule
// vraie information visuelle de la carte, avec le nom.
describe('TROPHIES_DATA — intégrité (garde-fou permanent)', () => {
  it('tous les `id` sont uniques', () => {
    const ids = TROPHIES_DATA.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tous les `icon` sont uniques — 2 trophées ne doivent jamais partager le même emoji', () => {
    const icons = TROPHIES_DATA.map(t => t.icon);
    const duplicates = icons.filter((icon, i) => icons.indexOf(icon) !== i);
    expect(duplicates).toEqual([]);
  });

  it('chaque trophée a bien tous ses champs obligatoires (id/name/desc/icon/requirement)', () => {
    for (const t of TROPHIES_DATA) {
      expect(t.id, `trophée sans id : ${JSON.stringify(t)}`).toBeTruthy();
      expect(t.name, `${t.id} sans name`).toBeTruthy();
      expect(t.desc, `${t.id} sans desc`).toBeTruthy();
      expect(t.icon, `${t.id} sans icon`).toBeTruthy();
      expect(t.requirement, `${t.id} sans requirement`).toBeTruthy();
      expect(t.requirement.type, `${t.id} : requirement sans type`).toBeTruthy();
    }
  });

  it('un trophée non secret a toujours une `category` (nécessaire au groupement de TrophiesView.jsx)', () => {
    for (const t of TROPHIES_DATA) {
      if (!t.secret) expect(t.category, `${t.id} n'est pas secret mais n'a pas de category`).toBeTruthy();
    }
  });

  // Garde-fou HEURISTIQUE (01/09, retour direct : "généralise aussi les
  // règles qu'on vient d'appliquer sur... la taille des descriptions") —
  // jsdom ne peut PAS mesurer un vrai rendu (pas de moteur de mise en page
  // réel, `getBoundingClientRect()` n'y reflète aucune métrique de police
  // réelle) : ce test ne remplace donc PAS une vraie mesure Playwright
  // (seule méthode fiable, voir historique/bloc-22.md pour le récit
  // complet — 3 passes de correctifs successives cette même journée,
  // toutes découvertes à la main via un harnais temporaire). C'est un
  // FILET DE SÉCURITÉ grossier : la longueur en caractères n'est pas un
  // prédicteur parfait de la largeur réellement rendue (des lettres
  // étroites — i, l, t — occupent moins de place que des lettres larges —
  // m, w — à nombre égal de caractères), mais elle attrape déjà les cas
  // évidents. Seuil fixé à 48 caractères, calibré sur la plus longue
  // description qui, une fois mesurée réellement, tient bien sur 1 ligne
  // à partir de 1024px de large (47 caractères, "Never Gonna Give You
  // Up") — toute NOUVELLE description dépassant ce seuil doit être
  // reprise, puis revérifiée par une vraie mesure avant d'être considérée
  // sûre, pas seulement re-comptée en caractères.
  it('aucune description ne dépasse 48 caractères (filet de sécurité approximatif, PAS une garantie de rendu — voir la mesure réelle Playwright pour ça)', () => {
    const MAX_DESC_LENGTH = 48;
    for (const t of TROPHIES_DATA) {
      expect(t.desc.length, `${t.id} : "${t.desc}" (${t.desc.length} car.) dépasse ${MAX_DESC_LENGTH} caractères — à revoir, PUIS à revérifier par une vraie mesure`).toBeLessThanOrEqual(MAX_DESC_LENGTH);
    }
  });
});
