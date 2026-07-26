import { useState } from 'react';
import { Settings, Link as LinkIcon, Globe, Copy, Check, AlertTriangle, User as UserIcon, Edit3, X } from 'lucide-react';
import ViewHeader from '../shared/ViewHeader';

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
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken, spotifyRedirectUri, user, signOut, updateEmail, isSupabaseConfigured, userCount }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg } = theme;

  // Édition de l'adresse e-mail (retour direct, "aucun moyen de modifier
  // son e-mail") — `newEmail` pré-rempli avec `user.email` à l'ouverture du
  // mode édition (voir startEditingEmail), pas à l'initialisation du state
  // (user peut ne pas être connecté au tout 1er rendu).
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  // Distinct de l'affichage édition lui-même : reste vrai APRÈS être
  // ressorti du mode édition (voir handleEmailSubmit), pour que la
  // confirmation reste visible sous l'adresse (toujours l'ANCIENNE, voir
  // AuthContext.jsx — `user.email` ne change qu'une fois le lien de
  // confirmation suivi) plutôt que de disparaître dès la soumission.
  const [emailUpdateSent, setEmailUpdateSent] = useState(false);

  const startEditingEmail = () => {
    setNewEmail(user.email);
    setEmailError('');
    setEmailUpdateSent(false);
    setIsEditingEmail(true);
  };

  const cancelEditingEmail = () => {
    setIsEditingEmail(false);
    setEmailError('');
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    if (!newEmail.trim()) { setEmailError('Renseigne une adresse e-mail.'); return; }
    if (newEmail.trim() === user.email) { setEmailError('C\'est déjà ton adresse actuelle.'); return; }
    setEmailSubmitting(true);
    const { error } = await updateEmail(newEmail.trim());
    setEmailSubmitting(false);

    if (error) { setEmailError(error); return; }
    setIsEditingEmail(false);
    setEmailUpdateSent(true);
  };
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
    <div className="max-w-4xl mx-auto space-y-8">
      <ViewHeader
        theme={theme}
        icon={<Settings className={theme.textColorClass} size={36} />}
        title="Options & Comptes"
        subtitle="Connecte tes plateformes et ton compte pour tout synchroniser."
      />

      {/* RETOUR DIRECT ("vraiment synchroniser toutes les données entre
          appareils, email/mot de passe pour commencer") — distincte de la
          carte "Comptes connectés" juste en dessous : ceci, c'est L'IDENTITÉ
          TempoFit elle-même (qui synchronise favoris/routines/stats/profil
          athlétique — voir usePersistentState.js), pas une plateforme de
          musique externe. Volontairement en premier : savoir "qui es-tu"
          avant "à quoi es-tu relié". */}
      {/* Carte masquée pour un invité QUAND les comptes sont configurés
          côté serveur (25/07, retour direct : "utilité de garder cette
          partie en vue invité maintenant qu'il y a toujours la barre
          horizontale ?"). Dans ce cas précis, elle n'affichait déjà RIEN
          d'autre qu'un titre + une phrase (voir plus bas, branche `user ?
          ... : null` — le bouton avait déjà été retiré lors d'un retour
          précédent, jugé redondant avec "Se connecter" dans le header).
          Avec en plus GuestModeBar.jsx (bandeau persistant en bas d'écran)
          ET le sous-titre de CETTE MÊME page ("Connecte tes plateformes et
          ton compte pour tout synchroniser") qui disent déjà la même chose,
          ça faisait 3 répétitions du même message sur un seul écran.
          Reste visible dans les 2 seuls cas où elle a un vrai contenu à
          montrer : connecté (gestion du compte), ou comptes non configurés
          côté serveur (message d'erreur indépendant de l'état de connexion,
          pertinent dans les deux cas). */}
      {(user || !isSupabaseConfigured) && (
      <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
        <h3 className={`font-bold text-xl mb-2 ${textHighlight}`}>Mon compte TempoFit</h3>
        <p className={`text-sm mb-6 line-clamp-1 ${textMuted}`}>Connecte-toi pour synchroniser tes données sur tous tes appareils.</p>

        {!isSupabaseConfigured ? (
          <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} text-sm ${textMuted}`}>
            Comptes pas encore configurés côté serveur.
          </div>
        ) : user ? (
          <>
            <div className={`flex items-center justify-between p-4 rounded-2xl border border-green-500 bg-green-50 dark:bg-green-900/20`}>
              <div className="flex items-center space-x-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500 text-white shrink-0">
                  <UserIcon size={24} />
                </div>
                {/* Mode édition — remplace l'affichage e-mail/statut par un
                    petit formulaire inline (retour direct : "ajoute un
                    bouton Modifier à côté de l'adresse e-mail actuelle").
                    `min-w-0` sur le conteneur parent + celui-ci : sans ça,
                    l'input pourrait pousser "Déconnecter" hors de la carte
                    sur un écran étroit. */}
                {isEditingEmail ? (
                  <form onSubmit={handleEmailSubmit} className="min-w-0 flex-1 space-y-1.5">
                    <input
                      type="email" autoFocus autoComplete="email"
                      value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                      className={`w-full px-3 py-1.5 rounded-lg border ${inputBorder} ${inputBg} font-bold text-lg ${textHighlight} outline-none`}
                    />
                    {emailError && <p className="text-xs font-semibold text-red-500">{emailError}</p>}
                  </form>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-lg truncate ${textHighlight}`}>{user.email}</h4>
                      <button onClick={startEditingEmail} title="Modifier l'adresse e-mail" className={`shrink-0 p-1 rounded-lg ${textMuted} hover:text-main transition-colors`}>
                        <Edit3 size={14}/>
                      </button>
                    </div>
                    <p className={`text-sm ${textMuted}`}>Connecté — données synchronisées</p>
                  </div>
                )}
              </div>
              {/* "Enregistrer"/"Annuler" remplacent "Déconnecter" pendant
                  l'édition — un seul groupe d'actions visible à la fois,
                  jamais les deux mélangés dans la même rangée. */}
              {isEditingEmail ? (
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button onClick={cancelEditingEmail} title="Annuler" className={`p-2.5 rounded-lg ${textMuted} hover:text-main hover:bg-surface-hover transition-colors`}>
                    <X size={18}/>
                  </button>
                  <button
                    onClick={handleEmailSubmit} disabled={emailSubmitting}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Check size={16}/> Enregistrer
                  </button>
                </div>
              ) : (
                <button onClick={signOut} className={`shrink-0 ml-3 px-4 py-2 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg hover:bg-red-100 hover:text-red-500 transition-all text-gray-500`}>
                  Déconnecter
                </button>
              )}
            </div>
            {/* Confirmation de l'envoi — reste visible même après être
                ressorti du mode édition (voir emailUpdateSent, distinct de
                isEditingEmail) : l'action n'est réellement terminée que
                lorsque le lien reçu par e-mail est confirmé, `user.email`
                affiché au-dessus reste donc l'ANCIENNE adresse jusque-là,
                ce message évite toute confusion sur ce qui vient de se
                passer. */}
            {emailUpdateSent && (
              <p className="text-emerald-400 text-xs sm:text-sm mt-3">
                Un e-mail de confirmation a été envoyé à la nouvelle adresse pour valider le changement.
              </p>
            )}
            {/* RETOUR DIRECT ("un petit compteur discret, visible seulement
                une fois connecté") — délibérément discret (texte simple, pas
                de carte/badge qui attirerait l'œil) : c'est une curiosité
                perso, pas une métrique à mettre en avant (voir la
                discussion : un bandeau public aurait été contre-productif
                tant que ce chiffre est faible). N'apparaît QUE si
                `userCount` a été récupéré (voir AuthContext.jsx) — jamais
                tant que déconnecté ou en cours de chargement. */}
            {userCount !== null && (
              <p className={`text-xs mt-2 ${textMuted}`}>{userCount} compte{userCount > 1 ? 's' : ''} TempoFit créé{userCount > 1 ? 's' : ''} au total.</p>
            )}
          </>
        ) : (
          // RETOUR DIRECT ("la phrase du bas est de trop non ?") — retirée
          // entièrement : elle ne faisait que répéter ce que le paragraphe
          // d'intro de la vue dit déjà ("Connecte-toi pour retrouver tes
          // favoris... Sans compte, tout reste enregistré uniquement sur
          // celui-ci"), sans rien ajouter de neuf — le bouton de connexion
          // global (header, en haut à droite) est de toute façon visible et
          // évident sur toutes les pages, pas besoin de le rappeler ici.
          null
        )}
      </div>
      )}

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
            <button onClick={loginSpotify} className="min-w-[168px] justify-center px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black rounded-xl shadow-md transition-all flex items-center space-x-2">
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
            l'écran avec ça.
            RETOUR DIRECT ("supprime tout ce qui ne sert plus à rien niveau
            Deezer") — cette boîte gérait avant 3 cas (Spotify seul, Deezer
            seul, les deux) depuis que Deezer Connect existait. Simplifiée en
            un seul cas maintenant que Deezer a été retiré (voir
            DEEZER-CONNECT-REMOVED.md) — Spotify est redevenu la seule
            plateforme externe connectable. */}
        {!spotifyToken && spotifyRedirectUri && (
          <div className={`mt-4 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10`}>
            <div className="flex items-start gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
              <span className="flex-1 min-w-0 line-clamp-1">Erreur "redirect_uri" ? Enregistre cette URL dans ton Dashboard développeur Spotify.</span>
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
