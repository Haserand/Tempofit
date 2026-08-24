import { Loader2, X } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';

/**
 * GenerationProgressBanner — bandeau flottant "Génération en cours...",
 * extrait d'App.jsx (découpage App.jsx, cluster "Génération", 21/08).
 *
 * ⚠️ Contrairement à "Image de partage"/StatsView, ce cluster N'A PAS de
 * Contexte dédié, et c'est volontaire — `isGenerating`/`generatingTotal`/
 * `generatingDone`/`isGeneratingSlowGenre`/`isGeneratingLongPlaylist`/
 * `generatingEstimatedTracksFound` restent des `useState` DANS AppContent
 * (voir usePlaylistGeneration.js) : leurs SETTERS sont passés en ARGUMENT
 * DIRECT à `usePlaylistGeneration(...)`, un hook appelé plus bas dans le
 * corps d'AppContent, avant son `return` — les déplacer dans un Provider
 * monté au niveau du JSX casserait cet ordre (même contrainte que celle
 * documentée pour `view`/`useNavigation()` dans le cluster Navigation, voir
 * README). Seul le RENDU (ce fichier) est extrait ici, reçu en props
 * classiques — un composant présentationnel, pas un Contexte. C'est ce qui
 * rend ce découpage possible SANS toucher à la contrainte d'ordre : la
 * valeur des 6 `useState` continue de vivre dans AppContent, seule sa mise
 * en forme visuelle change d'adresse.
 *
 * `getGenerationBannerMessage` (message à 3 paliers de temps, 14/08 — voir
 * son ancienne docstring dans App.jsx pour le raisonnement produit complet,
 * non reproduit ici) déplacée telle quelle, aucun changement de
 * comportement — seule sa source de données change (props au lieu de
 * closures directes sur le scope d'AppContent).
 */
export default function GenerationProgressBanner({
  theme,
  isGenerating,
  generatingTotal, generatingDone,
  isGeneratingSlowGenre, isGeneratingLongPlaylist, generatingEstimatedTracksFound,
  elapsedSeconds,
  cancelGeneration,
}) {
  const { textColorClass, textHighlight, textMuted } = theme;

  if (!isGenerating) return null;

  const getGenerationBannerMessage = () => {
    // ⚠️ "..." retirés de TOUS les messages ci-dessous (22/08, retour
    // direct : "les 3 petits points à la fin laisse idée que le message
    // est coupé, qu'on voit pas tout") — ces points de suspension
    // n'indiquaient PAS une troncature (aucun `truncate`/`line-clamp` sur
    // le `<span>` qui affiche ce texte, aucun `title=` non plus — le
    // message entier était déjà toujours visible), seulement une
    // convention visuelle pour suggérer "en cours". Ambiguë : rien ne
    // distinguait ce "..." décoratif d'un vrai signe de troncature,
    // rassurant à tort qu'un survol révélerait la suite. Retiré plutôt
    // qu'ajouter une infobulle qui aurait juste répété le même texte sans
    // rien apporter de plus — le spinner animé (`Loader2`) et le
    // chronomètre juste à côté suffisent déjà à signaler "en cours" sans
    // ambiguïté.
    if (generatingTotal > 1) return `Génération ${generatingDone}/${generatingTotal}`;

    const tier = elapsedSeconds < 15 ? 0 : elapsedSeconds < 45 ? 1 : 2;

    if (tier === 0) {
      if (isGeneratingSlowGenre && isGeneratingLongPlaylist) return "Génération en cours (séance longue + genre plus long à cibler)";
      if (isGeneratingSlowGenre) return "Génération en cours (genre plus long à cibler)";
      if (isGeneratingLongPlaylist) return "Génération en cours (séance longue, plusieurs titres à trouver)";
      return "Génération en cours";
    }

    // Paliers 1 (15-45s) et 2 (45s+) : privilégie le compte de titres réunis
    // dès qu'il est disponible (souvent le cas pour une séance longue, la
    // recherche ayant eu le temps de tourner plusieurs pages) — sinon
    // retombe sur le message de réassurance générique par palier.
    if (generatingEstimatedTracksFound > 0) {
      const plural = generatingEstimatedTracksFound > 1 ? 's' : '';
      return `Génération en cours — environ ${generatingEstimatedTracksFound} titre${plural} réuni${plural}`;
    }
    return tier === 1
      ? "Ça prend un peu plus de temps que d'habitude"
      : "Toujours en cours — certains genres ou gros lots peuvent prendre jusqu'à une minute ou plus.";
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[80] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl px-6 py-3 rounded-full flex items-center space-x-3 max-w-[90vw]">
      <Loader2 size={18} className={`animate-spin ${textColorClass} shrink-0`} />
      <span className={`font-medium text-sm ${textHighlight}`}>
        {getGenerationBannerMessage()}
      </span>
      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${textMuted} bg-black/5 dark:bg-white/10`}>
        {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
      </span>
      {/* Bouton Annuler — voir cancelGeneration (usePlaylistGeneration.js)
          pour ce qu'il fait réellement (ne coupe pas la requête réseau en
          cours, jette juste son résultat) et pourquoi. */}
      <button
        onClick={cancelGeneration}
        title="Annuler la génération"
        className={`shrink-0 p-1 ${ICON_BUTTON_ROUNDING} ${textMuted} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
