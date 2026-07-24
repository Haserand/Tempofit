import { useState } from 'react';
import { X, User, Mail, Lock, Loader2, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';

/**
 * AuthModal — connexion/inscription par e-mail + mot de passe (voir la
 * discussion qui a mené à ce chantier : le social login viendra dans un
 * second temps, sans reprendre cette base). Même gabarit visuel que les
 * autres modales de l'app (ShareModal.jsx notamment) — carte centrée,
 * overlay flouté, croix de fermeture en haut à droite.
 *
 * "Dumb" comme les autres vues/modales (voir SettingsView.jsx) : ne touche
 * pas directement à Supabase, appelle `signUp`/`signIn` reçus en props
 * (fournis par App.jsx via useAuthContext) et affiche le résultat.
 *
 * RETOUR DIRECT ("d'habitude y a une confirmation du mot de passe, et un
 * bouton pour voir les caractères") — 2 ajouts standards manquants au 1er
 * jet : `confirmPassword` (uniquement en mode inscription — se connecter
 * n'a rien à confirmer, le mot de passe existe déjà) et un bouton
 * afficher/masquer sur CHAQUE champ mot de passe (le principal ET la
 * confirmation, pas juste l'un des deux).
 *
 * RETOUR DIRECT ("aucun moyen de récupérer son compte en cas d'oubli") —
 * 3e mode ajouté (`mode: 'signin' | 'signup' | 'forgot'`, contre 2 avant) :
 * `resetPassword` (reçue en prop, même convention que signUp/signIn — voir
 * AuthContext.jsx) déclenche l'envoi Supabase du lien de réinitialisation.
 * `email` est PARTAGÉ entre les 3 modes (pas un 2e state dédié) : le brief
 * demandait explicitement l'e-mail pré-rempli si déjà saisi en arrivant sur
 * ce mode depuis le formulaire de connexion — réutiliser le même state fait
 * ça gratuitement, sans logique de pré-remplissage à écrire à part.
 */
export default function AuthModal({ theme, isAuthModalOpen, setIsAuthModalOpen, signUp, signIn, resetPassword, showToast }) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Distinct de `errorMsg` (rouge) : confirmation de succès en mode 'forgot'
  // UNIQUEMENT (pas de raison de la partager avec signin/signup, qui ferment
  // déjà la modale sur succès — voir handleSubmit). Remise à `false` à tout
  // changement de mode (resetFields), jamais laissée affichée après coup.
  const [resetEmailSent, setResetEmailSent] = useState(false);

  if (!isAuthModalOpen) return null;

  const resetFields = () => {
    setErrorMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setResetEmailSent(false);
  };

  const close = () => {
    setIsAuthModalOpen(false);
    setMode('signin');
    resetFields();
  };

  const switchMode = () => {
    setMode(mode === 'signup' ? 'signin' : 'signup');
    resetFields();
  };

  // Passe en mode "mot de passe oublié" — `email` n'est PAS réinitialisé
  // (voir la docstring : pré-rempli avec ce qui a déjà été saisi en
  // connexion, c'est tout l'intérêt de partager le même state).
  const goToForgotMode = () => {
    setMode('forgot');
    resetFields();
  };

  const backToSignin = () => {
    setMode('signin');
    resetFields();
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Renseigne ton e-mail.');
      return;
    }
    setSubmitting(true);
    const { error } = await resetPassword(email.trim());
    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
      return;
    }
    // Reste sur cette vue (pas de `close()`) — contrairement à
    // signin/signup, l'action n'est pas "terminée" pour l'utilisateur tant
    // qu'il n'a pas suivi le lien reçu par e-mail ; fermer la modale ici
    // couperait court à cette confirmation visible.
    setResetEmailSent(true);
  };

  const handleSubmit = async (e) => {
    if (mode === 'forgot') { handleForgotSubmit(e); return; }
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Renseigne un e-mail et un mot de passe.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Les 2 mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const { error } = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
      return;
    }

    if (mode === 'signup') {
      // RETOUR DIRECT (à vérifier une fois Supabase réellement configuré) :
      // selon les réglages du projet Supabase (Authentication → Providers →
      // Email → "Confirm email"), l'inscription peut nécessiter un clic de
      // confirmation reçu par e-mail avant la 1re connexion réelle — d'où ce
      // message volontairement prudent plutôt qu'un "Compte créé, tu es
      // connecté" qui pourrait être faux selon ce réglage.
      showToast("✅ Compte créé — vérifie ta boîte mail si une confirmation est demandée.");
    } else {
      showToast("✅ Connecté !");
    }
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={close}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <User className={textColorClass}/>
            <span>{mode === 'forgot' ? 'Réinitialiser le mot de passe' : mode === 'signup' ? 'Créer un compte' : 'Se connecter'}</span>
          </h3>
          <button onClick={close} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>

        {/* Mode 'forgot' — vue dédiée, e-mail seul (pré-rempli si déjà saisi
            en connexion, voir la docstring) : soit le formulaire d'envoi,
            soit la confirmation de succès une fois l'e-mail parti (les 2 ne
            sont jamais visibles en même temps — `resetEmailSent` bascule
            entre les deux, pas d'accumulation). */}
        {mode === 'forgot' ? (
          resetEmailSent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-green-500/40 bg-green-500/10">
                <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5"/>
                <p className="text-sm font-semibold text-green-500">E-mail envoyé ! Vérifie ta boîte de réception (et tes spams) pour le lien de réinitialisation.</p>
              </div>
              <button
                onClick={backToSignin}
                className={`w-full py-3 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-1.5`}
              >
                <ArrowLeft size={16}/> Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              <p className={`text-sm mb-4 ${textMuted}`}>Saisis ton e-mail pour recevoir un lien de réinitialisation.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                  <Mail size={18} className={textMuted}/>
                  <input
                    type="email" autoComplete="email" placeholder="ton@email.com" autoFocus
                    value={email} onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                    className={`flex-1 bg-transparent outline-none ${textHighlight}`}
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm font-semibold text-red-500">{errorMsg}</p>
                )}

                <button
                  type="submit" disabled={submitting}
                  className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${bgAccentClass}`}
                >
                  {submitting && <Loader2 size={18} className="animate-spin"/>}
                  <span>Envoyer le lien</span>
                </button>
              </form>

              <button
                onClick={backToSignin}
                className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-1.5`}
              >
                <ArrowLeft size={16}/> Retour à la connexion
              </button>
            </>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                <Mail size={18} className={textMuted}/>
                <input
                  type="email" autoComplete="email" placeholder="ton@email.com"
                  value={email} onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                  className={`flex-1 bg-transparent outline-none ${textHighlight}`}
                />
              </div>

              <div>
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                  <Lock size={18} className={textMuted}/>
                  <input
                    type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="Mot de passe"
                    value={password} onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                    className={`flex-1 bg-transparent outline-none ${textHighlight}`}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} title={showPassword ? 'Masquer' : 'Afficher'} className={`${textMuted} hover:text-main transition-colors`}>
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                {/* "Mot de passe oublié ?" — SEULEMENT en connexion (mode
                    'signin') : à l'inscription il n'y a par définition pas
                    encore de mot de passe existant à récupérer. */}
                {mode === 'signin' && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button" onClick={goToForgotMode}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
              </div>

              {/* Confirmation UNIQUEMENT à l'inscription — se connecter n'a rien à
                  confirmer, le mot de passe existe déjà côté Supabase. Partage
                  `showPassword` avec le champ principal : pas de raison de
                  pouvoir afficher l'un et pas l'autre, c'est le même mot de passe. */}
              {mode === 'signup' && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                  <Lock size={18} className={textMuted}/>
                  <input
                    type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirme ton mot de passe"
                    value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                    className={`flex-1 bg-transparent outline-none ${textHighlight}`}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} title={showPassword ? 'Masquer' : 'Afficher'} className={`${textMuted} hover:text-main transition-colors`}>
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              )}

              {errorMsg && (
                <p className="text-sm font-semibold text-red-500">{errorMsg}</p>
              )}

              <button
                type="submit" disabled={submitting}
                className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${bgAccentClass}`}
              >
                {submitting && <Loader2 size={18} className="animate-spin"/>}
                <span>{mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</span>
              </button>
            </form>

            <button
              onClick={switchMode}
              className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors`}
            >
              {mode === 'signup' ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
