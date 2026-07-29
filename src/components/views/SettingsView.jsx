import { useState, useEffect } from 'react';
import { Gauge, Link as LinkIcon, Globe, Copy, Check, AlertTriangle, User as UserIcon, X, Key, Download, Trash2, AtSign, Lock, Loader2 } from 'lucide-react';
import ViewHeader from '../shared/ViewHeader';
import AthleticProfilePanel from './AthleticProfilePanel';

/**
 * SettingsView — vue unifiée "Réglages" (Refactor UX/UI, 28/07, "Sidebar
 * simplifiée + Réglages à onglets"). Fusionne plusieurs anciennes entrées
 * distinctes de la Sidebar en une seule page à onglets horizontaux.
 *
 * Historique du Profil Athlétique (pour ne pas refaire le même aller-retour
 * sans le savoir) : il vivait à l'origine dans "Options & Comptes" ;
 * déplacé une 1re fois vers GeneratorView.jsx (retour direct : "personne ne
 * le verra dans Options & Comptes"). Ramené ici une 2e fois comme onglet
 * dédié, à parts égales avec les autres.
 *
 * Refactor 2 (28/07, "restructuration des onglets + ajouts RGPD") — l'ancien
 * onglet unique "Comptes & Synchronisation" mélangeait 2 périmètres
 * distincts (intégrations tierces vs identité/sécurité du compte). Scindé
 * en 2 : `music` (Spotify — inchangé, juste déplacé) et `account` (NOUVEAU
 * — email/mot de passe déjà existants ailleurs, déplacés ici + export RGPD
 * + suppression de compte, tous deux NOUVEAUX). Voir le bloc `account`
 * plus bas pour une limite assumée sur ce dernier point.
 *
 * `AthleticProfilePanel` lit lui-même `useGeneratorContext()` pour tout ce
 * dont il a besoin (voir sa propre docstring) — ce composant-ci ne fait que
 * le monter/démonter selon l'onglet actif, sans dupliquer son state.
 *
 * Garde-fou Mode Intime (reproduit ici, retiré de App.jsx où il vivait
 * avant sous forme de useEffect global sur `showAthleticProfile`) : le
 * Profil Athlétique configure des zones de BPM par activité SPORTIVE
 * (Course à pied/Cyclisme/Musculation), un concept sans équivalent en Mode
 * Intime (workoutType y est toujours "Ambiance") — l'onglet est masqué
 * dans ce mode (SEUL cet onglet, pas toute la barre — contrairement à
 * avant où 2 onglets seulement rendaient la barre inutile une fois l'un
 * d'eux caché ; avec 3 onglets désormais, `music`/`account` restent tous
 * les deux valides et sélectionnables). Un effet de sécurité rebascule
 * automatiquement vers `music` si le Mode Intime s'active PENDANT que
 * l'onglet Profil est déjà ouvert.
 */
