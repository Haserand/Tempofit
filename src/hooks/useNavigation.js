import { useEffect } from 'react';
import { buildCoverUrl } from '../utils/coverArt';
import { recalculateTimeline } from '../engine/musicEngine';
import { useGeneratorContext } from '../contexts/GeneratorContext';
import { useModalContext } from '../contexts/ModalContext';

/**
 * useNavigation — regroupe le changement de vue global (`changeView`), la
 * détection de playlist non sauvegardée qui le protège (`hasUnsavedPlaylist`, y
 * compris l'avertissement natif du navigateur à la fermeture d'onglet/F5), et
 * l'ouverture d'un modèle du catalogue (`openCuratedPlaylist`, qui termine par un
 * `changeView('playlist')`).
 *
 * Extrait d'App.jsx (25/07, chantier "réduire le God Component") : `setWizardStep`
 * vient de `useGeneratorContext()` (appelé ici comme dans useRoutineActions.js —
 * légitime pour un Contexte, plusieurs points de lecture du même Provider).
 * `openModal` (ModalContext, chantier "centraliser les modales", même jour) suit
 * le même principe : `changeView` déclenche la modale "playlist non sauvegardée"
 * via `openModal('PENDING_NAVIGATION', newView)` plutôt que via un setter dédié
 * reçu en paramètre — un seul appel `useModalContext()` ici, pas de state
 * dupliqué.
 *
 * VOLONTAIREMENT PAS déplacée ici : `resolvePendingNavigation`, qui reste dans
 * App.jsx. Elle a besoin de `handleSavePlaylist` (produit par
 * `usePlaylistLibrary()`), qui a lui-même besoin de `openCuratedPlaylist` produit
 * ICI — un hook devant fournir une valeur nécessaire à l'appel d'un autre hook,
 * qui produirait à son tour une valeur nécessaire à CE hook, est un cycle : les
 * arguments d'un appel de hook sont évalués immédiatement, contrairement à une
 * simple référence dans le corps d'une fonction (closure), qui elle peut
 * pointer vers une valeur pas encore assignée au moment de la lecture du fichier,
 * du moment qu'elle l'est avant le premier appel réel. `resolvePendingNavigation`
 * est courte (accepts `handleSavePlaylist` en paramètre) — pas la peine de casser
 * ce cycle pour si peu.
 */
