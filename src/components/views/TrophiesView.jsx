import { useState, useEffect } from 'react';
import { Award, Share2, HelpCircle, Lock } from 'lucide-react';
import { TROPHIES_DATA, TROPHY_CATEGORIES } from '../../appConfig';
import ViewHeader from '../shared/ViewHeader';
import TabPills from '../shared/TabPills';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

/**
 * TrophiesView — vue "Mes Trophées" (mur des succès débloqués).
 *
 * Extrait de App.jsx (bloc `view === 'trophies'`). Purement affichage : la
 * logique de déblocage (`checkTrophies`) reste dans App.jsx, ce composant se
 * contente de lire `userStats.unlockedTrophies` et de déclencher `handleShare`
 * au clic sur "Partager mon exploit".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX PAGES DISTINCTES (retour direct : "avoir les trophées sur 2 pages
 * distinctes... les visibles dans un onglet spécifique et les secrets à
 * découvrir dans un autre") — remplace l'ancienne grille unique qui mélangeait
 * les deux, ce qui donnait une bonne moitié de cartes "Trophée secret"
 * identiques diluant visuellement les trophées à visée pédagogique. État
 * d'onglet purement local (`activeTab`) : éphémère, propre à cette page,
 * comme `showRawImportTable` dans PlaylistDetailView — pas besoin de le
 * remonter dans App.jsx.
 *
 * `trophy.secret` (TROPHIES_DATA, appConfig.js) fait toujours la distinction
 * entre les 2 groupes :
 * - Visibles : introduisent une FONCTIONNALITÉ (Mode Intime, import de
 *   données, Crescendo, mode clair, routines...) ou une progression/habitude
 *   — toujours affichés en entier (nom + description), même verrouillés, et
 *   maintenant groupés par catégorie (voir TROPHY_CATEGORIES) plutôt qu'en
 *   liste plate dans l'ordre historique d'ajout.
 * - Secrets : liés à un COMPORTEMENT précis (distance extrême, heure de la
 *   séance, série de jours, le rickroll...) — masqués en "easter egg" tant
 *   que non débloqués (icône générique, nom/description remplacés par "???"),
 *   affichés en une SEULE grille non catégorisée : les sous-catégoriser
 *   donnerait des indices sur leur thème avant même de les avoir débloqués,
 *   ce qui irait à l'encontre de la surprise qui fait leur intérêt.
 */
export default function TrophiesView({ theme, userStats, handleShare, isNaughtyMode, markTrophiesSeen }) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;

  // Badge de notification "vu/pas vu" (03/08, retour direct, capture
  // d'écran — voir la docstring complète de `markTrophiesSeen`,
  // useUserStats.js) — appelé UNE FOIS à l'ouverture de cette page,
  // jamais à chaque re-render (tableau de dépendances vide, `[]`) : le
  // badge doit se vider dès qu'on MET LES YEUX sur la page, pas seulement
  // après une action précise dessus. Idempotent si rappelé (repose juste
  // `trophiesSeenCount` à la même valeur) — pas de garde-fou nécessaire
  // contre un double appel.
  useEffect(() => {
    markTrophiesSeen();
  }, []);
  const [activeTab, setActiveTab] = useState('visible');

  const visibleTrophies = TROPHIES_DATA.filter(t => !t.secret);
  const secretTrophies = TROPHIES_DATA.filter(t => t.secret);
  const unlockedSecretCount = secretTrophies.filter(t => userStats.unlockedTrophies.includes(t.id)).length;

  const renderTrophyCard = (trophy) => {
    const isUnlocked = userStats.unlockedTrophies.includes(trophy.id);
    // Masqué seulement si SECRET ET encore verrouillé — une fois débloqué,
    // un trophée secret se révèle en entier comme les autres (rien à cacher
    // après coup, la surprise est dans la découverte, pas dans le mur).
    const isMasked = trophy.secret && !isUnlocked;
    return (
      <div key={trophy.id} className={`${cardBg} rounded-2xl p-6 border ${isUnlocked ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : isMasked ? `border-dashed ${cardBorder}` : cardBorder} flex items-start space-x-4 transition-all`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${isUnlocked ?
          'bg-linear-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/40 dark:to-yellow-700/40' : 'bg-surface-hover grayscale opacity-40'}`}>
          {isMasked ? <HelpCircle size={28} className={textMuted} /> : trophy.icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-bold text-lg ${isUnlocked ? textHighlight : textMuted}`}>{isMasked ? 'Trophée secret' : trophy.name}</h3>
          <p className={`text-sm mt-1 ${isUnlocked ? textMuted : 'text-gray-400 dark:text-gray-600'}`}>
            {isMasked ? 'Un comportement précis dans l\'appli débloque ce trophée — à toi de le découvrir.' : trophy.desc}
          </p>
          {isUnlocked && (
            <button onClick={() => handleShare('trophy', trophy)} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center space-x-1">
              <Share2 size={12}/> <span>Partager mon exploit</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Award className="text-yellow-500" size={VIEW_HEADER_ICON_SIZE} />}
        title="Mes Trophées"
        subtitle="Le mur des légendes. Accomplis tes sessions pour débloquer ces succès."
      />

      {/* Onglets — standardisé sur TabPills.jsx (21/08, retour direct),
          même composant partagé désormais avec PlaylistsView.jsx/
          ProfileView.jsx/DiscoverView.jsx/SettingsView.jsx. Perd son style
          "contrôle segmenté" propre (fond `bg-surface-hover`, boutons
          `shadow-xs`) au profit du style plat majoritaire ailleurs — voir
          TabPills.jsx pour le raisonnement complet de cette décision.
          L'icône `Lock` devient un `<span>` inline-flex DANS le label
          plutôt qu'un `flex` sur le bouton lui-même (TabPills.jsx n'en
          propose pas, chaque appelant compose son propre label). */}
      <TabPills
        theme={theme}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'visible', label: `Trophées (${visibleTrophies.filter(t => userStats.unlockedTrophies.includes(t.id)).length}/${visibleTrophies.length})` },
          {
            value: 'secret',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13}/> Secrets ({unlockedSecretCount}/{secretTrophies.length})
              </span>
            ),
          },
        ]}
      />

      {activeTab === 'visible' ? (
        <div className="space-y-10">
          {TROPHY_CATEGORIES.map(cat => {
            const trophiesInCat = visibleTrophies.filter(t => t.category === cat.key);
            if (trophiesInCat.length === 0) return null;
            return (
              <div key={cat.key}>
                <div className="mb-4">
                  <h3 className={`font-bold text-lg ${textHighlight}`}>{cat.label}</h3>
                  <p className={`text-sm ${textMuted}`}>{cat.desc}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trophiesInCat.map(renderTrophyCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className={`text-sm mb-4 flex items-center gap-1.5 ${textMuted}`}>
            <Lock size={14}/> Un comportement précis dans l'appli débloque chacun de ces trophées — pas de liste, la surprise fait partie du jeu.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {secretTrophies.map(renderTrophyCard)}
          </div>
        </div>
      )}

      <div className={`text-center ${textMuted} text-sm font-medium bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl`}>
        <div className="flex justify-center items-center space-x-8">
          <div>Sessions totales : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.totalCompleted}</span></div>
          <div>Fichiers analysés : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.dataImports}</span></div>
        </div>
      </div>
    </div>
  );
}
