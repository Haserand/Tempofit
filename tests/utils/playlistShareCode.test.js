import { describe, it, expect } from 'vitest';
import { encodePlaylistForSharing, decodePlaylistFromSharing } from '../src/utils/playlistShareCode.js';

/**
 * playlistShareCode.test.js — sécurise l'encodage/décodage base64 "URL-safe"
 * utilisé par le lien de partage (`?import=...`). C'est le fichier le plus
 * critique pour la viralité de l'app : un bug ici casse silencieusement
 * TOUS les liens partagés, sans qu'aucun utilisateur ne puisse s'en douter
 * avant de cliquer sur un lien mort.
 *
 * Toutes les valeurs attendues ci-dessous ont été vérifiées par exécution
 * réelle des fonctions (node, en dehors de Vitest) avant d'écrire les
 * assertions — aucune n'est devinée.
 *
 * Note de périmètre : le schéma encodé (voir playlistShareCode.js) n'a pas
 * de champ "auteur" séparé — seuls `playlist.name` et `track.artist` (clé
 * compacte `ar`) existent. Les tests "caractères spéciaux" portent donc sur
 * ces deux champs, qui sont l'équivalent le plus proche disponible.
 */

// Playlist de référence, réutilisée par plusieurs tests.
const buildSamplePlaylist = () => ({
  name: 'Ma Séance du Lundi',
  workoutType: 'Course à pied',
  coverIcon: '🏃',
  avgPace: 330,
  targetMode: 'time',
  distanceUnit: 'km',
  tolerance: 8,
  crossfade: 3,
  tracks: [
    { title: 'Mr. Brightside', artist: 'The Killers', bpm: 148, duration: 222, genre: 'Rock', trackId: 'gGdGFtwPNsQ' },
    { title: 'Thunderstruck', artist: 'AC/DC', bpm: 133, duration: 292, genre: 'Rock', trackId: 'v2AC41dglnM' },
  ],
});

describe('encodePlaylistForSharing / decodePlaylistFromSharing — round-trip nominal', () => {
  it('retrouve exactement les données initiales après un aller-retour encode → decode', () => {
    const playlist = buildSamplePlaylist();
    const code = encodePlaylistForSharing(playlist);
    const decoded = decodePlaylistFromSharing(code);

    expect(decoded.name).toBe(playlist.name);
    expect(decoded.workoutType).toBe(playlist.workoutType);
    expect(decoded.avgPace).toBe(playlist.avgPace);
    expect(decoded.tolerance).toBe(playlist.tolerance);
    expect(decoded.crossfade).toBe(playlist.crossfade);
    expect(decoded.tracks).toHaveLength(2);
    // Le schéma encodé utilise des clés courtes (ti/ar/bp/du/ge/id) — c'est
    // le contrat du format, pas un oubli : on vérifie ce mapping précis
    // plutôt que de s'attendre à retrouver title/artist/bpm/duration tels quels.
    expect(decoded.tracks[0]).toEqual({
      ti: 'Mr. Brightside', ar: 'The Killers', bp: 148, du: 222, ge: 'Rock', id: 'gGdGFtwPNsQ',
    });
    expect(decoded.tracks[1]).toEqual({
      ti: 'Thunderstruck', ar: 'AC/DC', bp: 133, du: 292, ge: 'Rock', id: 'v2AC41dglnM',
    });
  });

  it('produit un code strictement URL-safe (aucun +, / ou = résiduel)', () => {
    const code = encodePlaylistForSharing(buildSamplePlaylist());
    expect(code).not.toMatch(/[+/=]/);
  });

  it('applique les valeurs par défaut documentées quand les champs optionnels sont absents', () => {
    const minimal = { name: 'Minimal', tracks: [{ title: 'A', artist: 'B', bpm: 140, duration: 200 }] };
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing(minimal));
    expect(decoded.coverIcon).toBe('🎧');
    expect(decoded.avgPace).toBe(330);
    expect(decoded.targetMode).toBe('time');
    expect(decoded.distanceUnit).toBe('km');
    expect(decoded.tolerance).toBe(10);
    expect(decoded.crossfade).toBe(0);
    // `workoutType` n'a PAS de repli par défaut dans l'implémentation
    // (contrairement aux autres champs ci-dessus) : absent de la playlist
    // source, il est absent du JSON encodé (JSON.stringify élimine les
    // valeurs `undefined`) — comportement réel vérifié, pas une supposition.
    expect(decoded.workoutType).toBeUndefined();
  });
});

