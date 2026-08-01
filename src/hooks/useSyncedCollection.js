import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const STORAGE_PREFIX = 'tempofit:';

/**
 * useSyncedCollection — même contrat que `usePersistentState.js`
 * (`[state, setState]`, localStorage TOUJOURS actif en filet de sécurité/
 * mode invité), mais pour un TABLEAU d'objets synchronisé vers une vraie
 * table Supabase RELATIONNELLE (une LIGNE par élément) plutôt qu'un blob
 * JSON unique — "Refonte Structurale — Round 1/2" (01/08), remplace
 * `usePersistentState('savedPlaylists', ...)`/`usePersistentState('routines', ...)`.
 *
 * DÉCISION D'ARCHITECTURE CENTRALE — pourquoi un hook à part plutôt que
 * d'étendre `usePersistentState` lui-même : ce projet a ~20 endroits
 * différents qui appellent déjà `setSavedPlaylists(...)`/`setRoutines(...)`
 * en attendant un simple remplacement de tableau ("ajoute cet élément",
 * "retire celui-là", "modifie celui-ci") — les réécrire TOUS pour appeler
 * des fonctions dédiées (`addPlaylist`/`removePlaylist`/`updatePlaylist`)
 * aurait été un chantier bien plus large et risqué, sans bénéfice réel.
 * Ce hook garde EXACTEMENT la même signature `[state, setState]` :
 * `setState` reste un simple remplaçant de tableau comme avant, mais
 * calcule maintenant en interne la DIFFÉRENCE entre l'ancien et le nouveau
 * tableau (par `id`) pour savoir quelles lignes insérer/modifier/supprimer
 * côté Supabase — chaque appelant existant continue de fonctionner sans
 * la moindre modification.
 *
 * Mode invité/hors-ligne INCHANGÉ (même philosophie que
 * usePersistentState.js) : localStorage reste la seule source de vérité
 * tant qu'aucun compte n'est connecté, ou si Supabase n'est pas configuré
 * — les comptes restent un ajout, jamais une dépendance dure.
 *
 * Stratégie à la connexion — identique à usePersistentState.js : si la
 * table a déjà des lignes pour cet utilisateur, elles remplacent l'état
 * local (le serveur devient source de vérité) ; sinon, l'état local actuel
 * (mode invité, ex. la playlist d'exemple) est poussé vers Supabase pour
 * ne rien perdre à la création du compte.
 *
 * ⚠️ `user_data` (l'ancien stockage en blob, clés 'savedPlaylists'/
 * 'routines') n'est PAS touchée par ce hook — les deux systèmes coexistent
 * tant que celui-ci n'a pas été vérifié en usage réel (voir
 * supabase-schema.sql pour le script de migration, volontairement non
 * destructeur lui aussi).
 *
 * `itemToRow`/`rowToItem` : `content` porte l'objet complet tel quel
 * (mêmes champs qu'avant, rien à changer côté composants qui les lisent) ;
 * seuls `id`/`is_public`/`is_intimate` sont extraits en colonnes propres
 * pour permettre les policies RLS et un futur filtrage public efficace
 * (`is_intimate` reflète `item.isNaughty` — même champ déjà utilisé
 * partout ailleurs dans l'app, pas un nouveau nom inventé ici).
 */