export default function SettingsView({ theme, spotifyToken, loginSpotify, setSpotifyToken, spotifyRedirectUri, user, updateEmail, updatePassword, exportUserData, eraseUserData, isSupabaseConfigured, userCount, isNaughtyMode, showToast, changeView, username, usernameLoading, checkUsernameAvailable, setUsername }) {
  const { cardBg, cardBorder, textHighlight, textMuted, inputBorder, inputBg, textColorClass, borderAccentClass } = theme;

  // Onglet actif — jamais 'profile' par défaut en Mode Intime (voir garde-
  // fou dans la docstring) : l'initialisation lazy (fonction passée à
  // useState) évite un flash "Profil Athlétique" visible une frame avant
  // que l'effet de sécurité ci-dessous ne le referme.
  const [activeTab, setActiveTab] = useState(() => (isNaughtyMode ? 'music' : 'profile'));

  useEffect(() => {
    if (isNaughtyMode && activeTab === 'profile') setActiveTab('music');
  }, [isNaughtyMode, activeTab]);

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

  // Définition du pseudonyme pour un compte EXISTANT sans pseudonyme
  // (rétrocompatibilité — voir le brief). Même schéma de validation que
  // AuthModal.jsx (regex partagée, vérification `onBlur`) — dupliqué ici
  // plutôt que factorisé dans un hook commun : 2 formulaires assez
  // différents (celui-ci a son propre bouton "Valider" et sa propre carte,
  // pas de mode signin/signup à gérer) pour que l'extraction n'apporte pas
  // grand-chose de plus qu'une indirection.
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
  const [usernameField, setUsernameFieldValue] = useState('');
  const [usernameFieldStatus, setUsernameFieldStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [usernameFieldError, setUsernameFieldError] = useState('');
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);

  const handleUsernameFieldBlur = async () => {
    if (!usernameField) { setUsernameFieldStatus(null); return; }
    if (!USERNAME_REGEX.test(usernameField)) { setUsernameFieldStatus('invalid'); return; }
    setUsernameFieldStatus('checking');
    const { available, error } = await checkUsernameAvailable(usernameField);
    if (error) { setUsernameFieldStatus(null); return; }
    setUsernameFieldStatus(available ? 'available' : 'taken');
  };

  const handleUsernameFormSubmit = async (e) => {
    e.preventDefault();
    setUsernameFieldError('');
    if (!usernameField.trim()) { setUsernameFieldError('Choisis un pseudonyme.'); return; }
    if (!USERNAME_REGEX.test(usernameField)) { setUsernameFieldError('3 à 20 caractères : minuscules, chiffres, underscore uniquement.'); return; }
    if (usernameFieldStatus === 'taken') { setUsernameFieldError('Ce pseudonyme est déjà pris.'); return; }
    setUsernameSubmitting(true);
    const { error } = await setUsername(usernameField);
    setUsernameSubmitting(false);
    if (error) { setUsernameFieldError(error); return; }
    // Pas besoin de vider `usernameField` ni de gérer un état "succès" ici
    // — dès que `setUsername` réussit, le state `username` (reçu en prop,
    // source de vérité côté AuthContext.jsx) devient non-null, et c'est
    // CETTE condition qui bascule l'affichage vers la carte "Non
    // modifiable" au rendu suivant (voir plus bas) : pas de duplication
    // d'état local pour un succès qui se reflète déjà ailleurs.
  };

  // Changement de mot de passe (Refactor UI, 28/07, "Réglages — Mon Compte")
  // — même schéma que l'édition d'e-mail juste au-dessus, formulaire dédié
  // distinct (2 champs séparés, jamais mélangés dans le même state/erreur).
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const startChangingPassword = () => {
    setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordUpdated(false);
    setIsChangingPassword(true);
  };
  const cancelChangingPassword = () => { setIsChangingPassword(false); setPasswordError(''); };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Au moins 6 caractères.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Les 2 mots de passe ne correspondent pas.'); return; }
    setPasswordSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setPasswordSubmitting(false);
    if (error) { setPasswordError(error); return; }
    setIsChangingPassword(false);
    setPasswordUpdated(true);
  };

  // Export RGPD (portabilité) — télécharge un fichier .json contenant
  // toutes les données synchronisées de l'utilisateur (voir
  // AuthContext.jsx, `exportUserData`). Le fichier est construit et
  // déclenché entièrement côté client (Blob + lien temporaire), rien
  // n'est envoyé nulle part d'autre qu'au navigateur de la personne.
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleExportData = async () => {
    setExportError('');
    setIsExporting(true);
    const { data, error } = await exportUserData();
    setIsExporting(false);
    if (error) { setExportError(error); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempofit-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Suppression de compte / "Zone dangereuse" — ⚠️ voir la docstring de
  // `eraseUserData` dans AuthContext.jsx : ce bouton efface réellement
  // toutes les données synchronisées de la personne, mais N'EFFACE PAS
  // (pas encore) le compte `auth.users` lui-même — limite serveur assumée,
  // documentée là-bas, pas cachée ici. Le texte affiché à l'utilisateur
  // reste honnête sur ce point (voir plus bas, "Effacer mes données"
  // plutôt que "Supprimer mon compte" sans nuance).
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleConfirmDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    const { error } = await eraseUserData();
    setIsDeleting(false);
    if (error) { setDeleteError(error); return; }
    setIsConfirmingDelete(false);
  };

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
        isNaughtyMode={isNaughtyMode}
        icon={
          activeTab === 'profile' ? <Gauge className={textColorClass} size={36} /> :
          activeTab === 'music' ? <LinkIcon className={textColorClass} size={36} /> :
          <UserIcon className={textColorClass} size={36} />
        }
        title={
          activeTab === 'profile' ? 'Mon Profil Athlétique' :
          activeTab === 'music' ? 'Services Musicaux' :
          'Mon Compte'
        }
        subtitle={
          activeTab === 'profile' ? "Définis ton BPM musical cible par zone d'effort, pour chaque activité." :
          activeTab === 'music' ? "Connecte tes plateformes de streaming pour synchroniser tes playlists." :
          "Gère ta sécurité et tes données personnelles."
        }
      />

      {/* Onglets horizontaux — Refactor (28/07, "restructuration des
          onglets") : 3 onglets désormais (Profil Athlétique / Services
          Musicaux / Mon Compte), la barre reste TOUJOURS visible même en
          Mode Intime (contrairement à avant, où 2 onglets seulement
          rendaient la barre inutile une fois Profil caché) — seul le
          bouton "Profil Athlétique" se masque, les 2 autres restent
          valides et sélectionnables dans ce mode. */}
      <div className={`flex space-x-6 border-b ${cardBorder}`}>
        {!isNaughtyMode && (
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 -mb-px text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'profile' ? `${textHighlight} ${borderAccentClass}` : `${textMuted} border-transparent hover:text-main`
            }`}
          >
            Profil Athlétique
          </button>
        )}
        <button
          onClick={() => setActiveTab('music')}
          className={`pb-3 -mb-px text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'music' ? `${textHighlight} ${borderAccentClass}` : `${textMuted} border-transparent hover:text-main`
          }`}
        >
          Services Musicaux
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`pb-3 -mb-px text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'account' ? `${textHighlight} ${borderAccentClass}` : `${textMuted} border-transparent hover:text-main`
          }`}
        >
          Mon Compte
        </button>
      </div>

      {activeTab === 'profile' ? (
        <AthleticProfilePanel theme={theme} showToast={showToast} changeView={changeView} />
      ) : activeTab === 'music' ? (
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

          {/* Aide au dépannage "redirect_uri: Not matching configuration" —
              n'apparaît que tant que Spotify n'est pas connecté. */}
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
      ) : (
        <div className="space-y-8">
          {/* Bloc 1 — Informations & Sécurité (Refactor UI, 28/07 puis
              28/07 suite, "passe Boy-Scout") : e-mail et mot de passe
              partagent maintenant EXACTEMENT le même design (style neutre
              `inputBorder`/`inputBg`, avatar `textMuted` + fond discret,
              bouton "Modifier" identique) — la carte email avait avant un
              style distinct (vert, icône crayon, bouton "Déconnecter" —
              redondant avec l'avatar du header qui fait déjà ça) sans
              raison fonctionnelle de différer de la carte mot de passe. */}
          {(user || !isSupabaseConfigured) && (
          <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
            <h3 className={`font-bold text-xl mb-2 ${textHighlight}`}>Informations & Sécurité</h3>
            <p className={`text-sm mb-6 line-clamp-1 ${textMuted}`}>Gère tes identifiants d'accès et la sécurité de ton compte.</p>

            {!isSupabaseConfigured ? (
              <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} text-sm ${textMuted}`}>
                Comptes pas encore configurés côté serveur.
              </div>
            ) : user ? (
              <>
                {/* Pseudonyme — Feature (28/07, "identifiant public
                    immuable"). Placé EN PREMIER, au-dessus de l'e-mail
                    (même logique que le brief : l'identité publique avant
                    les identifiants de connexion). 3 états distincts :
                    (1) en cours de vérification (`usernameLoading`) — rien
                    n'est affiché plutôt qu'un flash "aucun pseudonyme"
                    trompeur le temps de la requête ; (2) déjà défini — un
                    badge "Non modifiable" (cadenas) à la place du bouton
                    "Modifier", pour matérialiser l'immuabilité aussi
                    explicitement que le demande le brief ; (3) compte
                    existant SANS pseudonyme (créé avant cette
                    fonctionnalité, voir "rétrocompatibilité") — un
                    formulaire de définition, permis UNE SEULE fois (le
                    verrou réel vit côté serveur, voir AuthContext.jsx/
                    supabase-schema.sql — ceci n'est qu'un reflet côté UI). */}
                {!usernameLoading && (
                  username ? (
                    <div className={`flex items-center justify-between p-4 rounded-2xl border ${inputBorder} ${inputBg} mb-3`}>
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5`}>
                          <AtSign size={22} />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-bold text-lg truncate ${textHighlight}`}>@{username}</h4>
                          <p className={`text-sm ${textMuted}`}>Pseudonyme</p>
                        </div>
                      </div>
                      <div className={`shrink-0 ml-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${textMuted}`} title="Le pseudonyme est définitif, il ne peut plus être modifié.">
                        <Lock size={14} /> Non modifiable
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl border ${inputBorder} ${inputBg} mb-3`}>
                      <div className="flex items-center space-x-4 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5`}>
                          <AtSign size={22} />
                        </div>
                        <div>
                          <h4 className={`font-bold text-lg ${textHighlight}`}>Choisis ton pseudonyme</h4>
                          <p className={`text-sm ${textMuted}`}>Ton compte a été créé avant cette fonctionnalité — définis-le maintenant (une seule fois, définitif).</p>
                        </div>
                      </div>
                      <form onSubmit={handleUsernameFormSubmit} className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-0 ${
                          usernameFieldStatus === 'taken' || usernameFieldStatus === 'invalid' ? 'border-red-500' :
                          usernameFieldStatus === 'available' ? 'border-green-500' : inputBorder
                        } ${inputBg}`}>
                          <span className={textMuted}>@</span>
                          <input
                            type="text" autoComplete="off" placeholder="alex_runner"
                            value={usernameField}
                            onChange={e => { setUsernameFieldValue(e.target.value.toLowerCase()); setUsernameFieldStatus(null); setUsernameFieldError(''); }}
                            onBlur={handleUsernameFieldBlur}
                            className={`flex-1 min-w-0 bg-transparent outline-none text-sm ${textHighlight}`}
                          />
                          {usernameFieldStatus === 'checking' && <Loader2 size={14} className={`animate-spin ${textMuted}`}/>}
                        </div>
                        <button
                          type="submit" disabled={usernameSubmitting}
                          className="shrink-0 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-60 text-sm"
                        >
                          Valider
                        </button>
                      </form>
                      <p className={`text-xs mt-1.5 ${
                        usernameFieldStatus === 'taken' || usernameFieldStatus === 'invalid' ? 'text-red-500' :
                        usernameFieldStatus === 'available' ? 'text-green-500' : textMuted
                      }`}>
                        {usernameFieldError || (
                          usernameFieldStatus === 'taken' ? 'Ce pseudonyme est déjà pris.'
                          : usernameFieldStatus === 'invalid' ? '3 à 20 caractères : minuscules, chiffres, underscore.'
                          : usernameFieldStatus === 'available' ? 'Disponible !'
                          : 'Définitif — impossible à modifier ensuite.'
                        )}
                      </p>
                    </div>
                  )
                )}

                <div className={`flex items-center justify-between p-4 rounded-2xl border ${inputBorder} ${inputBg}`}>
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5`}>
                      <UserIcon size={22} />
                    </div>
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
                        <h4 className={`font-bold text-lg truncate ${textHighlight}`}>{user.email}</h4>
                        <p className={`text-sm ${textMuted}`}>Adresse e-mail</p>
                      </div>
                    )}
                  </div>
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
                    <button onClick={startEditingEmail} className={`shrink-0 ml-3 px-4 py-2 ${textMuted} hover:text-main hover:bg-surface-hover font-bold rounded-lg transition-all`}>
                      Modifier
                    </button>
                  )}
                </div>
                {emailUpdateSent && (
                  <p className="text-emerald-400 text-xs sm:text-sm mt-3">
                    Un e-mail de confirmation a été envoyé à la nouvelle adresse pour valider le changement.
                  </p>
                )}

                {/* Mot de passe — même principe que l'e-mail juste au-
                    dessus : ligne au repos avec bouton "Modifier",
                    formulaire inline à 2 champs (nouveau + confirmation)
                    au clic. */}
                <div className={`flex items-center justify-between p-4 rounded-2xl border ${inputBorder} ${inputBg} mt-3`}>
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5`}>
                      <Key size={22} />
                    </div>
                    {isChangingPassword ? (
                      <form onSubmit={handlePasswordSubmit} className="min-w-0 flex-1 space-y-1.5">
                        <input
                          type="password" autoFocus autoComplete="new-password" placeholder="Nouveau mot de passe"
                          value={newPassword} onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                          className={`w-full px-3 py-1.5 rounded-lg border ${inputBorder} ${inputBg} font-medium ${textHighlight} outline-none`}
                        />
                        <input
                          type="password" autoComplete="new-password" placeholder="Confirme le nouveau mot de passe"
                          value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                          className={`w-full px-3 py-1.5 rounded-lg border ${inputBorder} ${inputBg} font-medium ${textHighlight} outline-none`}
                        />
                        {passwordError && <p className="text-xs font-semibold text-red-500">{passwordError}</p>}
                      </form>
                    ) : (
                      <div className="min-w-0">
                        <h4 className={`font-bold text-lg ${textHighlight}`}>Mot de passe</h4>
                        <p className={`text-sm ${textMuted}`}>••••••••</p>
                      </div>
                    )}
                  </div>
                  {isChangingPassword ? (
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button onClick={cancelChangingPassword} title="Annuler" className={`p-2.5 rounded-lg ${textMuted} hover:text-main hover:bg-surface-hover transition-colors`}>
                        <X size={18}/>
                      </button>
                      <button
                        onClick={handlePasswordSubmit} disabled={passwordSubmitting}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-60 flex items-center gap-1.5"
                      >
                        <Check size={16}/> Enregistrer
                      </button>
                    </div>
                  ) : (
                    <button onClick={startChangingPassword} className={`shrink-0 ml-3 px-4 py-2 ${textMuted} hover:text-main hover:bg-surface-hover font-bold rounded-lg transition-all`}>
                      Modifier
                    </button>
                  )}
                </div>
                {passwordUpdated && (
                  <p className="text-emerald-400 text-xs sm:text-sm mt-3">Mot de passe mis à jour.</p>
                )}
              </>
            ) : null}
          </div>
          )}

          {/* Bloc 2 — Données personnelles (RGPD, portabilité) — NOUVEAU.
              Uniquement pour un utilisateur connecté (rien à exporter en
              mode invité, tout reste déjà local sur son appareil). */}
          {user && (
            <div className={`${cardBg} rounded-3xl p-6 md:p-8 border ${cardBorder} shadow-xl`}>
              <h3 className={`font-bold text-xl mb-2 ${textHighlight}`}>Données personnelles</h3>
              <p className={`text-sm mb-4 ${textMuted}`}>
                Télécharge une copie de toutes tes données synchronisées (favoris, routines, statistiques, profil athlétique).
              </p>
              <button
                onClick={handleExportData} disabled={isExporting}
                className={`px-4 py-2.5 rounded-lg border ${inputBorder} ${inputBg} font-bold text-sm ${textHighlight} hover:bg-surface-hover transition-all disabled:opacity-60 flex items-center gap-2`}
              >
                <Download size={16}/> {isExporting ? 'Export en cours…' : 'Exporter mes données (JSON)'}
              </button>
              {exportError && <p className="text-xs font-semibold text-red-500 mt-2">{exportError}</p>}
            </div>
          )}

          {/* Bloc 3 — Zone dangereuse (RGPD, droit à l'effacement) —
              NOUVEAU. ⚠️ Wording DÉLIBÉRÉMENT "Effacer mes données" plutôt
              que "Supprimer mon compte" (demandé initialement) : voir
              `eraseUserData` dans AuthContext.jsx — cette action efface
              réellement toutes les données synchronisées côté serveur,
              mais ne supprime PAS (pas encore) le compte `auth.users`
              lui-même (limite technique assumée, une vraie suppression de
              compte demande une Supabase Edge Function avec la clé
              "service_role", absente de ce projet). Employer le mot
              "compte" ici aurait promis plus que ce que ce bouton fait
              réellement — mieux vaut un intitulé honnête qu'une conformité
              RGPD en trompe-l'œil. */}
          {user && (
            <div className="rounded-3xl p-6 md:p-8 border border-red-500/40 bg-red-500/5">
              <h3 className="font-bold text-xl mb-2 text-red-500">Zone dangereuse</h3>
              <p className={`text-sm mb-4 ${textMuted}`}>
                Efface définitivement toutes tes données synchronisées de nos serveurs et te déconnecte. Cette action est irréversible.
              </p>
              <button
                onClick={() => { setDeleteError(''); setIsConfirmingDelete(true); }}
                className="px-4 py-2.5 rounded-lg border border-red-500 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-all flex items-center gap-2"
              >
                <Trash2 size={16}/> Effacer mes données
              </button>
            </div>
          )}

          {isConfirmingDelete && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={() => !isDeleting && setIsConfirmingDelete(false)}
            >
              <div
                className={`${cardBg} rounded-2xl border ${cardBorder} shadow-xl max-w-md w-full p-6`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-lg text-red-500 mb-2">Confirmer l'effacement</h3>
                <p className={`text-sm ${textMuted} mb-4`}>
                  Toutes tes données synchronisées (favoris, routines, statistiques, profil athlétique) seront définitivement supprimées de nos serveurs, et tu seras déconnecté·e. Ton adresse e-mail reste enregistrée pour l'instant (limite technique actuelle) — contacte-nous si tu veux aussi la faire supprimer.
                </p>
                {deleteError && <p className="text-xs font-semibold text-red-500 mb-3">{deleteError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsConfirmingDelete(false)} disabled={isDeleting}
                    className={`px-4 py-2 rounded-lg font-bold text-sm ${textMuted} hover:bg-surface-hover transition-all disabled:opacity-60`}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmDelete} disabled={isDeleting}
                    className="px-4 py-2 rounded-lg font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-60"
                  >
                    {isDeleting ? 'Suppression…' : 'Oui, effacer mes données'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
