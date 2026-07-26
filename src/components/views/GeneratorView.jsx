import { useGeneratorContext } from '../../contexts/GeneratorContext';
import { Zap, Gauge } from 'lucide-react';
import ViewHeader from '../shared/ViewHeader';
import AthleticProfilePanel from './AthleticProfilePanel';
import GeneratorWizard from './GeneratorWizard';

/**
 * GeneratorView — routeur mince entre les 2 pages "Générer"/"Profil
 * Athlétique" (25/07, chantier "séparer le générateur en 2 composants" —
 * retour direct : "un intérêt à séparer la génération de base et le profil
 * athlétique ?"). Justification chiffrée qui a motivé le découpage : ce
 * fichier faisait 1572 lignes, dont une SEULE ligne
 * (`{showAthleticProfile ? (...) : (...)}`) séparait deux blocs JSX quasi
 * totalement indépendants (aucune variable locale partagée entre les deux,
 * confirmé en croisant chaque prop et chaque champ de contexte par grep
 * avant de couper) — Profil Athlétique (~380 lignes) et le wizard de
 * génération (~840 lignes).
 *
 * Ce fichier-ci ne fait plus QUE : afficher l'en-tête commun (ViewHeader,
 * dont l'icône/titre/sous-titre changent selon `showAthleticProfile`) et
 * choisir lequel des 2 composants afficher — pas de duplication de ce bloc
 * d'en-tête dans les 2 fichiers (préférence explicite de l'utilisateur :
 * "petit fichier plutôt que redondance de code").
 *
 * AthleticProfilePanel.jsx et GeneratorWizard.jsx lisent chacun
 * `useGeneratorContext()` eux-mêmes pour tout ce dont ils ont besoin (le
 * state du formulaire/profil vit déjà dans ce Contexte, pas dans ce
 * composant) — seules les quelques props qui viennent d'App.jsx
 * (recherche/génération/theme/showToast, hors du périmètre du Contexte)
 * sont redistribuées ci-dessous, chacune UNIQUEMENT au composant qui
 * l'utilise réellement (vérifié par grep avant le découpage : aucune des 2
 * pages ne les utilise toutes les deux — ex. `showToast` ne sert qu'au
 * Profil Athlétique, `executeGeneration` ne sert qu'au wizard).
 */
export default function GeneratorView({
  theme,
  setCurrentPlaylist, setIsBpmSearchMode, setSearchQuery, setWorldSearchResults,
  setResultsContextLabel, setNoUsableResultsHint, searchTracksByBpm,
  executeGeneration, isGenerating,
  toggleNaughtyMode, showToast,
}) {
  const { isNaughtyMode, displaySubtitleGen, showAthleticProfile } = useGeneratorContext();
  const { textColorClass } = theme;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* En-tête standardisé — via <ViewHeader/> (components/shared/ViewHeader.jsx),
          le modèle commun à toutes les vues. `<Gauge/>` remplace `<Zap/>` quand
          `showAthleticProfile` est vrai, cohérent avec l'icône déjà utilisée
          pour "Profil Athlétique" dans la Sidebar. */}
      <ViewHeader
        theme={theme}
        icon={showAthleticProfile ? <Gauge className={textColorClass} size={36} /> : <Zap className={textColorClass} size={36} />}
        title={showAthleticProfile ? 'Mon Profil Athlétique' : (isNaughtyMode ? "Prépare l'ambiance..." : "Sculpte ta séance")}
        subtitle={showAthleticProfile ? "Définis ton BPM musical cible par zone d'effort, pour chaque activité." : displaySubtitleGen}
      />

      {/* Profil Athlétique et Générer sont 2 PAGES DISTINCTES et MUTUELLEMENT
          EXCLUSIVES (retour direct : "quand je clique sur profil athlétique
          je dois pas avoir accès à la gestion, et inversement") —
          `showAthleticProfile` (remonté dans App.jsx, piloté par les 2
          entrées de la sidebar : "Générer" et son sous-menu "Mon Profil
          Athlétique") choisit laquelle des 2 pages s'affiche. */}
      {showAthleticProfile ? (
        <AthleticProfilePanel theme={theme} showToast={showToast} />
      ) : (
        <GeneratorWizard
          theme={theme}
          setCurrentPlaylist={setCurrentPlaylist} setIsBpmSearchMode={setIsBpmSearchMode}
          setSearchQuery={setSearchQuery} setWorldSearchResults={setWorldSearchResults}
          setResultsContextLabel={setResultsContextLabel} setNoUsableResultsHint={setNoUsableResultsHint}
          searchTracksByBpm={searchTracksByBpm}
          executeGeneration={executeGeneration} isGenerating={isGenerating}
          toggleNaughtyMode={toggleNaughtyMode}
        />
      )}
    </div>
  );
}
