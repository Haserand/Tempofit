import { useState } from 'react';
import { Settings, Link as LinkIcon, Globe, Copy, Check, AlertTriangle } from 'lucide-react';

/**
 * SettingsView — vue "Options & Comptes" (connexion Spotify).
 *
 * Extrait de App.jsx (bloc `view === 'settings'`), premier essai du découpage
 * en composants de vue. Volontairement "dumb" : ne lit/écrit aucun state
 * global directement, tout passe par des props explicites depuis App.jsx.
 * Ça garde App.jsx propriétaire de la vérité (spotifyToken, localStorage...)
 * et rend ce composant facile à relire ou tester isolément.
 *
 * Le Profil Athlétique (zones de cadence) a été DÉPLACÉ vers GeneratorView.jsx
 * (retour direct : "personne ne le verra dans Options & Comptes" — ça sert au
 * générateur, ça doit vivre là où on génère, pas dans un menu qu'on ouvre
 * rarement). Voir GeneratorView.jsx pour l'UI, useAthleticProfile.js pour le
 * state — inchangés, seul l'EMPLACEMENT dans l'app a changé.
 */
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken, spotifyRedirectUri }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg } = theme;
  // Retour direct : erreur Spotify "redirect_uri: Not matching configuration"
  // au clic sur "Lier mon compte" — ce n'est PAS un bug de ce code (voir
  // App.jsx, `loginSpotify`) : Spotify exige que l'URL de redirection envoyée
  // dans la requête OAuth corresponde À L'IDENTIQUE (protocole, domaine,
  // chemin, présence/absence du slash final) à une URL enregistrée à l'avance
  // dans le Dashboard développeur Spotify de CETTE app (celle du
  // `client_id` utilisé, voir App.jsx). Cette URL change selon où l'app
  // tourne (aperçu, domaine de prod, localhost...), donc l'erreur est
  // fréquente dès qu'on teste ailleurs que l'URL déjà enregistrée. Affiché
  // ici tel quel (copiable) pour l'ajouter en un clic dans
  // https://developer.spotify.com/dashboard → l'app concernée → Settings →
  // Redirect URIs — plutôt que de forcer à le retrouver dans l'URL tronquée
  // de la barre d'adresse au moment de l'erreur.
  const [copied, setCopied] = useState(false);
  const copyRedirectUri = () => {
    if (!spotifyRedirectUri) return;
    navigator.clipboard.writeText(spotifyRedirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
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

        {/* Aide au dépannage "redirect_uri: Not matching configuration" — voir
            le commentaire plus haut. N'apparaît que tant que Spotify n'est pas
            connecté : une fois lié avec succès, plus la peine d'encombrer
            l'écran avec ça. */}
        {!spotifyToken && spotifyRedirectUri && (
          <div className={`mt-4 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10`}>
            <div className="flex items-start gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
              <span>Erreur "redirect_uri: Not matching configuration" ? Cette URL doit être enregistrée dans le Dashboard développeur Spotify de cette app (Settings → Redirect URIs), à l'identique.</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${inputBorder} ${inputBg}`}>
              <code className={`flex-1 text-xs font-mono truncate ${textHighlight}`}>{spotifyRedirectUri}</code>
              <button
                onClick={copyRedirectUri}
                title="Copier cette URL"
                className={`shrink-0 p-1.5 rounded-md transition-colors ${copied ? 'text-green-500' : textMuted + ' hover:text-amber-600'}`}
              >
                {copied ? <Check size={16}/> : <Copy size={16}/>}
              </button>
            </div>
          </div>
        )}

        <div className="h-4"></div>
        <div className="p-4 rounded-2xl border border-green-500 bg-green-50 dark:bg-green-900/10 text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
          <Globe size={18}/> <span>Base musicale mondiale : connectée</span>
        </div>
      </div>
    </div>
  );
}
