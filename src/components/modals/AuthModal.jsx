import { useState } from 'react';
import { X, User, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

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
 */
export default function AuthModal({ theme, isAuthModalOpen, setIsAuthModalOpen, signUp, signIn, showToast }) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const resetFields = () => {
    setErrorMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const close = () => {
    setIsAuthModalOpen(false);
    resetFields();
  };

  const switchMode = () => {
    setMode(mode === 'signup' ? 'signin' : 'signup');
    resetFields();
  };

  const handleSubmit = async (e) => {
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
            <span>{mode === 'signup' ? 'Créer un compte' : 'Se connecter'}</span>
          </h3>
          <button onClick={close} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${inputBorder} ${inputBg}`}>
            <Mail size={18} className={textMuted}/>
            <input
              type="email" autoComplete="email" placeholder="ton@email.com"
              value={email} onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
              className={`flex-1 bg-transparent outline-none ${textHighlight}`}
            />
          </div>

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
      </div>
    </div>
  );
}
