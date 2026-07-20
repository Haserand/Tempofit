/**
 * playlistShareCode.js — Encode/décode une playlist dans un simple paramètre
 * d'URL (`?import=...`), pour un partage "point-à-point" réellement
 * importable — voir la discussion qui a mené à ce chantier : une alternative
 * plus légère qu'un feed communautaire complet (pas de table Supabase
 * publique, pas de modération, pas de vote — juste un lien qui, une fois
 * ouvert, propose d'ajouter CETTE playlist précise à ses propres séances).
 *
 * Fonctionne SANS Supabase configuré (contrairement aux comptes/Spotify/
 * Deezer) — tout tient dans l'URL elle-même, aucune donnée envoyée à un
 * serveur. Payload volontairement réduit (clés courtes pour les titres,
 * champs strictement nécessaires à reconstruire une playlist jouable) pour
 * garder l'URL raisonnable — pas de pochettes ni d'historique personnel
 * (completions, actualDataByDate) : une playlist importée démarre TOUJOURS
 * comme neuve, jamais avec l'historique de la personne qui l'a partagée.
 *
 * RETOUR DIRECT (audit global après plusieurs chantiers, "les extraits
 * peuvent pas juste se mettre à jour à chaque clic ?") — l'extrait audio
 * (`preview`) n'est plus encodé du tout dans le lien : c'est une URL Deezer,
 * donc soumise à la même expiration déjà documentée pour les playlists
 * ensemencées (voir data/curatedSessions.js) — un lien ouvert des semaines
 * après son partage pouvait pointer vers un extrait mort. `App.jsx`
 * (`importSharedPlaylist`) force maintenant `preview: null` à l'import ; la
 * résolution se fait à la demande au 1er clic, exactement comme pour les
 * playlists ensemencées (voir resolveAndTogglePreview,
 * PlaylistDetailView.jsx) — un champ en moins à encoder, un lien plus court.
 */

// Base64 "URL-safe" (- et _ au lieu de + et /, padding retiré) — évite
// d'avoir à percent-encoder le paramètre d'URL en plus (btoa seul peut
// produire des caractères qui cassent une URL telle quelle).
const encodePlaylistForSharing = (playlist) => {
  try {
    const payload = {
      name: playlist.name,
      workoutType: playlist.workoutType,
      coverIcon: playlist.coverIcon || '🎧',
      avgPace: playlist.avgPace || 330,
      targetMode: playlist.targetMode || 'time',
      distanceUnit: playlist.distanceUnit || 'km',
      tolerance: playlist.tolerance || 10,
      crossfade: playlist.crossfade || 0,
      // Clés courtes ICI seulement (répétées une fois par titre, contrairement
      // aux clés ci-dessus qui n'apparaissent qu'une fois) — c'est ce qui pèse
      // le plus sur la longueur finale de l'URL.
      tracks: (playlist.tracks || []).map(t => ({
        ti: t.title, ar: t.artist, bp: t.bpm, du: t.duration,
        ge: t.genre || null, id: t.youtubeId || null,
      })),
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    // Échec silencieux ici (playlist trop grosse, caractère imprévu...) —
    // l'appelant (useShare.js) retombe sur l'ancien lien simple (page
    // d'accueil, pas d'import) plutôt que de faire planter le partage entier.
    return null;
  }
};

const decodePlaylistFromSharing = (code) => {
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);
    // Garde-fou minimal : un payload sans titre exploitable n'est pas une
    // playlist importable (lien tronqué par une appli de messagerie,
    // corrompu au copier-coller, etc.) — mieux vaut refuser proprement que
    // de laisser passer une playlist vide.
    if (!payload || !Array.isArray(payload.tracks) || payload.tracks.length === 0) return null;
    if (payload.tracks.some(t => !t.ti || !t.ar || !t.bp || !t.du)) return null;
    return payload;
  } catch (e) {
    return null;
  }
};

export { encodePlaylistForSharing, decodePlaylistFromSharing };
