import { useState } from 'react';
import { Award, Share2, HelpCircle, Lock } from 'lucide-react';
import { TROPHIES_DATA, TROPHY_CATEGORIES } from '../../appConfig';

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
export default function TrophiesView({ theme, userStats, handleShare }) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;
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
          'bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/40 dark:to-yellow-700/40' : 'bg-gray-100 dark:bg-gray-800 grayscale opacity-40'}`}>
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <Award className="text-yellow-500" size={36} /> <span>Mes Trophées</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Le mur des légendes. Accomplis tes sessions pour débloquer ces succès.</p>
      </div>

      {/* Onglets — même style de pilule que les autres bascules à 2 options de
          l'app (ex. Temps/Distance dans PlaylistDetailView), pour rester
          visuellement cohérent. */}
      <div className={`inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1`}>
        <button
          onClick={() => setActiveTab('visible')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'visible' ? `${bgAccentClass} text-white shadow-sm` : `${textMuted} hover:${textHighlight}`}`}
        >
          Trophées ({visibleTrophies.filter(t => userStats.unlockedTrophies.includes(t.id)).length}/{visibleTrophies.length})
        </button>
        <button
          onClick={() => setActiveTab('secret')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'secret' ? `${bgAccentClass} text-white shadow-sm` : `${textMuted} hover:${textHighlight}`}`}
        >
          <Lock size={13}/> Secrets ({unlockedSecretCount}/{secretTrophies.length})
        </button>
      </div>

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
