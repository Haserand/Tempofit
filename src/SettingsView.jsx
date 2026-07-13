import { Settings, Link as LinkIcon, Globe } from 'lucide-react';

/**
 * SettingsView — vue "Options & Comptes" (connexion Spotify).
 *
 * Extrait de App.jsx (bloc `view === 'settings'`), premier essai du découpage
 * en composants de vue. Volontairement "dumb" : ne lit/écrit aucun state
 * global directement, tout passe par des props explicites depuis App.jsx.
 * Ça garde App.jsx propriétaire de la vérité (spotifyToken, localStorage...)
 * et rend ce composant facile à relire ou tester isolément.
 */
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg } = theme;

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
    </div>
  );
}
