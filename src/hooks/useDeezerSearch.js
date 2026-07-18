import { WEAK_DEEZER_KEYWORD_GENRES } from '../musicCatalog';
import { dedupeAppend, fetchWorldSearchResults, fetchBpmSearchResults } from '../searchEngine';
import { SEARCH_LOADING_MESSAGES } from './useTrackSearch';

/**
 * useDeezerSearch — le "moteur de recherche Deezer" pour la modale de
 * recherche manuelle (texte libre ET par BPM cible). Extrait de App.jsx.
 *
 * ⚠️ RETOUR DIRECT ("prends du recul, regarde si ça vaut le coup") — une
 * session précédente avait laissé une note jugeant TOUT ce bloc "trop
 * risqué" à extraire ("énormes, fortement imbriquées avec favoris/
 * génération/playlist en cours"). En le relisant vraiment plutôt que de
 * reprendre cette note telle quelle : c'était vrai pour UNE fonction du
 * bloc (`renderSearchResultRow`, qui produit du JSX et touche favoris/
 * playlist en cours/lecture audio), pas pour les 4 autres — celles-ci ne
 * dépendent QUE de l'état de recherche (voir useTrackSearch.js),
 * `showToast`, `isNaughtyMode` et les fonctions déjà pures de
 * searchEngine.js. Extraites ici. `renderSearchResultRow` va directement
 * dans SearchModal.jsx (déjà en .jsx — la sortir dans un hook `.js` aurait
 * recréé le bug Vercel déjà rencontré : Vite ne parse pas le JSX dans un
 * fichier `.js`), pas dans ce fichier.
 *
 * `search` = l'objet renvoyé par `useTrackSearch()` (état pur), passé tel
 * quel plutôt que déstructuré en 15 paramètres séparés — les deux hooks
 * restent étroitement liés (celui-ci n'a de sens qu'avec cet état-là), donc
 * autant le rendre explicite plutôt que de dupliquer la liste des champs.
 */
