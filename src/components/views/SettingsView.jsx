import { useState } from 'react';
import { Settings, Link as LinkIcon, Globe, Gauge, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { ATHLETIC_ZONES } from '../../appConfig';

/**
 * SettingsView — vue "Options & Comptes" (connexion Spotify, Profil Athlétique).
 *
 * Extrait de App.jsx (bloc `view === 'settings'`), premier essai du découpage
 * en composants de vue. Volontairement "dumb" : ne lit/écrit aucun state
 * global directement, tout passe par des props explicites depuis App.jsx.
 * Ça garde App.jsx propriétaire de la vérité (spotifyToken, localStorage...)
 * et rend ce composant facile à relire ou tester isolément.
 *
 * Exception locale : `showExpertZones` (juste en dessous) est un pur état
 * d'AFFICHAGE (le panneau Expert est-il déplié), jamais une donnée à
 * conserver — même logique que `showRawImportTable` dans PlaylistDetailView.jsx.
 */
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken, athleticProfile, setBaseCadence, setZone, resetAthleticProfile }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg, textColorClass, bgAccentClass } = theme;
  // Divulgation progressive (consigne explicite) : replié par défaut, ne
  // s'affiche que si l'utilisateur clique "Ajuster manuellement" — l'Assistant
  // Rapide doit rester le chemin par défaut pour qui ne veut pas s'embêter.
  const [showExpertZones, setShowExpertZones] = useState(false);
  // Brouillon de saisie de l'Assistant Rapide — distinct de
  // `athleticProfile.baseCadence` (qui ne se met à jour qu'après calcul) pour
  // ne pas recalculer les zones à chaque frappe, seulement au clic/Entrée.
  const [baseCadenceDraft, setBaseCadenceDraft] = useState(athleticProfile.baseCadence ?? '');

  const computeAndApply = () => {
    if (!baseCadenceDraft) return;
    setBaseCadence(baseCadenceDraft);
  };

  const disconnectSpotify = () => {
    window.localStorage.removeItem("spotify_token");
    setSpotifyToken(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <Settings className={theme.textColorClass} size={36} /> <span>Options & Comptes</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Connecte tes plateformes pour utiliser de vraies musiques.</p>
      </div>

      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <h3 className={`font-bold text-xl mb-6 ${textHighlight}`}>Comptes connectés</h3>

        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${spotifyToken ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : inputBorder + ' ' + inputBg}`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${spotifyToken ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
              <LinkIcon size={24} />
            </div>
            <div>
              <h4 className={`font-bold text-lg ${textHighlight}`}>Spotify</h4>
              <p className={`text-sm ${textMuted}`}>{spotifyToken ? 'Connecté (Accès à 100M de titres)' : 'Non connecté'}</p>
            </div>
          </div>

          {!spotifyToken ? (
            <button onClick={loginSpotify} className="px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black rounded-xl shadow-md transition-all flex items-center space-x-2">
              <span>Lier mon compte</span>
            </button>
          ) : (
            <button onClick={disconnectSpotify} className={`px-4 py-2 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-all text-gray-500`}>
              Déconnecter
            </button>
          )}
        </div>

        <div className="h-4"></div>
        <div className="p-4 rounded-2xl border border-green-500 bg-green-50 dark:bg-green-900/10 text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
          <Globe size={18}/> <span>Base musicale mondiale : connectée</span>
        </div>
      </div>

      {/* Profil Athlétique — zones d'intensité de CADENCE musicale (BPM), pas de
          fréquence cardiaque (voir useAthleticProfile.js pour la remarque
          terminologie complète). Sert à pré-remplir intelligemment le mode
          Crescendo du générateur, et à répartir l'historique des séances par
          zone dans Statistiques — aucune des deux connexions n'est encore
          câblée à ce stade, cette section ne fait pour l'instant que définir
          et stocker le profil lui-même. */}
      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h3 className={`font-bold text-xl flex items-center gap-2 ${textHighlight}`}><Gauge className={textColorClass} size={22}/> Mon Profil Athlétique</h3>
            <p className={`text-sm mt-1 ${textMuted}`}>Définis tes zones d'allure musicale pour que le générateur les propose automatiquement, et pour voir comment tes séances se répartissent entre elles dans Statistiques.</p>
          </div>
          {athleticProfile.isConfigured && (
            <button onClick={resetAthleticProfile} title="Effacer mon profil athlétique" className={`shrink-0 p-2 rounded-lg transition-colors ${textMuted} hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}>
              <RotateCcw size={18}/>
            </button>
          )}
        </div>

        {/* Assistant Rapide : une seule question, 4 zones calculées d'un coup
            (voir computeZonesFromBaseCadence, useAthleticProfile.js). Reste le
            chemin par défaut même après un premier calcul — resaisir une
            nouvelle cadence ici recalcule les 4 zones depuis zéro. */}
        <div className={`mt-4 p-4 rounded-2xl ${inputBg} border ${inputBorder}`}>
          <label className={`text-sm font-bold block mb-2 ${textHighlight}`}>Quelle est ta cadence habituelle lors d'un footing lent ?</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${inputBorder} ${cardBg}`}>
              <input
                type="number" min="40" max="220" placeholder="ex : 160"
                value={baseCadenceDraft}
                onChange={(e) => setBaseCadenceDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && computeAndApply()}
                className={`bg-transparent w-full text-lg font-bold outline-none ${textHighlight}`}
              />
              <span className={`text-sm font-bold shrink-0 ${textMuted}`}>BPM</span>
            </div>
            <button onClick={computeAndApply} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110 shrink-0`}>
              Calculer mes zones
            </button>
          </div>
        </div>

        {/* Récapitulatif des 4 zones actuelles — n'apparaît qu'une fois un
            profil calculé au moins une fois (voir isConfigured), pour ne pas
            afficher des zones à null/vides avant la 1ère saisie. */}
        {athleticProfile.isConfigured && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {ATHLETIC_ZONES.map(z => (
              <div key={z.key} className={`p-3 rounded-xl border ${inputBorder} ${inputBg} text-center`}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${textMuted}`}>{z.shortLabel}</span>
                </div>
                <div className={`text-xl font-black ${textHighlight}`}>{athleticProfile[z.key] ?? '—'}</div>
                <div className={`text-[10px] ${textMuted}`}>BPM</div>
              </div>
            ))}
          </div>
        )}

        {/* Mode Expert (divulgation progressive) : révèle 4 champs pour écraser
            les valeurs calculées mathématiquement, zone par zone — sans jamais
            recalculer les 3 autres (voir setZone, useAthleticProfile.js). */}
        <button
          onClick={() => setShowExpertZones(!showExpertZones)}
          className={`mt-4 flex items-center gap-1.5 text-sm font-bold ${textColorClass}`}
        >
          {showExpertZones ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          <span>Ajuster manuellement</span>
        </button>

        {showExpertZones && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {ATHLETIC_ZONES.map(z => (
              <div key={z.key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                  <span className={`text-sm font-bold truncate ${textHighlight}`}>{z.label}</span>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border ${inputBorder} ${cardBg}`}>
                  <input
                    type="number" min="40" max="220"
                    value={athleticProfile[z.key] ?? ''}
                    onChange={(e) => setZone(z.key, e.target.value)}
                    className={`w-14 bg-transparent text-right font-mono font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${textHighlight}`}
                  />
                  <span className={`text-xs font-bold ${textMuted}`}>BPM</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
