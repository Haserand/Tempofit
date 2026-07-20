import { useState } from 'react';
import { Settings, Link as LinkIcon, Globe, Copy, Check, AlertTriangle, User as UserIcon } from 'lucide-react';

/**
 * SettingsView — vue "Options & Comptes" (connexion Spotify).
 *
 * Extrait de App.jsx (bloc `view === 'settings'`), premier essai du découpage
 * en composants de vue. Volontairement "dumb" : ne lit/écrit aucun state
 * global directement, tout passe par des props explicites depuis App.jsx.
 * Ça garde App.jsx propriétaire de la vérité (spotifyToken, localStorage...)
 * et rend ce composant facile à relire ou tester isolément.
 *
 * Le Profil Athlétique (BPM cibles par zone d'effort) a été DÉPLACÉ vers GeneratorView.jsx
 * (retour direct : "personne ne le verra dans Options & Comptes" — ça sert au
 * générateur, ça doit vivre là où on génère, pas dans un menu qu'on ouvre
 * rarement). Voir GeneratorView.jsx pour l'UI, useAthleticProfile.js pour le
 * state — inchangés, seul l'EMPLACEMENT dans l'app a changé.
 */
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken, spotifyRedirectUri, deezerToken, loginDeezer, setDeezerToken, deezerRedirectUri, user, signOut, isSupabaseConfigured, openAuthModal }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg, bgAccentClass } = theme;
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

  // Même aide au dépannage, côté Deezer (voir le bloc Deezer plus bas).
  const [copiedDeezer, setCopiedDeezer] = useState(false);
  const copyDeezerRedirectUri = () => {
    if (!deezerRedirectUri) return;
    navigator.clipboard.writeText(deezerRedirectUri).then(() => {
      setCopiedDeezer(true);
      setTimeout(() => setCopiedDeezer(false), 2000);
    }).catch(() => {});
  };

  const disconnectSpotify = () => {
    window.localStorage.removeItem("spotify_token");
    setSpotifyToken(null);
  };

  const disconnectDeezer = () => {
    window.localStorage.removeItem("deezer_token");
    setDeezerToken(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6`}>
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          <Settings className={theme.textColorClass} size={36} /> <span>Options & Comptes</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Connecte tes plateformes pour utiliser de vraies musiques, et un compte pour retrouver tes données sur tous tes appareils.</p>
      </div>

      {/* RETOUR DIRECT ("vraiment synchroniser toutes les données entre
          appareils, email/mot de passe pour commencer") — distincte de la
          carte "Comptes connectés" juste en dessous : ceci, c'est L'IDENTITÉ
          TempoFit elle-même (qui synchronise favoris/routines/stats/profil
          athlétique — voir usePersistentState.js), pas une plateforme de
          musique externe. Volontairement en premier : savoir "qui es-tu"
          avant "à quoi es-tu relié". */}
      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <h3 className={`font-bold text-xl mb-2 ${textHighlight}`}>Mon compte TempoFit</h3>
        <p className={`text-sm mb-6 ${textMuted}`}>Connecte-toi pour retrouver tes favoris, routines et stats sur tous tes appareils. Sans compte, tout reste enregistré uniquement sur celui-ci.</p>

        {!isSupabaseConfigured ? (
          <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} text-sm ${textMuted}`}>
            Comptes pas encore configurés côté serveur.
          </div>
        ) : user ? (
          <div className={`flex items-center justify-between p-4 rounded-2xl border border-green-500 bg-green-50 dark:bg-green-900/20`}>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500 text-white">
                <UserIcon size={24} />
              </div>
              <div>
                <h4 className={`font-bold text-lg ${textHighlight}`}>{user.email}</h4>
                <p className={`text-sm ${textMuted}`}>Connecté — données synchronisées</p>
              </div>
            </div>
            <button onClick={signOut} className={`px-4 py-2 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-all text-gray-500`}>
              Déconnecter
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${inputBorder} ${inputBg}`}>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500">
                <UserIcon size={24} />
              </div>
              <div>
                <h4 className={`font-bold text-lg ${textHighlight}`}>Non connecté</h4>
                <p className={`text-sm ${textMuted}`}>Données enregistrées uniquement sur cet appareil</p>
              </div>
            </div>
            <button onClick={openAuthModal} className={`px-6 py-3 text-white font-black rounded-xl shadow-md transition-all hover:brightness-110 ${bgAccentClass}`}>
              Se connecter
            </button>
          </div>
        )}
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

        {/* RETOUR DIRECT ("un seul message jaune suffit quand les 2 comptes
            ont le souci, pour gagner de la place") — Spotify et Deezer
            calculent tous les deux `origin + pathname` comme URL de
            redirection : c'est LITTÉRALEMENT la même chaîne dans les 2 cas,
            donc l'afficher 2 fois quand les 2 comptes sont déconnectés en
            même temps n'apportait rien. 3 cas maintenant, pas 2 :
              - seul Spotify a le souci (Deezer déjà connecté) → boîte Spotify seule
              - seul Deezer a le souci (Spotify déjà connecté) → boîte Deezer seule
              - LES DEUX ont le souci → une seule boîte fusionnée plus bas,
                ni celle-ci ni celle de Deezer ne s'affichent ici */}
        {!spotifyToken && deezerToken && spotifyRedirectUri && (
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

        {/* RETOUR DIRECT ("intégrer une alternative gratuite à Spotify, pas
            besoin de Premium") — Deezer n'exige ni abonnement Premium côté
            propriétaire de l'app, ni liste blanche d'utilisateurs comme le
            Mode Développement Spotify (voir SettingsView.jsx, bloc Spotify
            ci-dessus, et la conversation qui a mené à cette intégration).
            Bloc structurellement identique à celui de Spotify juste
            au-dessus, même logique connecté/déconnecté — les 2 comptes
            peuvent être liés en même temps, sans exclusion mutuelle. */}
        <div className="h-4"></div>
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${deezerToken ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : inputBorder + ' ' + inputBg}`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${deezerToken ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
              <LinkIcon size={24} />
            </div>
            <div>
              <h4 className={`font-bold text-lg ${textHighlight}`}>Deezer</h4>
              <p className={`text-sm ${textMuted}`}>{deezerToken ? 'Connecté (Accès à 90M de titres)' : 'Non connecté — gratuit, pas de Premium requis'}</p>
            </div>
          </div>

          {!deezerToken ? (
            <button onClick={loginDeezer} className="px-6 py-3 bg-[#A238FF] hover:bg-[#b45cff] text-white font-black rounded-xl shadow-md transition-all flex items-center space-x-2">
              <span>Lier mon compte</span>
            </button>
          ) : (
            <button onClick={disconnectDeezer} className={`px-4 py-2 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-all text-gray-500`}>
              Déconnecter
            </button>
          )}
        </div>

        {/* Cas "seul Deezer a le souci" (Spotify déjà connecté) — voir le
            commentaire au-dessus de la boîte Spotify pour les 3 cas. */}
        {!deezerToken && spotifyToken && deezerRedirectUri && (
          <div className={`mt-4 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10`}>
            <div className="flex items-start gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
              <span>Erreur de redirection Deezer ? Cette URL doit être enregistrée dans le Dashboard développeur Deezer de cette app (Settings → Redirect URI), à l'identique.</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${inputBorder} ${inputBg}`}>
              <code className={`flex-1 text-xs font-mono truncate ${textHighlight}`}>{deezerRedirectUri}</code>
              <button
                onClick={copyDeezerRedirectUri}
                title="Copier cette URL"
                className={`shrink-0 p-1.5 rounded-md transition-colors ${copiedDeezer ? 'text-green-500' : textMuted + ' hover:text-amber-600'}`}
              >
                {copiedDeezer ? <Check size={16}/> : <Copy size={16}/>}
              </button>
            </div>
          </div>
        )}

        {/* Cas "LES DEUX ont le souci" — une seule boîte, même URL affichée
            une seule fois (voir le commentaire au-dessus de la boîte
            Spotify). Réutilise `copied`/`copyRedirectUri` (peu importe
            lequel des 2 états, l'URL copiée est identique). */}
        {!spotifyToken && !deezerToken && (spotifyRedirectUri || deezerRedirectUri) && (
          <div className={`mt-4 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10`}>
            <div className="flex items-start gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
              <span>Erreur de redirection Spotify ou Deezer ? Cette URL doit être enregistrée à l'identique dans le Dashboard développeur Spotify (Settings → Redirect URIs) ET dans celui de Deezer (Settings → Redirect URI) — même URL pour les deux.</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${inputBorder} ${inputBg}`}>
              <code className={`flex-1 text-xs font-mono truncate ${textHighlight}`}>{spotifyRedirectUri || deezerRedirectUri}</code>
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
