import { createContext, useContext, useState, useMemo } from 'react';

/**
 * ShareImageContext — état du Bilan Visuel de Séance partagé entre
 * `PlaylistDetailView.jsx` (qui le GÉNÈRE, voir `startBackgroundImageGeneration`)
 * et `ShareModal.jsx` (qui l'AFFICHE en aperçu et le laisse retirer du
 * partage). Chantier "Découpage App.jsx" (repris le 20/08) — 2e des 3
 * clusters identifiés le 20/08, extrait le 21/08.
 *
 * ⚠️ VÉRIFIÉ AVANT D'EXTRAIRE (20/08) : contrairement au cluster StatsView
 * (un simple oubli, jamais consommé qu'à un seul endroit), celui-ci est
 * GÉNUINEMENT partagé entre 2 composants distincts — d'où un vrai Contexte
 * dédié plutôt qu'une simple redescente de `useState` dans l'un des deux.
 *
 * `summaryImageStatus`/`summaryImageFile`/`summaryImagePreviewUrl`/
 * `includeSummaryImage` vivaient auparavant dans `AppContent` (App.jsx),
 * prop-drillés sur 2 niveaux jusqu'à `PlaylistDetailViewInner` (à travers
 * `PlaylistDetailView` → `PlaylistDetailViewInner`) et 1 niveau jusqu'à
 * `ShareModal` — same comportement, juste plus de props à faire transiter à
 * chaque appel intermédiaire. Toute la LOGIQUE (génération en arrière-plan,
 * protection contre un changement de playlist en cours de route via
 * `currentPlaylistIdRef`, reset au changement de playlist) reste entièrement
 * dans `PlaylistDetailView.jsx` — ce fichier-ci ne fait qu'exposer le state
 * lui-même, comme `ModalContext.jsx` le fait pour `activeModal`/`modalData`.
 *
 * `summaryImage*`/`includeSummaryImage` restent `undefined` pour un partage
 * de trophée SI on les lisait en props directement (voir l'ancienne
 * docstring de ShareModal.jsx) — avec ce Contexte, ils sont maintenant
 * TOUJOURS définis (valeurs par défaut réelles, jamais `undefined`), mais
 * ça ne change rien au comportement : `ShareModal.jsx` garde son garde-fou
 * `shareData.type === 'playlist'` avant de les utiliser, qui reste vrai
 * indépendamment de la valeur de `summaryImageStatus` pour un partage de
 * trophée.
 */
const ShareImageContext = createContext(null);

export function ShareImageProvider({ children }) {
  const [summaryImageStatus, setSummaryImageStatus] = useState('idle'); // idle | loading | ready | error
  const [summaryImageFile, setSummaryImageFile] = useState(null);
  const [summaryImagePreviewUrl, setSummaryImagePreviewUrl] = useState(null);
  const [includeSummaryImage, setIncludeSummaryImage] = useState(true);

  // `useMemo` (même convention que ModalContext.jsx) — les 4 setters issus
  // de `useState` sont déjà référentiellement stables d'un rendu à l'autre
  // (garanti par React), donc ce memo ne recalcule un nouvel objet `value`
  // QUE quand l'une des 4 valeurs elles-mêmes change réellement, jamais à
  // chaque rendu d'un composant qui monte `<ShareImageProvider>` au-dessus
  // de lui sans rapport avec le bilan visuel.
  const value = useMemo(
    () => ({
      summaryImageStatus, setSummaryImageStatus,
      summaryImageFile, setSummaryImageFile,
      summaryImagePreviewUrl, setSummaryImagePreviewUrl,
      includeSummaryImage, setIncludeSummaryImage,
    }),
    [summaryImageStatus, summaryImageFile, summaryImagePreviewUrl, includeSummaryImage],
  );

  return (
    <ShareImageContext.Provider value={value}>
      {children}
    </ShareImageContext.Provider>
  );
}

// Filet de sécurité (même convention que ModalContext.jsx/AudioPlayerContext.jsx)
// — un composant rendu hors de <ShareImageProvider> (ex. test isolé) reçoit
// des valeurs neutres/no-op plutôt qu'un plantage sur `undefined`.
const FALLBACK = {
  summaryImageStatus: 'idle', setSummaryImageStatus: () => {},
  summaryImageFile: null, setSummaryImageFile: () => {},
  summaryImagePreviewUrl: null, setSummaryImagePreviewUrl: () => {},
  includeSummaryImage: true, setIncludeSummaryImage: () => {},
};

export function useShareImage() {
  const ctx = useContext(ShareImageContext);
  return ctx || FALLBACK;
}