export function useNavigation(
  view, setView, setIsMobileMenuOpen,
  currentPlaylist, setCurrentPlaylist, savedPlaylists,
  isNaughtyMode,
) {
  const { setWizardStep } = useGeneratorContext();
  const { openModal } = useModalContext();

  // Playlist tout juste générée mais jamais sauvegardée : la quitter (navigation
  // interne OU fermeture d'onglet/F5) la perdrait définitivement (pas de brouillon
  // persistant, voir createPlaylistData). Ignore les playlists vides (génération
  // ratée, rien de réel à perdre). Calculée une fois ici et réutilisée par
  // `changeView` (modale interne) et par le listener `beforeunload` ci-dessous
  // (avertissement natif du navigateur), pour ne jamais avoir 2 définitions de
  // "playlist non sauvegardée" qui divergent.
  const hasUnsavedPlaylist = view === 'playlist' && currentPlaylist
    && !savedPlaylists.find(p => p.id === currentPlaylist.id)
    && currentPlaylist.tracks && currentPlaylist.tracks.length > 0;

  const changeView = (newView) => {
    // Ne se déclenche que si on QUITTE réellement la vue détail (newView !== 'playlist').
    if (hasUnsavedPlaylist && newView !== 'playlist') {
      openModal('PENDING_NAVIGATION', newView);
      return;
    }
    setView(newView);
    setIsMobileMenuOpen(false);
    // Refactor UX/UI (28/07, "Réglages à onglets") : le reset de
    // `showAthleticProfile` qui vivait ici a été retiré — Profil Athlétique
    // n'est plus une sous-page mutuellement exclusive de 'generator' (voir
    // GeneratorView.jsx), il vit désormais comme onglet dans SettingsView.jsx
    // ('settings'), donc ce bug de retour n'a plus lieu d'être.
    if (newView === 'generator') { setWizardStep(1); }
  };

  /**
   * PIVOT PRODUIT (retour direct) — remplace `applyTemplateToGenerator`
   * (ancienne version, pré-remplissait le formulaire du générateur). Un
   * modèle de séance ensemencé est maintenant une VRAIE playlist figée (voir
   * data/curatedSessions.js, `tracks`) : injectée directement dans
   * `currentPlaylist` et ouverte sur PlaylistDetailView, exactement comme
   * une playlist fraîchement générée ou importée via lien partagé (voir
   * `importSharedPlaylist`, même fichier, même principe de reconstruction
   * via `recalculateTimeline` plutôt que deviner `startTimeStr`/
   * `totalDuration` à la main). Pas encore dans `savedPlaylists` — comme
   * pour une génération classique, c'est au clic sur "Sauvegarder"
   * (PlaylistDetailView, déjà existant) que ça devient permanent.
   */
  // `extraFields` (Feature Sociale "Cold Start", 02/08) — optionnel, `{}`
  // par défaut : AUCUN appelant existant n'a besoin d'y penser (ouvrir un
  // template depuis Découvrir normalement reste identique bit à bit).
  // Ajouté pour le profil vitrine `@tempofit_officiel`
  // (officialVitrineProfile.js) : ouvrir un template depuis CETTE vitrine
  // doit produire une playlist en mode lecture seule (`isReadOnly: true`,
  // voir PlaylistDetailContext.jsx) — plutôt que dupliquer toute la
  // construction ci-dessous dans App.jsx pour ce seul cas, fusionné ici,
  // juste avant `recalculateTimeline` (qui préserve tous les champs du
  // spread, voir musicEngine.js — vérifié avant de s'appuyer dessus).
  const openCuratedPlaylist = (template, extraFields = {}) => {
    const avgBpm = Math.round(template.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / template.tracks.length) || 120;
    const genres = Array.from(new Set(template.tracks.map(t => t.genre).filter(Boolean)));

    const rawPlaylist = {
      id: `pl-curated-${template.id}-${Date.now()}`,
      name: template.title,
      // BUG ÉVITÉ (trouvé en vérifiant le pare-feu Mode Intime signalé sur
      // Mes Séances/Découvrir) : `workoutType` était TOUJOURS
      // `template.workoutType` tel quel, `isNaughty` TOUJOURS `false` — une
      // playlist ouverte depuis un template du catalogue Intime (voir
      // NAUGHTY_DISCOVER_TEMPLATES, DiscoverView.jsx) se serait donc
      // retrouvée classée comme standard dans Mes Séances (le filtre par
      // mode, lui correct, l'aurait alors fait disparaître de la vue Intime
      // qui vient de la générer — invisible immédiatement après son propre
      // clic). `workoutType` suit maintenant EXACTEMENT la même règle que
      // toute vraie génération (musicEngine.js, `finalWorkoutName`) : toujours
      // "Ambiance" en Mode Intime, l'activité réelle du template restant
      // disponible dans `config.workoutName` ci-dessous.
      workoutType: isNaughtyMode ? 'Ambiance' : template.workoutType,
      avgPace: 330, targetMode: 'time', distanceUnit: 'km',
      tolerance: 10, crossfade: 2,
      // RETOUR DIRECT ("pas de bruit, ne pas appeler ça un id YouTube si ça
      // n'en est pas un") — curatedSessions.js n'a plus aucun id de service
      // par titre (voir ce fichier). `trackId` (le nom générique déjà
      // utilisé PARTOUT ailleurs dans l'app pour identifier un titre, quelle
      // que soit sa source réelle — favoris, mini-lecteur, graphiques) est
      // posé ICI avec un préfixe `curated-` clairement interne, PAS un faux
      // id Deezer/Spotify — remplacé par le vrai `deezer-{id}` dès la 1re
      // résolution réussie (voir resolveAndTogglePreview,
      // PlaylistDetailView.jsx). `preview: null` : jamais stocké en dur,
      // résolu à la demande au clic — voir la même fonction.
      // BUG ÉVITÉ (trouvé en revérifiant avant de valider) : `id` (par
      // OCCURRENCE dans la liste, distinct de `trackId` qui identifie la
      // CHANSON elle-même — voir musicEngine.js, createPlaylistData) sert de
      // clé React ET à l'enchaînement automatique des extraits
      // (getNextTrackForAutoAdvance, PlaylistDetailView.jsx) : sans lui ici,
      // ces deux mécanismes se seraient cassés silencieusement sur une
      // playlist ensemencée (clés React dupliquées, enchaînement qui
      // retombe toujours sur le même titre).
      tracks: template.tracks.map((t, i) => ({ ...t, id: `curated-${template.id}-${i}`, trackId: `curated-${template.id}-${i}`, preview: null })),
      isNaughty: isNaughtyMode, fallbackTrackCount: 0,
      // RETOUR DIRECT ("la pochette générée disparaît sur la fiche détail")
      // — `coverUrl` n'est stocké NULLE PART dans data/curatedSessions.js
      // (volontairement, voir ce fichier) : recalculé ici avec la MÊME
      // fonction que TemplateCard.jsx (utils/coverArt.js) — déterministe par
      // le titre, donc rigoureusement identique à la pochette déjà vue dans
      // la grille de Découverte, sans avoir besoin de la faire transiter par
      // un state/des props séparés. `coverIcon` (l'émoji) reste posé en
      // repli, au cas où `coverUrl` échouerait à charger un jour (voir
      // PlaylistDetailView.jsx pour ce repli).
      coverUrl: buildCoverUrl(template.title),
      coverIcon: '🎧', createdAt: new Date().toLocaleDateString(),
      status: 'pending', actualDataByDate: {},
      config: { workoutName: template.workoutType, targetMode: 'time', bpm: avgBpm, selectedGenres: genres.length ? genres : ['Autre'] },
      // Trace de l'origine (retour direct : "je devrais revenir à la
      // playlist telle que j'ai cliqué dessus au départ" après un
      // renommage/édition suivi d'un retrait de "Mes Séances") — permet à
      // `removeSavedPlaylist` (voir usePlaylistLibrary.js) de retrouver le
      // template BRUT et pristine dans data/curatedSessions.js, plutôt que de
      // laisser affiché un `currentPlaylist` qui garderait les modifications
      // d'une sauvegarde abandonnée. Un id STABLE (`template.id`, jamais
      // régénéré à chaque ouverture, contrairement à `id` ci-dessus qui
      // embarque `Date.now()`) — indispensable pour retrouver le bon
      // template après coup, pas juste au moment de l'ouverture.
      sourceTemplateId: template.id,
      ...extraFields,
    };

    const finalPlaylist = recalculateTimeline(rawPlaylist);
    setCurrentPlaylist(finalPlaylist);
    changeView('playlist');
  };

  // Pendant à `changeView` : avertit aussi à la fermeture d'onglet / F5, pas
  // seulement à la navigation interne dans l'appli (limite explicitement
  // signalée lors de la session précédente). Les navigateurs modernes
  // n'affichent plus le texte personnalisé de `returnValue` (message générique
  // imposé par le navigateur pour éviter les abus) — on le renseigne quand
  // même pour les navigateurs plus anciens qui le respectent encore.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedPlaylist) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedPlaylist]);

  return { hasUnsavedPlaylist, changeView, openCuratedPlaylist };
}
