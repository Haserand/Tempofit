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
  // RETOUR DIRECT ("un petit compteur discret, visible seulement une fois
  // connecté") — nombre total de comptes créés (voir
  // supabase-user-count.sql, `get_registered_users_count`, une fonction
  // dédiée qui ne renvoie QUE ce nombre, jamais de données personnelles).
  // `null` = pas encore récupéré (ou déconnecté) ; distinct de `0`, un
  // nombre valide en soi.
  const [userCount, setUserCount] = useState(null);

  // Pseudonyme public, unique et IMMUABLE (Feature, 28/07) — voir
  // supabase-schema.sql (`profiles`, contrainte `unique` réelle côté
  // Postgres, pas juste une convention côté client) pour le pourquoi d'une
  // table dédiée plutôt qu'une entrée `user_data` de plus.
  // `null` = pas encore récupéré/déconnecté ; `''` (chaîne vide) ne sert
  // jamais ici — soit un pseudonyme existe (chaîne non vide), soit aucun
  // (voir `usernameLoading`, qui distingue "en cours de vérification" de
  // "vérifié, aucun pseudonyme trouvé" — SettingsView.jsx a besoin de cette
  // distinction pour ne pas proposer le formulaire de 1re définition trop
  // tôt, avant même d'avoir fini de vérifier si un pseudonyme existe déjà).
  const [username, setUsernameState] = useState(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) { setUsernameState(null); setUsernameLoading(false); return; }

    let cancelled = false;
    setUsernameLoading(true);

    (async () => {
      const { data, error } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;

      if (!error && data?.username) {
        setUsernameState(data.username);
        setUsernameLoading(false);
        return;
      }

      // Aucun profil trouvé — synchronise depuis `user_metadata.username`
      // (déposé au moment de `signUp`, voir plus bas) si un pseudonyme
      // était en attente. Couvre le cas où l'inscription exigeait une
      // confirmation par e-mail avant la 1re vraie session : au moment de
      // `signUp`, `auth.uid()` n'existait pas encore côté RLS, l'insertion
      // dans `profiles` n'a donc pu se faire qu'ICI, une fois la session
      // réellement établie.
      const pendingUsername = user.user_metadata?.username;
      if (pendingUsername) {
        const { error: insertError } = await supabase.from('profiles').insert({ user_id: user.id, username: pendingUsername });
        if (cancelled) return;
        // Échec possible (rare) : quelqu'un d'autre a pris ce pseudonyme
        // entre l'inscription et cette synchronisation (contrainte `unique`
        // qui refuse l'insertion). Pas de recours automatique ici — reste
        // simplement `null`, ce qui fait retomber la personne sur le même
        // formulaire de 1re définition que les comptes créés avant cette
        // fonctionnalité (voir `setUsername` plus bas) : elle en choisit un
        // autre, disponible celui-là.
        setUsernameState(insertError ? null : pendingUsername);
      } else {
        setUsernameState(null);
      }
      setUsernameLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Vérifie si un pseudonyme est déjà pris — utilisée à la fois par
  // AuthModal.jsx (avant l'inscription) et SettingsView.jsx (fallback
  // comptes existants). Lecture PUBLIQUE (RLS `for select using (true)`,
  // voir supabase-schema.sql) : fonctionne même AVANT toute connexion,
  // avec la seule clé "anon".
  const checkUsernameAvailable = async (candidate) => {
    if (!isSupabaseConfigured) return { available: false, error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { data, error } = await supabase.from('profiles').select('user_id').eq('username', candidate).maybeSingle();
    if (error) return { available: false, error: error.message };
    return { available: !data, error: null };
  };

  // Regex PARTAGÉE avec AuthModal.jsx/SettingsView.jsx (voir leur propre
  // validation) — revérifiée ici en dernier rempart avant tout appel
  // réseau, un utilisateur ne devrait jamais atteindre ce point avec un
  // format invalide, mais un formulaire n'est pas la seule porte d'entrée
  // possible vers ces fonctions.
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

  // Définition du pseudonyme pour un compte EXISTANT sans pseudonyme
  // (comptes créés avant cette fonctionnalité — voir le brief,
  // "rétrocompatibilité"). Une seule fois : refuse d'emblée si `username`
  // (le state ci-dessus) est déjà renseigné — immutabilité en profondeur,
  // en plus de l'absence de policy `update` côté Postgres (voir
  // supabase-schema.sql) et de l'absence de bouton "Modifier" côté UI.
  const setUsername = async (candidate) => {
    if (!isSupabaseConfigured || !user) return { error: "Non connecté." };
    if (username) return { error: "Un pseudonyme est déjà défini pour ce compte — il ne peut pas être changé." };
    if (!USERNAME_REGEX.test(candidate)) return { error: "3 à 20 caractères : minuscules, chiffres et underscore uniquement." };

    const { available, error: checkError } = await checkUsernameAvailable(candidate);
    if (checkError) return { error: checkError };
    if (!available) return { error: "Ce pseudonyme est déjà pris." };

    const { error } = await supabase.from('profiles').insert({ user_id: user.id, username: candidate });
    if (error) return { error: error.code === '23505' ? "Ce pseudonyme vient d'être pris par quelqu'un d'autre." : error.message };
    setUsernameState(candidate);
    return { error: null };
  };

  // `signUp` — `username` maintenant obligatoire (voir le brief,
  // "pseudonyme unique immuable à l'inscription"), déposé dans
  // `options.data.username` (`user_metadata`, toujours possible même sans
  // session active — contrairement à une insertion directe dans
  // `profiles`, qui elle exige `auth.uid()` pour passer la policy RLS, donc
  // une session RÉELLEMENT établie ; voir le useEffect de synchronisation
  // plus haut pour la suite). Revalidation format + disponibilité ICI,
  // même si AuthModal.jsx la fait déjà avant d'appeler cette fonction —
  // dernier rempart, pas une redite superflue.
  const signUp = async (email, password, usernameCandidate) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    if (!USERNAME_REGEX.test(usernameCandidate || '')) {
      return { error: "Pseudonyme invalide : 3 à 20 caractères, minuscules/chiffres/underscore uniquement." };
    }
    const { available, error: checkError } = await checkUsernameAvailable(usernameCandidate);
    if (checkError) return { error: checkError };
    if (!available) return { error: "Ce pseudonyme est déjà pris." };

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username: usernameCandidate } },
    });
    if (error) return { error: error.message };

    // Session immédiate (confirmation par e-mail désactivée côté projet
    // Supabase) : `auth.uid()` est déjà utilisable, on peut synchroniser
    // `profiles` tout de suite plutôt que d'attendre le useEffect (qui de
    // toute façon le referait au prochain rendu — mais autant ne pas
    // dépendre de ce timing si `data.session` est déjà là).
    if (data?.session && data?.user) {
      const { error: insertError } = await supabase.from('profiles').insert({ user_id: data.user.id, username: usernameCandidate });
      if (!insertError) setUsernameState(usernameCandidate);
    }
    return { error: null };
  };

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

  // Récupère le nombre de comptes UNIQUEMENT une fois connecté (la fonction
  // RPC elle-même refuse déjà les appels non authentifiés côté serveur, voir
  // supabase-user-count.sql — ce `if (!user)` évite juste un appel réseau
  // inutile qu'on sait voué à échouer). Remis à `null` à la déconnexion,
  // plutôt que de laisser un chiffre affiché qui ne devrait plus l'être.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) { setUserCount(null); return; }
    supabase.rpc('get_registered_users_count').then(({ data, error }) => {
      if (!error && typeof data === 'number') setUserCount(data);
    });
  }, [user]);

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  };

  // "Mot de passe oublié" (retour direct) — même convention EXACTE que
  // signUp/signIn ci-dessus : garde `isSupabaseConfigured`, renvoie
  // `{ error }` (jamais lève une exception), jamais de logique Supabase en
  // dehors de ce contexte (AuthModal.jsx reste "dumb", ne fait qu'appeler
  // cette fonction reçue en prop). Supabase envoie lui-même l'e-mail
  // contenant le lien de réinitialisation — rien à construire ici, juste
  // déclencher l'envoi.
  const resetPassword = async (email) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? error.message : null };
  };

  // Modifier l'adresse e-mail (retour direct, "aucun moyen de modifier son
  // e-mail dans Options & Comptes") — même convention encore une fois :
  // `supabase.auth.updateUser` envoie lui-même un e-mail de confirmation à
  // la NOUVELLE adresse (comportement par défaut du projet Supabase,
  // "Secure email change" — l'ancienne adresse reste active tant que ce
  // lien n'a pas été suivi) ; `user` (le state de ce contexte) ne se met à
  // jour QUE via `onAuthStateChange` une fois ce lien confirmé, jamais de
  // façon optimiste ici — SettingsView.jsx affiche donc encore l'ancienne
  // adresse jusque-là, ce qui est le comportement honnête à afficher.
  const updateEmail = async (newEmail) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error ? error.message : null };
  };

  // Changer de mot de passe (Refactor UI, 28/07, "Réglages — Mon Compte")
  // — même convention que updateEmail : `supabase.auth.updateUser` gère
  // tout lui-même côté serveur, aucune vérification manuelle de l'ancien
  // mot de passe ici (Supabase l'exige déjà via la session active — un
  // utilisateur qui n'est PAS authentifié ne peut pas atteindre cet appel).
  const updatePassword = async (newPassword) => {
    if (!isSupabaseConfigured) return { error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  };

  // Export RGPD (portabilité, Refactor UI, 28/07) — récupère TOUTES les
  // lignes `user_data` de l'utilisateur connecté (favoris, routines, stats,
  // profil athlétique, thème... tout ce que usePersistentState.js
  // synchronise, voir supabase-schema.sql) sous forme d'un objet
  // { clé: valeur } prêt à être sérialisé en JSON côté SettingsView.jsx —
  // strictement une LECTURE (RLS déjà en place, un utilisateur ne peut lire
  // que ses propres lignes, `eq('user_id', ...)` ici est une garde
  // supplémentaire côté client, pas la vraie protection).
  const exportUserData = async () => {
    if (!isSupabaseConfigured || !user) return { data: null, error: "Non connecté." };
    const { data, error } = await supabase.from('user_data').select('key, value').eq('user_id', user.id);
    if (error) return { data: null, error: error.message };
    const asObject = Object.fromEntries(data.map(row => [row.key, row.value]));
    return { data: asObject, error: null };
  };

  // Effacement RGPD (droit à l'oubli, Refactor UI, 28/07) — ⚠️ LIMITE
  // ASSUMÉE, à traiter avant de considérer ce chantier terminé : ceci
  // efface TOUTES les lignes `user_data` de l'utilisateur (favoris,
  // routines, stats, profil athlétique...) puis déconnecte — c'est la
  // partie réellement possible avec uniquement la clé "anon" (RLS autorise
  // déjà un utilisateur à supprimer ses propres lignes, voir
  // supabase-schema.sql). Ça N'EFFACE PAS le compte `auth.users` lui-même
  // (email, mot de passe) : supprimer une ligne `auth.users` demande la
  // clé "service_role" (jamais exposée côté client, voir supabaseClient.js)
  // — en pratique, une Supabase Edge Function dédiée appelant
  // `supabase.auth.admin.deleteUser(userId)`, qui N'EXISTE PAS ENCORE dans
  // ce projet. Tant que cette fonction serveur n'est pas créée, ce bouton
  // n'offre qu'un "effacement des données", pas une vraie suppression de
  // compte au sens RGPD strict (l'email resterait enregistré et
  // réutilisable pour se reconnecter) — SettingsView.jsx doit rester
  // honnête là-dessus dans son wording, pas prétendre l'inverse.
  const eraseUserData = async () => {
    if (!isSupabaseConfigured || !user) return { error: "Non connecté." };
    const { error } = await supabase.from('user_data').delete().eq('user_id', user.id);
    if (error) return { error: error.message };
    await signOut();
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signUp, signIn, signOut, resetPassword, updateEmail, updatePassword, exportUserData, eraseUserData, isSupabaseConfigured, userCount, username, usernameLoading, checkUsernameAvailable, setUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

// Valeurs de repli si jamais utilisé hors d'un <AuthProvider> (ne devrait pas
// arriver, main.jsx l'enveloppe autour de <App/> — mais évite un plantage
// plutôt qu'un écran blanc si jamais un composant est testé isolément).
const FALLBACK = {
  user: null, authLoading: false, isSupabaseConfigured: false, userCount: null,
  username: null, usernameLoading: false,
  signUp: async () => ({ error: "AuthProvider manquant." }),
  signIn: async () => ({ error: "AuthProvider manquant." }),
  signOut: async () => {},
  resetPassword: async () => ({ error: "AuthProvider manquant." }),
  updateEmail: async () => ({ error: "AuthProvider manquant." }),
  updatePassword: async () => ({ error: "AuthProvider manquant." }),
  exportUserData: async () => ({ data: null, error: "AuthProvider manquant." }),
  eraseUserData: async () => ({ error: "AuthProvider manquant." }),
  checkUsernameAvailable: async () => ({ available: false, error: "AuthProvider manquant." }),
  setUsername: async () => ({ error: "AuthProvider manquant." }),
};

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  return ctx || FALLBACK;
}
