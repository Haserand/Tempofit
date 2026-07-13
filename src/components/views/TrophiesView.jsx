import { Award, Share2 } from 'lucide-react';
import { TROPHIES_DATA } from '../../appConfig';

/**
 * TrophiesView — vue "Mes Trophées" (mur des succès débloqués).
 *
 * Extrait de App.jsx (bloc `view === 'trophies'`). Purement affichage : la
 * logique de déblocage (`checkTrophies`) reste dans App.jsx, ce composant se
 * contente de lire `userStats.unlockedTrophies` et de déclencher `handleShare`
 * au clic sur "Partager mon exploit".
 */
export default function TrophiesView({ theme, userStats, handleShare }) {
  const { cardBg, cardBorder, textHighlight, textMuted } = theme;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <Award className="text-yellow-500" size={36} /> <span>Mes Trophées</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Le mur des légendes. Accomplis tes sessions pour débloquer ces succès.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TROPHIES_DATA.map(trophy => {
          const isUnlocked = userStats.unlockedTrophies.includes(trophy.id);
          return (
            <div key={trophy.id} className={`${cardBg} rounded-2xl p-6 border ${isUnlocked ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : cardBorder} flex items-start space-x-4 transition-all`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 ${isUnlocked ?
                'bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-900/40 dark:to-yellow-700/40' : 'bg-gray-100 dark:bg-gray-800 grayscale opacity-40'}`}>
                {trophy.icon}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-lg ${isUnlocked ? textHighlight : textMuted}`}>{trophy.name}</h3>
                <p className={`text-sm mt-1 ${isUnlocked ? textMuted : 'text-gray-400 dark:text-gray-600'}`}>{trophy.desc}</p>
                {isUnlocked && (
                  <button onClick={() => handleShare('trophy', trophy)} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center space-x-1">
                    <Share2 size={12}/> <span>Partager mon exploit</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`text-center mt-8 ${textMuted} text-sm font-medium bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl`}>
        <div className="flex justify-center items-center space-x-8">
          <div>Sessions totales : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.totalCompleted}</span></div>
          <div>Fichiers analysés : <span className={`font-black text-xl block ${textHighlight}`}>{userStats.dataImports}</span></div>
        </div>
      </div>
    </div>
  );
}
