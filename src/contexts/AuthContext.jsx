import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

/**
 * AuthContext — session utilisateur Supabase (email/mot de passe pour
 * commencer, voir la discussion qui a mené à ce chantier — le social login
 * viendra dans un second temps, sans tout reprendre).
 *
 * Pourquoi un Context et pas des props explicites depuis App.jsx (contrairement
 * à la philosophie affichée ailleurs, ex. SettingsView.jsx : "ne lit/écrit
 * aucun state global directement, tout passe par des props") : ce state est
 * nécessaire à `usePersistentState.js`, un hook de bas niveau appelé
 * INDIRECTEMENT par 6 autres hooks (useFavorites, useRoutines,
 * useAthleticProfile, useUserStats...), eux-mêmes appelés dans App.jsx. Le
 * threader en props explicites aurait voulu changer la signature de ces 6
 * hooks + leurs appels dans App.jsx pour une seule variable transversale —
 * bien plus invasif que ce que le Context résout ici en un seul fichier.
 * Les composants de VUE (SettingsView, AuthModal...) continuent de recevoir
 * l'état d'auth par props comme avant, pour rester "dumb"/testables — seul
 * `usePersistentState.js` lit ce Context directement.
 *
 * `isSupabaseConfigured` vaut `false` tant que VITE_SUPABASE_URL/
 * VITE_SUPABASE_ANON_KEY ne sont pas renseignées (voir supabaseClient.js) —
 * dans ce cas, tout ici devient un no-op silencieux : l'app doit rester
 * utilisable EXACTEMENT comme avant (localStorage seul, mode invité) sans
 * configuration Supabase, les comptes sont un ajout, jamais une dépendance dure.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Vrai tant qu'on n'a pas encore vérifié s'il existe une session déjà
  // active (ex. l'utilisateur avait déjà coché "rester connecté" la dernière
  // fois) — évite un "flash" où l'app croit un instant que personne n'est
  // connecté avant de découvrir le contraire.
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Réagit à TOUTE connexion/déconnexion/rafraîchissement de session,
    // d'où qu'ils viennent (ex. le token a expiré et Supabase l'a renouvelé
    // tout seul en arrière-plan) — pas seulement les appels signIn/signOut
    // explicites ci-dessous.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? error.message : null };
  };

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signUp, signIn, signOut, isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

// Valeurs de repli si jamais utilisé hors d'un <AuthProvider> (ne devrait pas
// arriver, main.jsx l'enveloppe autour de <App/> — mais évite un plantage
// plutôt qu'un écran blanc si jamais un composant est testé isolément).
const FALLBACK = {
  user: null, authLoading: false, isSupabaseConfigured: false,
  signUp: async () => ({ error: "AuthProvider manquant." }),
  signIn: async () => ({ error: "AuthProvider manquant." }),
  signOut: async () => {},
};

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  return ctx || FALLBACK;
}
