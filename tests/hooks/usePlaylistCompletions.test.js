// Test dédié à usePlaylistCompletions.js — 0 test jusqu'ici (check-up du
// 13/08) malgré une logique métier réelle (déblocage de 5 trophées
// différents, fenêtre anti-rebond, streak, distance cumulée). Pas de
// `useState`/`useEffect`/Contexte à l'intérieur de ce hook (toutes ses
// dépendances — `savedPlaylists`/`setSavedPlaylists`/`showToast`/
// `userStats`/`checkTrophies` — sont reçues en paramètres) : appelable
// comme une simple fonction, `renderHook` n'est pas nécessaire, `node`
// (l'environnement par défaut de ce projet) suffit.

import { describe, it, expect, vi } from 'vitest';
import { usePlaylistCompletions } from '../../src/hooks/usePlaylistCompletions.js';

function basePlaylist(overrides = {}) {
  return {
    id: 'pl-1', isNaughty: false, workoutType: 'Course à pied',
    completions: [], actualDataByDate: {},
    ...overrides,
  };
}

function baseUserStats(overrides = {}) {
  return {
    totalCompleted: 0, naughtyCompleted: 0, hasNightOwl: false,
    hasCrescendoCompleted: false, hasOnTimeCompletion: false,
    completedWorkoutTypes: [], hasAllWorkoutTypes: false,
    totalDistanceKm: 0, has100km: false, hasStreak3: false,
    ...overrides,
  };
}

function setup({ savedPlaylists, userStats, checkTrophiesResult = false } = {}) {
  const setSavedPlaylists = vi.fn();
  const showToast = vi.fn();
  const checkTrophies = vi.fn(() => checkTrophiesResult);
  const hook = usePlaylistCompletions(
    savedPlaylists || [basePlaylist()],
    setSavedPlaylists,
    showToast,
    userStats || baseUserStats(),
    checkTrophies,
  );
  return { ...hook, setSavedPlaylists, showToast, checkTrophies };
}

