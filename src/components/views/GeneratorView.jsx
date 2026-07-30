import { useGeneratorContext } from '../../contexts/GeneratorContext';
import { Zap } from 'lucide-react';
import ViewHeader from '../shared/ViewHeader';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../viewHeaderLayout';
import GeneratorWizard from './GeneratorWizard';

/**
 * GeneratorView — Refactor UX/UI (28/07, "Réglages à onglets") : redevient un
 * simple wrapper autour du wizard de génération. Le Profil Athlétique, qui
 * vivait ici (`showAthleticProfile`, voir historique ci-dessous), déménage
 * vers SettingsView.jsx en tant qu'onglet, aux côtés de "Comptes &
 * Synchronisation" — la Sidebar fusionne ses 2 anciennes entrées "Profil
 * Athlétique"/"Options & Comptes" en un seul bouton "Réglages" (voir
 * Sidebar.jsx), donc plus besoin de router 2 pages depuis CE composant.
 * `showAthleticProfile`/`setShowAthleticProfile` retirés PARTOUT où ils
 * existaient (GeneratorContext.jsx, useNavigation.js, App.jsx, Sidebar.jsx)
 * plutôt que laissés en état mort désormais toujours `false` — un état qui
 * ne sert plus jamais à rien traîné dans 5 fichiers aurait été plus trompeur
 * qu'utile pour une future session.
 *
 * Historique (25/07, chantier "séparer le générateur en 2 composants") :
 * avant ce fichier faisait 1572 lignes, dont une seule ligne
 * (`{showAthleticProfile ? (...) : (...)}`) séparait Profil Athlétique
 * (~380 lignes) et le wizard (~840 lignes) — aucune variable locale
 * partagée entre les deux. Le principe (petit fichier plutôt que
 * duplication du bloc d'en-tête) reste valable ici, simplement avec un seul
 * contenu désormais.
 */
export default function GeneratorView({
  theme,
  setCurrentPlaylist, setIsBpmSearchMode, setSearchQuery, setWorldSearchResults,
  setResultsContextLabel, setNoUsableResultsHint, searchTracksByBpm,
  executeGeneration, isGenerating,
  toggleNaughtyMode, changeView,
}) {
  const { isNaughtyMode, displaySubtitleGen } = useGeneratorContext();
  const { textColorClass } = theme;

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      {/* En-tête standardisé — via <ViewHeader/> (components/shared/ViewHeader.jsx),
          le modèle commun à toutes les vues. */}
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Zap className={textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
        title={isNaughtyMode ? "Prépare l'ambiance..." : "Sculpte ta séance"}
        subtitle={displaySubtitleGen}
      />

      <GeneratorWizard
        theme={theme}
        setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
        setSearchQuery={setSearchQuery} setWorldSearchResults={setWorldSearchResults}
        setResultsContextLabel={setResultsContextLabel} setNoUsableResultsHint={setNoUsableResultsHint}
        searchTracksByBpm={searchTracksByBpm}
        executeGeneration={executeGeneration} isGenerating={isGenerating}
        toggleNaughtyMode={toggleNaughtyMode} changeView={changeView}
      />
    </div>
  );
}
