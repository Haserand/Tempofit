import { createContext, useContext } from 'react';
import { useAudioPreview } from '../hooks/useAudioPreview';

/**
 * AudioPlayerContext.jsx — chantier "God Component", même logique que
 * GeneratorContext.jsx : sortir de AppContent l'orchestration du lecteur
 * audio (mini-lecteur persistant + résolution à la demande, voir passation
 * "chantiers #4 et #7") pour que les vues qui en ont besoin la lisent
 * directement via `useAudioPlayer()`.
 *
 * ==========================================================================
 * CE QUI DIFFÈRE DE L'HYPOTHÈSE DE DÉPART (vérifié avant d'écrire ce fichier) :
 * ==========================================================================
 * Il n'y avait PAS de useState/useRef audio épars à "rassembler" dans
 * AppContent — `audioRef`, `isPlaying`, la logique play/pause/skip etc.
 * étaient déjà entièrement encapsulés dans `useAudioPreview.js` (extrait lors
 * d'une session précédente, voir passation "chantier #4"). Ce fichier ne fait
 * donc qu'envelopper ce hook déjà propre dans un Contexte — même geste que
 * GeneratorContext, pas une extraction depuis zéro.
 *
 * `showToast` est reçu en PROP du Provider, jamais ré-instancié via un 2e
 * `useToast()` ici : `useToast.js` documente lui-même que TOUS les hooks qui
 * en ont besoin (useFavorites, useRoutines, useUserStats, useShare,
 * useAudioPreview...) le reçoivent en paramètre pour garder un seul système
 * de toast dans toute l'app. Une 2e instance ici afficherait un toast que
 * personne ne rendrait jamais (le popup de toast vit dans le JSX
 * d'AppContent, adossé à SA propre instance de useToast()) — même piège que
 * `athleticProfile` dans GeneratorContext, réglé de la même façon.
 *
 * Conséquence : `useToast()` lui-même doit remonter dans le composant racine
 * `App` (comme `useAthleticProfile()` avant lui) — voir App.jsx.
 */

const AudioPlayerContext = createContext(null);

/**
 * @param {function} showToast - reçu, pas possédé (voir docstring plus haut)
 */
export function AudioPlayerProvider({ showToast, children }) {
  const audioPlayerApi = useAudioPreview(showToast);

  return (
    <AudioPlayerContext.Provider value={audioPlayerApi}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// Fallback silencieux — même convention que AuthContext.jsx/GeneratorContext.jsx
// (évite un plantage si un composant est rendu/testé hors de son Provider).
const FALLBACK = {
  playingPreviewId: null, togglePreview: () => {},
  currentTrack: null, isPlaying: false,
  pauseCurrentPreview: () => {}, resumeCurrentPreview: () => {}, stopCurrentPreview: () => {},
  resolveAndPlay: () => {}, resolvingTrackId: null,
  skipToNext: () => {}, skipToPrevious: () => {},
};

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  return ctx || FALLBACK;
}