describe('markPlaylistAsCompleted — cas "maintenant" (isoDate absent)', () => {
  it('playlist introuvable : ne fait rien (pas de setSavedPlaylists, pas de toast)', () => {
    const { markPlaylistAsCompleted, setSavedPlaylists, showToast } = setup({ savedPlaylists: [] });
    markPlaylistAsCompleted('inconnue');
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('ajoute un horodatage complet à `completions`, incrémente totalCompleted, affiche le toast générique', () => {
    const { markPlaylistAsCompleted, setSavedPlaylists, showToast, checkTrophies } = setup();
    markPlaylistAsCompleted('pl-1');

    const updated = setSavedPlaylists.mock.calls[0][0];
    expect(updated[0].completions).toHaveLength(1);
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ totalCompleted: 1 }));
    expect(showToast).toHaveBeenCalledWith('Session marquée comme terminée ! 💪');
  });

  it('un déblocage de trophée (checkTrophies renvoie true) : n\'affiche PAS le toast générique par-dessus', () => {
    const { markPlaylistAsCompleted, showToast } = setup({ checkTrophiesResult: true });
    markPlaylistAsCompleted('pl-1');
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('Session marquée'));
  });

  it('fenêtre anti-rebond : une 2e complétion "maintenant" moins de 10s après la dernière est refusée (double-clic supposé)', () => {
    const recent = new Date(Date.now() - 2000).toISOString();
    const { markPlaylistAsCompleted, setSavedPlaylists, showToast } = setup({
      savedPlaylists: [basePlaylist({ completions: [recent] })],
    });
    markPlaylistAsCompleted('pl-1');
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Déjà marquée à l'instant !");
  });

  it('au-delà de 10s depuis la dernière complétion : une vraie 2e séance le même jour est acceptée (pas bloquée)', () => {
    const old = new Date(Date.now() - 15000).toISOString();
    const { markPlaylistAsCompleted, setSavedPlaylists, showToast } = setup({
      savedPlaylists: [basePlaylist({ completions: [old] })],
    });
    markPlaylistAsCompleted('pl-1');
    expect(setSavedPlaylists).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('re-marquée comme faite'));
  });

  it('"Oiseau de Nuit" : une complétion entre 22h et 4h passe hasNightOwl à true', () => {
    const nightDate = new Date();
    nightDate.setHours(23, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(nightDate);

    const { markPlaylistAsCompleted, checkTrophies } = setup();
    markPlaylistAsCompleted('pl-1');
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasNightOwl: true }));

    vi.useRealTimers();
  });

  it('"Le Grimpeur" : une séance en mode Crescendo débloque hasCrescendoCompleted', () => {
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ config: { isCrescendoMode: true } })],
    });
    markPlaylistAsCompleted('pl-1');
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasCrescendoCompleted: true }));
  });

  it('"Pile à l\'Heure" : la complétion tombe EXACTEMENT le jour planifié → hasOnTimeCompletion', () => {
    const today = new Date().toISOString().slice(0, 10);
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ plannedDate: today })],
    });
    markPlaylistAsCompleted('pl-1');
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasOnTimeCompletion: true }));
  });

  it('"Touche-à-Tout" : les 3 types d\'activité classiques complétés → hasAllWorkoutTypes', () => {
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ workoutType: 'Musculation' })],
      userStats: baseUserStats({ completedWorkoutTypes: ['Course à pied', 'Cyclisme'] }),
    });
    markPlaylistAsCompleted('pl-1');
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasAllWorkoutTypes: true }));
  });

  it('"Touche-à-Tout" : le type "Autre" ne compte JAMAIS, même s\'il ne manquait plus qu\'un type', () => {
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ workoutType: 'Autre' })],
      userStats: baseUserStats({ completedWorkoutTypes: ['Course à pied', 'Cyclisme'] }),
    });
    markPlaylistAsCompleted('pl-1');
    // `stats` hérite `completedWorkoutTypes`/`hasAllWorkoutTypes` de
    // `userStats` par spread (voir usePlaylistCompletions.js) — "Autre"
    // ne rentre jamais dans la liste suivie, donc ni l'un ni l'autre ne
    // doit changer par rapport à ce qui existait déjà.
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({
      completedWorkoutTypes: ['Course à pied', 'Cyclisme'],
      hasAllWorkoutTypes: false,
    }));
  });

  it('"100 Bornes au Compteur" : distance cumulée ≥ 100km (avec conversion mi → km si besoin)', () => {
    // avgPace en secondes/mile, distanceUnit 'mi' — vérifie la conversion
    // 1.60934, pas une simple addition brute en miles.
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ totalDuration: 3600, avgPace: 360, distanceUnit: 'mi' })],
      userStats: baseUserStats({ totalDistanceKm: 90 }),
    });
    markPlaylistAsCompleted('pl-1');
    // 3600/360 = 10 mi → 10 * 1.60934 = 16.0934 km, + 90 déjà acquis = 106.09 ≥ 100
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ has100km: true }));
  });

  it('"Sur ta Lancée" : 3 jours calendaires consécutifs avec au moins une complétion chacun', () => {
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };
    const { markPlaylistAsCompleted, checkTrophies } = setup({
      savedPlaylists: [basePlaylist({ completions: [day(2), day(1)] })],
    });
    markPlaylistAsCompleted('pl-1'); // complète le jour 0 → 3 jours d'affilée
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasStreak3: true }));
  });
});

describe('markPlaylistAsCompleted — cas "date choisie" (isoDate fourni)', () => {
  it('une date déjà enregistrée : refuse silencieusement (toast dédié, pas de setSavedPlaylists)', () => {
    const { markPlaylistAsCompleted, setSavedPlaylists, showToast } = setup({
      savedPlaylists: [basePlaylist({ completions: ['2026-08-01'] })],
    });
    markPlaylistAsCompleted('pl-1', '2026-08-01');
    expect(setSavedPlaylists).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Cette date est déjà enregistrée.');
  });

  it('une date choisie n\'est JAMAIS bloquée par la fenêtre anti-rebond, même si elle suit une complétion très récente', () => {
    const recent = new Date().toISOString();
    const { markPlaylistAsCompleted, setSavedPlaylists } = setup({
      savedPlaylists: [basePlaylist({ completions: [recent] })],
    });
    markPlaylistAsCompleted('pl-1', '2026-08-01');
    expect(setSavedPlaylists).toHaveBeenCalled();
  });

  it('une date choisie (YYYY-MM-DD, sans heure) ne peut jamais déclencher "Oiseau de Nuit"', () => {
    const { markPlaylistAsCompleted, checkTrophies } = setup();
    markPlaylistAsCompleted('pl-1', '2026-08-01');
    expect(checkTrophies).toHaveBeenCalledWith(expect.objectContaining({ hasNightOwl: false }));
  });
});

