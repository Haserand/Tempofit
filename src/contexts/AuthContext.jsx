import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { USERNAME_REGEX, isReservedUsername, RESERVED_USERNAME_ERROR } from '../utils/username';

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

  // Profil public (Feature, 01/08, "Confidentialité & Profil Public") —
  // avatar + 3 bascules de confidentialité, récupérées EN MÊME TEMPS que le
  // pseudonyme ci-dessus (même ligne `profiles`, pas une 2e requête réseau
  // séparée). `null` = pas encore récupéré/déconnecté, comme `username` —
  // une fois récupéré, toujours un objet complet (jamais partiellement
  // rempli), les 3 bascules valant `false` par défaut côté base (voir
  // `not null default false`, supabase-schema.sql) donc jamais `undefined`
  // ici non plus.
  const [profilePrivacy, setProfilePrivacy] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) { setUsernameState(null); setProfilePrivacy(null); setUsernameLoading(false); return; }

    let cancelled = false;
    setUsernameLoading(true);

    (async () => {
      const { data, error } = await supabase.from('profiles')
        .select('username, avatar_url, is_profile_public, show_sport_stats, show_intimate_stats, default_playlist_public')
        .eq('user_id', user.id).maybeSingle();
      if (cancelled) return;

      if (!error && data?.username) {
        setUsernameState(data.username);
        setProfilePrivacy({
          avatarUrl: data.avatar_url ?? null,
          isProfilePublic: !!data.is_profile_public,
          showSportStats: !!data.show_sport_stats,
          showIntimateStats: !!data.show_intimate_stats,
          defaultPlaylistPublic: !!data.default_playlist_public,
        });
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
        // Ligne fraîchement créée : les 3 bascules valent forcément `false`
        // (défaut côté base) — inutile de relire, on le sait déjà.
        setProfilePrivacy(insertError ? null : { avatarUrl: null, isProfilePublic: false, showSportStats: false, showIntimateStats: false, defaultPlaylistPublic: false });
      } else {
        setUsernameState(null);
        setProfilePrivacy(null);
      }
      setUsernameLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Vérifie si un pseudonyme est déjà pris — utilisée à la fois par
  // AuthModal.jsx (avant l'inscription) et SettingsView.jsx (fallback
  // comptes existants).
  //
  // BUG ÉVITÉ (01/08, chantier "Profil public") — passait avant par une
  // lecture directe (`select user_id ... eq('username', ...)`), possible
  // uniquement parce que la policy SELECT de `profiles` était encore
  // `using (true)` (tout le monde peut tout lire). Cette policy vient
  // d'être resserrée à "soi-même OU is_profile_public" (voir
  // supabase-schema.sql) — une lecture directe aurait alors RENVOYÉ `null`
  // pour un pseudo pourtant déjà pris par un profil resté privé, laissant
  // croire à tort qu'il est disponible. Passe maintenant par
  // `is_username_available` (fonction Postgres dédiée, SECURITY DEFINER,
  // même principe que `get_registered_users_count` plus bas) : elle seule
  // contourne RLS pour cette vérification précise, et ne renvoie qu'un
  // booléen — jamais la ligne de profil elle-même.
  const checkUsernameAvailable = async (candidate) => {
    if (!isSupabaseConfigured) return { available: false, error: "Les comptes ne sont pas encore configurés côté serveur." };
    const { data, error } = await supabase.rpc('is_username_available', { candidate });
    if (error) return { available: false, error: error.message };
    return { available: data === true, error: null };
  };

  // Regex + vérification des pseudos réservés désormais PARTAGÉES
  // (src/utils/username.js, Correctif UX 02/08) avec AuthModal.jsx/
  // SettingsView.jsx — revérifiées ici en dernier rempart avant tout appel
  // réseau, un utilisateur ne devrait jamais atteindre ce point avec un
  // format invalide ou un pseudo réservé, mais un formulaire n'est pas la
  // seule porte d'entrée possible vers ces fonctions.

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
    if (isReservedUsername(candidate)) return { error: RESERVED_USERNAME_ERROR };

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
    if (isReservedUsername(usernameCandidate)) return { error: RESERVED_USERNAME_ERROR };
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

  // Mise à jour des bascules de confidentialité (Feature, 01/08,
  // "Confidentialité & Profil Public") — `fields` : un sous-ensemble de
  // `{ is_profile_public, show_sport_stats, show_intimate_stats }`, jamais
  // `username` (immuable, voir `prevent_username_change_trigger`,
  // supabase-schema.sql — même si quelqu'un l'incluait ici par erreur, la
  // base refuserait la modification, mais autant ne jamais lui en donner
  // l'occasion). Mise à jour OPTIMISTE de `profilePrivacy` après succès
  // (pas de refetch) — cohérent avec `setUsernameState(candidate)` juste
  // au-dessus dans `setUsername`, même principe déjà en place ici.
  const updatePrivacySettings = async (fields) => {
    if (!isSupabaseConfigured || !user) return { error: "Non connecté." };
    // BUG CORRIGÉ (01/08, suite — "le bouton reste bloqué après un 1er
    // clic") — try/catch ajouté ici en complément du try/finally côté
    // SettingsView.jsx (handleTogglePrivacy) : cohérent avec TOUTES les
    // autres fonctions de ce fichier (signUp/signIn/updateEmail/...),
    // aucune ne doit jamais laisser une exception s'échapper vers
    // l'appelant — toujours un `{ error }` renvoyé proprement, même en cas
    // de panne réseau inattendue.
    try {
      const { error } = await supabase.from('profiles').update(fields).eq('user_id', user.id);
      if (error) return { error: error.message };
      setProfilePrivacy(prev => ({
        avatarUrl: prev?.avatarUrl ?? null,
        isProfilePublic: fields.is_profile_public ?? prev?.isProfilePublic ?? false,
        showSportStats: fields.show_sport_stats ?? prev?.showSportStats ?? false,
        showIntimateStats: fields.show_intimate_stats ?? prev?.showIntimateStats ?? false,
        defaultPlaylistPublic: fields.default_playlist_public ?? prev?.defaultPlaylistPublic ?? false,
      }));
      return { error: null };
    } catch (e) {
      console.error('updatePrivacySettings a échoué :', e);
      return { error: e?.message || "Une erreur inattendue est survenue." };
    }
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

  // Suppression RÉELLE du compte (Edge Function, 29/07 — chantier en
  // suspens depuis la passation du 28/07, "vraie suppression de compte").
  // Remplace `eraseUserData`, qui n'effaçait que les lignes `user_data`
  // (favoris, routines, stats...) mais jamais le compte `auth.users`
  // lui-même — limite assumée à l'époque, documentée honnêtement dans
  // SettingsView.jsx ("Effacer mes données" plutôt que "Supprimer mon
  // compte"). Cette limite n'existe plus : appelle la Supabase Edge
  // Function `delete-account` (voir supabase/functions/delete-account/
  // index.ts), seule capable d'utiliser la clé "service_role" nécessaire à
  // `auth.admin.deleteUser` — jamais possible depuis ce client avec la
  // seule clé "anon" (voir supabaseClient.js).
  // Cascade AUTOMATIQUE côté Postgres, rien à faire ici en plus :
  // `user_data.user_id` ET `profiles.user_id` référencent déjà
  // `auth.users(id) on delete cascade` (voir supabase-schema.sql) — les
  // données synchronisées ET le pseudonyme disparaissent d'eux-mêmes dès
  // que la fonction supprime la ligne `auth.users`.
  const deleteAccount = async () => {
    if (!isSupabaseConfigured || !user) return { error: "Non connecté." };

    const { data, error } = await supabase.functions.invoke('delete-account');

    if (error) {
      // Piège connu de supabase-js v2 : sur une réponse HTTP non-2xx,
      // `error.message` reste un message générique du SDK ("Edge Function
      // returned a non-2xx status code"), PAS le message JSON réellement
      // renvoyé par notre fonction (`{ error: "..." }`, voir index.ts) — ce
      // vrai message vit dans `error.context`, la Response brute, qu'il
      // faut relire nous-mêmes. Repli sur le message générique si cette
      // relecture échoue (ex. la fonction n'est pas encore déployée, la
      // réponse n'est peut-être même pas du JSON).
      try {
        const body = await error.context.json();
        return { error: body?.error || error.message };
      } catch {
        return { error: error.message || "La suppression du compte a échoué." };
      }
    }
    if (data?.error) return { error: data.error };

    // La fonction a réellement supprimé `auth.users` côté serveur, mais le
    // token JWT encore détenu par ce navigateur reste techniquement valide
    // jusqu'à son expiration naturelle tant qu'on ne déconnecte pas
    // explicitement ici — `signOut()` invalide la session locale tout de
    // suite, pas d'attente du prochain refresh pour que l'app réagisse.
    await signOut();
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signUp, signIn, signOut, resetPassword, updateEmail, updatePassword, exportUserData, deleteAccount, isSupabaseConfigured, userCount, username, usernameLoading, checkUsernameAvailable, setUsername, profilePrivacy, updatePrivacySettings }}>
      {children}
    </AuthContext.Provider>
  );
}

// Valeurs de repli si jamais utilisé hors d'un <AuthProvider> (ne devrait pas
// arriver, main.jsx l'enveloppe autour de <App/> — mais évite un plantage
// plutôt qu'un écran blanc si jamais un composant est testé isolément).
const FALLBACK = {
  user: null, authLoading: false, isSupabaseConfigured: false, userCount: null,
  username: null, usernameLoading: false, profilePrivacy: null,
  signUp: async () => ({ error: "AuthProvider manquant." }),
  signIn: async () => ({ error: "AuthProvider manquant." }),
  signOut: async () => {},
  resetPassword: async () => ({ error: "AuthProvider manquant." }),
  updateEmail: async () => ({ error: "AuthProvider manquant." }),
  updatePassword: async () => ({ error: "AuthProvider manquant." }),
  exportUserData: async () => ({ data: null, error: "AuthProvider manquant." }),
  deleteAccount: async () => ({ error: "AuthProvider manquant." }),
  checkUsernameAvailable: async () => ({ available: false, error: "AuthProvider manquant." }),
  setUsername: async () => ({ error: "AuthProvider manquant." }),
  updatePrivacySettings: async () => ({ error: "AuthProvider manquant." }),
};

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  return ctx || FALLBACK;
}
