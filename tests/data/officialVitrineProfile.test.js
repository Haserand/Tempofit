import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_VITRINE_USERNAME,
  buildOfficialVitrineProfile,
  buildOfficialVitrinePlaylistRows,
} from '../../src/data/officialVitrineProfile.js';
import { curatedSessions, naughtyCuratedSessions } from '../../src/data/curatedSessions.js';

describe('OFFICIAL_VITRINE_USERNAME', () => {
  it('respecte le format de pseudo valide (mêmes règles que USERNAME_REGEX, utils/username.js)', () => {
    expect(OFFICIAL_VITRINE_USERNAME).toMatch(/^[a-z0-9_]{3,20}$/);
  });

  // Relecture globale (02/08) — verrouille une propriété croisée entre 2
  // chantiers distincts de cette session : `isReservedUsername` (utils/
  // username.js, écrit APRÈS ce fichier) bloque désormais ce pseudo précis
  // à l'inscription — un vrai compte ne peut donc plus jamais entrer en
  // collision avec cette vitrine (voir la docstring d'officialVitrineProfile.js,
  // mise à jour en conséquence). Si ce test casse un jour, ça voudrait dire
  // que quelqu'un pourrait de nouveau réserver ce pseudo — à traiter
  // immédiatement, pas un simple test qui casse par hasard.
  it('reste TOUJOURS bloqué par isReservedUsername (utils/username.js) — un vrai compte ne peut jamais le réserver', async () => {
    const { isReservedUsername } = await import('../../src/utils/username.js');
    expect(isReservedUsername(OFFICIAL_VITRINE_USERNAME)).toBe(true);
  });
});

describe('buildOfficialVitrineProfile', () => {
  const profile = buildOfficialVitrineProfile();

  it('a le pseudo fixe attendu', () => {
    expect(profile.username).toBe(OFFICIAL_VITRINE_USERNAME);
  });

  it('user_id vaut null — ne peut donc JAMAIS égaler un vrai user.id (toujours une chaîne UUID), isSelf reste toujours false', () => {
    expect(profile.user_id).toBeNull();
  });

  it('avatar_url vaut null — repli sur l\'initiale du pseudo, pas de nouvel asset', () => {
    expect(profile.avatar_url).toBeNull();
  });

  it('renvoie sport_sessions ET intimate_sessions ensemble, TOUJOURS les deux — pas conditionné à un mode', () => {
    expect(Array.isArray(profile.sport_sessions)).toBe(true);
    expect(Array.isArray(profile.intimate_sessions)).toBe(true);
    expect(profile.sport_sessions.length).toBeGreaterThan(0);
    expect(profile.intimate_sessions.length).toBeGreaterThan(0);
  });

  it('chaque séance a la forme exacte { totalDuration, bpm } (même contrat que get_public_profile_summary)', () => {
    [...profile.sport_sessions, ...profile.intimate_sessions].forEach(session => {
      expect(typeof session.totalDuration).toBe('number');
      expect(typeof session.bpm).toBe('number');
      expect(session.totalDuration).toBeGreaterThan(0);
      expect(session.bpm).toBeGreaterThan(0);
    });
  });

  it('statistiques "ambitieuses" (brief) : plusieurs centaines de séances, plusieurs centaines d\'heures cumulées', () => {
    const totalSportHours = profile.sport_sessions.reduce((s, x) => s + x.totalDuration, 0) / 3600;
    expect(profile.sport_sessions.length).toBeGreaterThanOrEqual(300);
    expect(totalSportHours).toBeGreaterThan(100);
  });

  it('déterministe — 2 appels de suite renvoient des valeurs STRICTEMENT identiques (jamais Math.random)', () => {
    const profile2 = buildOfficialVitrineProfile();
    expect(profile2.sport_sessions).toEqual(profile.sport_sessions);
    expect(profile2.intimate_sessions).toEqual(profile.intimate_sessions);
  });
});

describe('buildOfficialVitrinePlaylistRows', () => {
  const rows = buildOfficialVitrinePlaylistRows();

  it('renvoie une ligne par template du catalogue, Sport ET Intime confondus', () => {
    expect(rows.length).toBe(curatedSessions.length + naughtyCuratedSessions.length);
  });

  it('is_public vaut TOUJOURS true, sur toutes les lignes', () => {
    expect(rows.every(r => r.is_public === true)).toBe(true);
  });

  it('is_intimate reflète correctement le catalogue d\'origine (false pour curatedSessions, true pour naughtyCuratedSessions)', () => {
    const sportRows = rows.filter(r => !r.is_intimate);
    const intimateRows = rows.filter(r => r.is_intimate);
    expect(sportRows.length).toBe(curatedSessions.length);
    expect(intimateRows.length).toBe(naughtyCuratedSessions.length);
  });

  it('id unique, préfixé "vitrine-", dérivé de l\'id du template source', () => {
    const ids = rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length); // tous uniques
    expect(ids.every(id => id.startsWith('vitrine-'))).toBe(true);
  });

  it('content.name reflète template.title, content.workoutType reflète template.workoutType', () => {
    const row = rows.find(r => r._sourceTemplate.id === curatedSessions[0].id);
    expect(row.content.name).toBe(curatedSessions[0].title);
    expect(row.content.workoutType).toBe(curatedSessions[0].workoutType);
  });

  it('content.totalDuration = somme des durées des titres du template', () => {
    const template = curatedSessions[0];
    const expected = template.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const row = rows.find(r => r._sourceTemplate.id === template.id);
    expect(row.content.totalDuration).toBe(expected);
  });

  it('_sourceTemplate est la RÉFÉRENCE exacte du template d\'origine (pas une copie) — nécessaire pour handleOpenPublicPlaylist (App.jsx), qui le passe tel quel à openCuratedPlaylist', () => {
    const row = rows.find(r => r._sourceTemplate.id === curatedSessions[0].id);
    expect(row._sourceTemplate).toBe(curatedSessions[0]);
  });

  it('content.coverUrl est renseignée (pochette calculée, jamais vide)', () => {
    expect(rows.every(r => typeof r.content.coverUrl === 'string' && r.content.coverUrl.length > 0)).toBe(true);
  });
});