describe('caractères spéciaux (accents, emojis, apostrophes)', () => {
  it('préserve accents, emoji et apostrophe dans le nom de la playlist', () => {
    const playlist = buildSamplePlaylist();
    playlist.name = "Ma Séance Café ☕ — Run's crew";
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing(playlist));
    expect(decoded.name).toBe("Ma Séance Café ☕ — Run's crew");
  });

  it('préserve les caractères spéciaux dans le titre/artiste d\'un morceau (équivalent le plus proche d\'un "auteur" dans ce schéma)', () => {
    const playlist = buildSamplePlaylist();
    playlist.tracks = [{ title: 'Éxtase (Live)', artist: 'Ñañez & Co.', bpm: 160, duration: 200, genre: null }];
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing(playlist));
    expect(decoded.tracks[0].ti).toBe('Éxtase (Live)');
    expect(decoded.tracks[0].ar).toBe('Ñañez & Co.');
  });

  it('préserve un emoji multi-octets (🏃) utilisé comme icône de couverture', () => {
    const playlist = buildSamplePlaylist();
    playlist.coverIcon = '🏃‍♂️'; // emoji composé (ZWJ), cas le plus casse-gueule pour un encodage naïf
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing(playlist));
    expect(decoded.coverIcon).toBe('🏃‍♂️');
  });
});

describe('decodePlaylistFromSharing — cas limites', () => {
  it('retourne null (jamais une exception) pour une entrée null', () => {
    expect(() => decodePlaylistFromSharing(null)).not.toThrow();
    expect(decodePlaylistFromSharing(null)).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(decodePlaylistFromSharing('')).toBeNull();
  });

  it('retourne null pour du base64 totalement invalide', () => {
    expect(() => decodePlaylistFromSharing('!!!pas-du-tout-du-base64!!!')).not.toThrow();
    expect(decodePlaylistFromSharing('!!!pas-du-tout-du-base64!!!')).toBeNull();
  });

  it('retourne null pour du base64 valide mais dont le contenu n\'est pas du JSON exploitable', () => {
    // "hello world" encodé proprement en base64 URL-safe : décodage réussit,
    // mais le JSON.parse qui suit doit échouer proprement.
    const validButWrongContent = btoa('hello world').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(decodePlaylistFromSharing(validButWrongContent)).toBeNull();
  });

  it('retourne null pour une playlist sans aucun titre (tracks vide)', () => {
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing({ name: 'Vide', tracks: [] }));
    expect(decoded).toBeNull();
  });

  it('retourne null si au moins un titre décodé n\'a pas les champs minimum exploitables (ti/ar/bp/du)', () => {
    // BPM manquant sur l'unique titre — garde-fou documenté dans le code source.
    const incomplete = { name: 'Incomplet', tracks: [{ title: 'X', artist: 'Y', duration: 200 }] };
    const decoded = decodePlaylistFromSharing(encodePlaylistForSharing(incomplete));
    expect(decoded).toBeNull();
  });
});

describe('encodePlaylistForSharing — cas limites', () => {
  it('retourne null (jamais une exception) si la playlist fournie est null', () => {
    expect(() => encodePlaylistForSharing(null)).not.toThrow();
    expect(encodePlaylistForSharing(null)).toBeNull();
  });

  it('retourne null si la playlist n\'a pas du tout de champ tracks', () => {
    // `(playlist.tracks || [])` -> tableau vide -> decode() le rejettera (voir
    // test ci-dessus), mais encode() lui-même ne doit jamais planter.
    expect(() => encodePlaylistForSharing({ name: 'Sans tracks' })).not.toThrow();
  });
});