describe('removeCompletionDate', () => {
  it('playlist introuvable : ne fait rien', () => {
    const { removeCompletionDate, setSavedPlaylists } = setup({ savedPlaylists: [] });
    removeCompletionDate('inconnue', '2026-08-01');
    expect(setSavedPlaylists).not.toHaveBeenCalled();
  });

  it('retire la date de `completions` ET les données réelles rattachées (`actualDataByDate`)', () => {
    const { removeCompletionDate, setSavedPlaylists, showToast } = setup({
      savedPlaylists: [basePlaylist({
        completions: ['2026-08-01', '2026-08-02'],
        actualDataByDate: { '2026-08-01': [{ cadenceReelle: 90 }] },
      })],
    });
    removeCompletionDate('pl-1', '2026-08-01');

    const updated = setSavedPlaylists.mock.calls[0][0];
    expect(updated[0].completions).toEqual(['2026-08-02']);
    expect(updated[0].actualDataByDate).toEqual({});
    expect(showToast).not.toHaveBeenCalled();
  });

  it('retirer la DERNIÈRE complétion restante : avertit que la playlist repasse "À planifier"', () => {
    const { removeCompletionDate, showToast } = setup({
      savedPlaylists: [basePlaylist({ completions: ['2026-08-01'] })],
    });
    removeCompletionDate('pl-1', '2026-08-01');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('repasse dans'), 'error');
  });
});

describe('editCompletionDate', () => {
  it('newIso vide ou identique à oldIso : ne fait rien', () => {
    const { editCompletionDate, setSavedPlaylists } = setup();
    editCompletionDate('pl-1', '2026-08-01', '');
    editCompletionDate('pl-1', '2026-08-01', '2026-08-01');
    expect(setSavedPlaylists).not.toHaveBeenCalled();
  });

  it('remplace oldIso par newIso dans `completions`, trié', () => {
    const { editCompletionDate, setSavedPlaylists } = setup({
      savedPlaylists: [basePlaylist({ completions: ['2026-08-01', '2026-08-05'] })],
    });
    editCompletionDate('pl-1', '2026-08-05', '2026-08-03');

    const updated = setSavedPlaylists.mock.calls[0][0];
    expect(updated[0].completions).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('newIso déjà enregistrée : refuse (toast dédié), ne modifie rien', () => {
    const { editCompletionDate, setSavedPlaylists, showToast } = setup({
      savedPlaylists: [basePlaylist({ completions: ['2026-08-01', '2026-08-05'] })],
    });
    editCompletionDate('pl-1', '2026-08-01', '2026-08-05');

    const updated = setSavedPlaylists.mock.calls[0][0];
    expect(updated[0].completions).toEqual(['2026-08-01', '2026-08-05']);
    expect(showToast).toHaveBeenCalledWith('Cette date est déjà enregistrée.');
  });

  it('déplace les données réelles rattachées à l\'ancienne date vers la nouvelle, sans les perdre', () => {
    const { editCompletionDate, setSavedPlaylists } = setup({
      savedPlaylists: [basePlaylist({
        completions: ['2026-08-01'],
        actualDataByDate: { '2026-08-01': [{ cadenceReelle: 88 }] },
      })],
    });
    editCompletionDate('pl-1', '2026-08-01', '2026-08-03');

    const updated = setSavedPlaylists.mock.calls[0][0];
    expect(updated[0].actualDataByDate).toEqual({ '2026-08-03': [{ cadenceReelle: 88 }] });
  });
});