export function useDeezerSearch(search, showToast, isNaughtyMode) {
  const {
    searchQuery, searchResultsOffset, searchActiveArtistName,
    setSearchActiveArtistName, setWorldSearchResults, setWorldSearchOtherResults,
    setResultsContextLabel, setNoUsableResultsHint, setSearchResultsOffset,
    setSearchHasMoreResults, setIsWorldSearching, setIsLoadingMoreResults,
    setSearchLoadingMessage, setIsSearchModalOpen, setSearchQuery, setIsBpmSearchMode,
    setEditingBpmId, setBpmSearchParams,
  } = search;

  const searchWorldMusicApi = async (reset = true) => {
    if (!searchQuery.trim()) return;
    if (reset) {
      setIsWorldSearching(true);
      setSearchLoadingMessage(SEARCH_LOADING_MESSAGES[Math.floor(Math.random() * SEARCH_LOADING_MESSAGES.length)]);
      setWorldSearchResults([]);
      setWorldSearchOtherResults([]);
      setResultsContextLabel(null);
      setNoUsableResultsHint(false);
      setSearchHasMoreResults(false);
    } else {
      setIsLoadingMoreResults(true);
    }

    try {
      const result = await fetchWorldSearchResults(searchQuery, {
        reset,
        offset: searchResultsOffset,
        activeArtistName: searchActiveArtistName,
        isNaughtyMode,
      });

      setSearchActiveArtistName(result.activeArtistName);

      if (result.noResults) {
        setNoUsableResultsHint(true);
      } else {
        setWorldSearchResults(prev => dedupeAppend(prev, result.matched, reset));
        setWorldSearchOtherResults(prev => dedupeAppend(prev, result.other, reset));
        if (reset) setResultsContextLabel(result.contextLabel);
        setSearchResultsOffset(result.newOffset);
        setSearchHasMoreResults(result.hasMore);
        if (reset && result.emptyAfterFormatting) setNoUsableResultsHint(true); // titres trouvés mais aucun n'a de BPM connu
      }
    } catch (e) {
      // Erreur réseau réelle (proxy CORS injoignable, hors-ligne...) — loggée en
      // console (pas de tag DEBUG, permanent) pour ne pas retomber sur "Aucun
      // résultat." sans aucune trace exploitable si ça se reproduit un jour.
      console.error('[TempoFit] Erreur dans searchWorldMusicApi :', e);
      showToast("Erreur réseau lors de la recherche.", 'error');
    }
    setIsWorldSearching(false);
    setIsLoadingMoreResults(false);
  };

  // Corrige le BPM d'un titre à la main (voir editingBpmId) — met à jour les 2
  // listes possibles (résultats visibles ET réserve cachée, un titre pouvant
  // être dans l'une ou l'autre) puisqu'on ne sait pas laquelle le contient sans
  // le revérifier. `_bpmSource: 'manual'` retire le "~" (l'utilisateur devient
  // lui-même la source la plus fiable qui soit sur SON propre correctif).
  const commitBpmEdit = (track, rawValue) => {
    setEditingBpmId(null);
    const parsed = parseInt(rawValue, 10);
    if (!parsed || parsed <= 0 || parsed === track.bpm) return; // valeur invalide ou inchangée : rien à faire
    const updateList = (list) => list.map(t => t.youtubeId === track.youtubeId ? { ...t, bpm: parsed, _bpmSource: 'manual' } : t);
    setWorldSearchResults(prev => updateList(prev));
    setWorldSearchOtherResults(prev => updateList(prev));
    showToast(`BPM corrigé : ${parsed}`);
  };

  // Ferme la modale de recherche et réinitialise tout son état — centralisé ici
  // (au lieu d'être dupliqué sur le clic du fond et sur le bouton X) pour que
  // l'ajout de nouvel état (searchResultsOffset, searchHasMoreResults,
  // searchActiveArtistName, worldSearchOtherResults) n'oublie aucun des 2 endroits.
  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
    setIsBpmSearchMode(false);
    setWorldSearchResults([]);
    setWorldSearchOtherResults([]);
    setResultsContextLabel(null);
    setNoUsableResultsHint(false);
    setSearchResultsOffset(0);
    setSearchHasMoreResults(false);
    setSearchActiveArtistName(null);
    setEditingBpmId(null); // évite qu'un champ d'édition BPM reste "ouvert" en mémoire après fermeture
  };

  /**
   * Recherche des titres dont le BPM tombe pile dans la fourchette [targetBpm-tolerance,
   * targetBpm+tolerance], en tenant compte des genres fournis. Utilise le filtre avancé
   * natif de Deezer `bpm_min:`/`bpm_max:` (non documenté officiellement mais confirmé
   * fonctionnel), combiné à un mot-clé de genre en texte libre. Une recherche est lancée
   * par genre (Deezer ne supporte pas de "OU" entre plusieurs genres dans une seule
   * requête), puis les résultats sont fusionnés et dédupliqués.
   *
   * Paramètres explicites (plutôt que de lire directement le state du wizard) pour que
   * cette fonction soit réutilisable depuis plusieurs endroits de l'app : le générateur
   * (étape 4) ET la page Cœur & Favoris, qui ont chacun leurs propres réglages BPM/genres.
   *
   * Calcul déplacé dans fetchBpmSearchResults (searchEngine.js) — cette fonction ne fait
   * plus que l'orchestration React (spinners + application du résultat), comportement
   * inchangé par rapport à l'original.
   */
  const searchTracksByBpm = async (targetBpm, tolerance, genres) => {
    setBpmSearchParams({ bpm: targetBpm, tolerance, genres: genres || [] });
    setIsWorldSearching(true);
    // Même logique que le bandeau "Génération en cours" (voir isGeneratingSlowGenre,
    // executeGeneration, App.jsx) : message dédié quand un genre au mot-clé Deezer fragile
    // (K-pop, J-pop & C-pop, Bandes originales) est demandé, ici plutôt que dans
    // un avertissement statique avant le clic — partagé par le wizard ("Explorer
    // les titres à X BPM") ET la page Favoris ("Chercher des titres à X BPM"),
    // qui passent tous les deux par cette même fonction.
    setSearchLoadingMessage(
      (genres || []).some(g => WEAK_DEEZER_KEYWORD_GENRES.includes(g))
        ? "Recherche plus approfondie pour ce genre..."
        : SEARCH_LOADING_MESSAGES[Math.floor(Math.random() * SEARCH_LOADING_MESSAGES.length)]
    );
    setWorldSearchResults([]);
    setResultsContextLabel(`${targetBpm} BPM ± ${tolerance}`);
    setNoUsableResultsHint(false);
    try {
      // RETOUR DIRECT ("affichage progressif plutôt qu'attendre la fin") —
      // `onProgress` est appelé à chaque lot résolu (voir fetchBpmSearchResults,
      // searchEngine.js), avec le résultat COMPLET déjà retrié jusque-là — pas
      // juste le dernier lot. Permet de voir les premiers titres apparaître
      // rapidement plutôt que d'attendre la recherche exhaustive en entier.
      const { results } = await fetchBpmSearchResults(targetBpm, tolerance, genres, (partialResults) => {
        setWorldSearchResults(partialResults);
      });
      setWorldSearchResults(results);
      if (results.length === 0) setNoUsableResultsHint(true);
    } catch (e) {
      showToast("Erreur réseau lors de la recherche.", 'error');
    }
    setIsWorldSearching(false);
  };

  return { searchWorldMusicApi, commitBpmEdit, closeSearchModal, searchTracksByBpm };
}
