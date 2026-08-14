import { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { STORAGE_PREFIX } from '../utils/localCache';
import { trackWrite } from '../utils/pendingWrites';


/**
 * usePersistentState — se comporte exactement comme `useState`, mais la
 * valeur est automatiquement lue depuis `localStorage` au montage et
 * réécrite à chaque changement. Persistance "Niveau 1" (voir échange avec
 * l'utilisateur) : locale à CE navigateur/appareil, aucun compte, aucun
 * serveur — mais F5/fermeture de l'onglet ne perd plus rien.
 *
 * `initialValue` peut être une valeur directe ou une fonction (paresseuse,
 * comme pour `useState`) — n'est utilisée QUE si rien n'est encore stocké
 * pour cette clé (première visite, ou storage vidé). C'est ce qui permet de
 * garder les données de démonstration actuelles (playlist d'exemple,
 * favoris de départ...) pour un nouvel utilisateur, tout en les ignorant
 * silencieusement dès qu'un vrai historique existe.
 *
 * Échecs silencieux volontaires (quota dépassé, navigation privée qui bloque
 * localStorage, JSON corrompu...) : l'app continue de fonctionner en mémoire
 * pour la session en cours plutôt que de planter — la persistance est un
 * confort, pas une dépendance dure.
 *
 * RETOUR DIRECT ("vraiment synchroniser toutes les données entre appareils")
 * — Persistance "Niveau 2" ajoutée ici, PAR-DESSUS le Niveau 1 ci-dessus,
 * sans jamais le remplacer : localStorage reste TOUJOURS écrit (cache local/
 * repli hors-ligne, l'app continue de marcher sans réseau), et en plus, SI un
 * compte est connecté (voir AuthContext.jsx), la même valeur est synchronisée
 * avec la table générique `user_data` sur Supabase (voir supabase-schema.sql).
 * Modifié UNE SEULE FOIS ici plutôt que dans chacun des 6 hooks qui
 * l'utilisent (useFavorites, useRoutines, useAthleticProfile, useUserStats,
 * `theme`/`savedPlaylists` dans App.jsx) — ils n'ont RIEN à changer, la
 * synchro s'applique automatiquement à tout ce qui passe par ce hook.
 *
 * Stratégie à la connexion (1re fois que `user` passe de rien à quelqu'un) :
 *   - Si Supabase a DÉJÀ une valeur pour cette clé → elle remplace la valeur
 *     locale (le serveur devient la source de vérité une fois connecté).
 *   - Sinon (1re connexion de ce compte) → la valeur locale actuelle est
 *     poussée vers Supabase, pour ne PAS perdre ce qui existait déjà en
 *     "invité" (favoris déjà configurés, etc.) au moment de créer le compte.
 * Ensuite, chaque changement local est poussé vers Supabase en tâche de fond
 * (échec silencieux si hors-ligne — même philosophie que localStorage
 * ci-dessus, la synchro est un confort, pas une dépendance dure).
 *
 * ⚠️ CORRIGÉ (07/08) — connu et non traité jusque-là : à la DÉCONNEXION, les
 * données de l'utilisateur restaient dans localStorage de CET appareil (pas
 * d'effacement automatique) — correct pour un usage perso, mais sur un
 * appareil partagé, le compte suivant pouvait voir (et modifier) ces
 * données tant qu'il ne se connectait pas lui-même. `signOut()`
 * (AuthContext.jsx) appelle désormais `clearLocalCache()` (voir
 * `src/utils/localCache.js`) — vide tout le cache localStorage de TempoFit
 * sur cet appareil. Rien à changer ICI : ce hook continue de lire/écrire
 * `STORAGE_PREFIX + key` normalement, `clearLocalCache()` agit en dehors de
 * son cycle de vie, au moment de la déconnexion.
 */
export function usePersistentState(key, initialValue) {
  const { user, authLoading } = useAuthContext();

  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return typeof initialValue === 'function' ? initialValue() : initialValue;
      return JSON.parse(raw);
    } catch (e) {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });

  // Toujours à jour avec le DERNIER `user` connu, lu depuis l'effet de push
  // (ci-dessous) SANS le mettre dans ses dépendances — voir ce commentaire.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Marque un `setState` comme venant d'un pull distant plutôt que d'une
  // vraie modification locale — évite de repousser immédiatement vers
  // Supabase la valeur qu'on vient tout juste d'en recevoir.
  const isApplyingRemoteRef = useRef(false);
  // Le pull/push initial ne doit se faire qu'UNE FOIS par connexion (pas à
  // chaque frappe qui re-render ce hook) — mémorise POUR QUEL utilisateur
  // c'est déjà fait.
  const hasSyncedForUserRef = useRef(null);
  // ⚠️ BUG RÉEL CORRIGÉ (13/08, découvert en écrivant les tests dédiés —
  // voir usePersistentState.test.js) — "push prématuré au montage" : quand
  // un compte est DÉJÀ connecté au montage de ce hook (page rechargée avec
  // une session existante, ou hook monté après coup dans un composant qui
  // n'apparaît qu'une fois connecté), l'effet de pull et l'effet de push
  // ci-dessous se déclenchent TOUS LES DEUX dans la MÊME passe d'effets
  // synchrones — avant qu'aucun des deux n'ait eu la main sur le réseau. Le
  // push ne dépendant QUE de `userRef.current` (jamais du résultat du
  // pull), il partait donc systématiquement AVANT que le pull n'ait eu la
  // moindre chance de récupérer la valeur distante — envoyant la valeur
  // locale de départ (potentiellement périmée) vers Supabase, au double
  // risque d'un aller-retour réseau inutile ET, plus grave, d'une vraie
  // perte de données si cette valeur locale périmée écrasait une valeur
  // distante plus récente et légitime.
  // `readyForPushRef` bloque désormais le push tant que le pull n'a pas eu
  // la main pour l'utilisateur courant (valeur appliquée, confirmé vide, ou
  // erreur/exception — dans tous les cas, "le pull a fini d'essayer"). Mis
  // à `false` SYNCHRONEMENT dès que le pull démarre un vrai cycle pour un
  // utilisateur (juste avant son IIFE async, voir plus bas) — donc déjà à
  // `false`, dans la MÊME passe d'effets, au moment où l'effet de push
  // vérifie sa valeur au premier montage avec un compte déjà connu.
  const readyForPushRef = useRef(false);

  // Cache local — INCHANGÉ (voir docstring), actif que l'utilisateur soit
  // connecté ou non.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
    } catch (e) {
      // Échec silencieux (voir docstring) — pas de showToast ici volontairement :
      // ce hook est utilisé par plusieurs autres hooks indépendants qui n'ont pas
      // tous accès à showToast, et une erreur de quota localStorage à chaque
      // frappe serait de toute façon plus gênante qu'utile.
    }
  }, [key, state]);

  // Récupération/initialisation Supabase à la connexion — voir la stratégie
  // détaillée dans la docstring. `hasSyncedForUserRef` évite de refaire cet
  // appel réseau à chaque frappe ; seul un changement RÉEL d'utilisateur (ou
  // le montage initial si déjà connecté) le redéclenche.
  useEffect(() => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!user) { hasSyncedForUserRef.current = null; readyForPushRef.current = true; return; }
    if (hasSyncedForUserRef.current === user.id) return;
    hasSyncedForUserRef.current = user.id;
    readyForPushRef.current = false; // voir la docstring de readyForPushRef plus haut

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_data').select('value')
          .eq('user_id', user.id).eq('key', key)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          // ⚠️ BUG RÉEL CORRIGÉ (13/08, découvert en écrivant les tests
          // dédiés — voir "isApplyingRemoteRef ne repasse JAMAIS à false
          // si..." dans usePersistentState.test.js) — si `data.value` est
          // STRICTEMENT IDENTIQUE (`Object.is`, mêmes semantiques que le
          // bail-out interne de React) à la valeur locale actuelle,
          // `setState(data.value)` juste en dessous ne déclenche AUCUN
          // re-render (React reconnaît qu'il n'y a rien à faire). Or c'est
          // justement CE re-render qui fait retourner l'effet de push
          // ci-dessous, qui consomme `isApplyingRemoteRef` (le repasse à
          // `false`) — sans re-render, il n'y a personne pour le faire.
          // Résultat avant ce correctif : `isApplyingRemoteRef` restait
          // bloqué à `true` indéfiniment, et le TOUT PROCHAIN changement
          // local RÉEL de l'utilisateur se faisait avaler silencieusement
          // par l'effet de push (qui le prend pour un pull, alors que ça
          // n'en est pas un) — pas de crash, juste un changement qui ne se
          // synchronise pas avec Supabase tant qu'un 2e changement ne
          // survient pas. Scénario plausible et pas rare : une valeur
          // locale par défaut qui coïncide avec la valeur déjà
          // synchronisée (ex. thème resté sur 'light'). Corrigé en
          // n'armant `isApplyingRemoteRef` que quand un VRAI changement est
          // sur le point de se produire — dans le cas contraire, rien ne
          // change, donc rien à protéger d'un push erroné.
          if (!Object.is(data.value, state)) {
            isApplyingRemoteRef.current = true;
          }
          setState(data.value);
        } else {
          // `trackWrite` (08/08) — voir pendingWrites.js : enregistre cette
          // écriture dans le compteur global partagé, pour que `signOut()`
          // puisse l'attendre. `await` inchangé, comportement identique.
          await trackWrite(supabase.from('user_data').upsert({
            user_id: user.id, key, value: state, updated_at: new Date().toISOString(),
          }));
        }
      } catch (e) {
        // Échec silencieux volontaire (hors-ligne au moment de la connexion,
        // etc.) — même philosophie que le cache local ci-dessus.
      } finally {
        // Que le pull ait réussi, trouvé le serveur vide, ou échoué : il a
        // fini d'essayer pour cet utilisateur — le push peut désormais
        // reprendre la main normalement pour tout changement local à venir.
        if (!cancelled) readyForPushRef.current = true;
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, key]);

  // Pousse vers Supabase à chaque changement LOCAL de `state` — lit
  // `userRef.current` plutôt que `user` directement et ne dépend QUE de
  // `state` : si cet effet dépendait aussi de `user`, il se déclencherait
  // dès la connexion (avant même que le pull ci-dessus ait eu la main),
  // risquant d'écraser une valeur distante plus récente avec l'ancienne
  // valeur locale encore en mémoire à cet instant précis.
  useEffect(() => {
    if (isApplyingRemoteRef.current) { isApplyingRemoteRef.current = false; return; }
    if (!isSupabaseConfigured || !userRef.current) return;
    // Voir la docstring de `readyForPushRef` plus haut — tant que le pull
    // n'a pas eu la main pour cet utilisateur (typiquement : au tout
    // premier montage avec un compte déjà connu), on ne pousse rien. Le
    // prochain VRAI changement local, une fois le pull réglé, repoussera de
    // toute façon la valeur COURANTE (qui inclut déjà celui-ci) — rien
    // n'est perdu, juste retardé de quelques centaines de millisecondes le
    // temps que le pull ait fini d'essayer.
    if (!readyForPushRef.current) return;
    // BUG RÉEL CORRIGÉ (crash fatal signalé : "upsert(...).catch is not a
    // function") — `supabase.from(...).upsert(...)` renvoie un objet
    // "thenable" (implémente `.then()`, pour fonctionner avec `await`),
    // PAS une vraie Promise : `.catch()`/`.finally()` n'y sont pas
    // forcément exposés selon la version du client. `.catch()` chaîné
    // directement dessus plantait donc AVANT même le 1er rendu suivant un
    // clic sur un lien e-mail (reset de mot de passe, confirmation
    // d'inscription...), qui déclenche ce même effet dès la connexion.
    // IIFE async + try/catch — même convention que l'autre appel upsert
    // juste au-dessus dans ce fichier (`await`, jamais `.then`/`.catch`
    // chaîné sur le retour direct d'une requête Supabase).
    (async () => {
      try {
        // `trackWrite` (08/08) — même raisonnement que le pull juste
        // au-dessus : voir pendingWrites.js.
        await trackWrite(supabase.from('user_data').upsert({
          user_id: userRef.current.id, key, value: state, updated_at: new Date().toISOString(),
        }));
      } catch (e) {
        // Échec silencieux volontaire — voir docstring.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, setState];
}