export function useSyncedCollection(storageKey, tableName, initialValue) {
  const { user, authLoading } = useAuthContext();

  const [state, setStateInternal] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (raw === null) return typeof initialValue === 'function' ? initialValue() : initialValue;
      return JSON.parse(raw);
    } catch (e) {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });

  // Toujours à jour avec le DERNIER `user` connu, lu depuis `setState`
  // SANS le mettre dans ses dépendances — même raison exacte que
  // usePersistentState.js (éviter qu'un changement de `user` déclenche à
  // tort une synchro AVANT que le pull initial n'ait eu la main).
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const isApplyingRemoteRef = useRef(false);
  const hasSyncedForUserRef = useRef(null);
  // État actuellement en mémoire, lu au moment du pull initial (1re
  // connexion) pour décider s'il faut pousser les données invité
  // existantes vers Supabase — via ref pour rester à jour SANS ajouter
  // `state` aux dépendances de l'effet de pull (qui ne doit tourner qu'à
  // la connexion, pas à chaque frappe).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Cache local — TOUJOURS actif (mode invité + hors-ligne), même
  // philosophie que usePersistentState.js.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(state));
    } catch (e) {
      // Échec silencieux volontaire — voir usePersistentState.js.
    }
  }, [storageKey, state]);

  // Pull initial à la connexion (1 fois par utilisateur, voir
  // `hasSyncedForUserRef`) — même stratégie que usePersistentState.js :
  // le serveur a déjà des lignes → il devient source de vérité ; sinon →
  // pousse l'état local actuel (ne pas perdre les données invité).
  useEffect(() => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!user) { hasSyncedForUserRef.current = null; return; }
    if (hasSyncedForUserRef.current === user.id) return;
    hasSyncedForUserRef.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from(tableName).select('*').eq('user_id', user.id);
        if (cancelled) return;
        if (error) {
          console.error(`useSyncedCollection(${tableName}) — pull initial échoué :`, error);
          return;
        }
        if (data && data.length > 0) {
          isApplyingRemoteRef.current = true;
          setStateInternal(data.map(rowToItem));
        } else if (stateRef.current.length > 0) {
          const { error: insertError } = await supabase.from(tableName).insert(
            stateRef.current.map(item => itemToRow(item, user.id))
          );
          if (insertError) {
            console.error(`useSyncedCollection(${tableName}) — poussée initiale échouée :`, insertError);
          }
        }
      } catch (e) {
        console.error(`useSyncedCollection(${tableName}) — pull initial a levé une exception :`, e);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, tableName]);

  // `setState` — même signature qu'un `setState` classique (valeur directe
  // OU fonction de mise à jour), mais calcule la DIFFÉRENCE avec l'état
  // précédent pour mirrorer chaque changement vers Supabase — insertions/
  // suppressions/modifications individuelles, JAMAIS un remplacement en
  // bloc de toute la collection distante (contrairement à l'ancien
  // `usePersistentState`, qui réécrivait tout le blob à chaque frappe).
  const setState = useCallback((updater) => {
    setStateInternal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Valeur qui vient d'un pull distant (voir plus haut) — déjà la
      // vérité serveur, rien à repousser dessus.
      if (isApplyingRemoteRef.current) {
        isApplyingRemoteRef.current = false;
        return next;
      }

      if (isSupabaseConfigured && userRef.current) {
        const uid = userRef.current.id;
        const prevById = new Map(prev.map(item => [item.id, item]));
        const nextById = new Map(next.map(item => [item.id, item]));

        prevById.forEach((_, id) => {
          if (!nextById.has(id)) {
            supabase.from(tableName).delete().eq('id', id).eq('user_id', uid)
              .then(({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — suppression échouée :`, error);
              });
          }
        });

        nextById.forEach((item, id) => {
          if (!prevById.has(id)) {
            supabase.from(tableName).insert(itemToRow(item, uid))
              .then(({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — insertion échouée :`, error);
              });
          }
        });

        // Modification — comparaison JSON complète (pas de diff champ par
        // champ) : assez pour des collections de cette taille (playlists/
        // routines d'un seul utilisateur, jamais des milliers de lignes),
        // et évite d'avoir à maintenir une liste de champs "à surveiller"
        // qui se désynchroniserait du modèle de données au fil du temps.
        nextById.forEach((item, id) => {
          const old = prevById.get(id);
          if (old && JSON.stringify(old) !== JSON.stringify(item)) {
            supabase.from(tableName).update(itemToRow(item, uid)).eq('id', id).eq('user_id', uid)
              .then(({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — mise à jour échouée :`, error);
              });
          }
        });
      }

      return next;
    });
  }, [tableName]);

  return [state, setState];
}

function itemToRow(item, userId) {
  return {
    id: item.id,
    user_id: userId,
    content: item,
    is_public: !!item.isPublic,
    is_intimate: !!item.isNaughty,
  };
}

function rowToItem(row) {
  // `content` porte déjà l'objet complet (y compris son propre `id`,
  // identique à `row.id` par construction — voir `itemToRow`) — spread
  // suffit, rien à fusionner manuellement champ par champ.
  return row.content;
}
