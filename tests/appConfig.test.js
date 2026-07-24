import { describe, it, expect } from 'vitest';
import {
  getZoneForValue,
  getBpmBucketStart,
  getBpmBucketLabel,
  getBpmBucketColor,
  getActivityEmoji,
} from '../src/appConfig.js';

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
