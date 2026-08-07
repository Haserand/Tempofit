import { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { STORAGE_PREFIX } from '../utils/localCache';


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
    if (!user) { hasSyncedForUserRef.current = null; return; }
    if (hasSyncedForUserRef.current === user.id) return;
    hasSyncedForUserRef.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_data').select('value')
          .eq('user_id', user.id).eq('key', key)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          isApplyingRemoteRef.current = true;
          setState(data.value);
        } else {
          await supabase.from('user_data').upsert({
            user_id: user.id, key, value: state, updated_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        // Échec silencieux volontaire (hors-ligne au moment de la connexion,
        // etc.) — même philosophie que le cache local ci-dessus.
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
        await supabase.from('user_data').upsert({
          user_id: userRef.current.id, key, value: state, updated_at: new Date().toISOString(),
        });
      } catch (e) {
        // Échec silencieux volontaire — voir docstring.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, setState];
}
