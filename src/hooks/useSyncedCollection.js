import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { STORAGE_PREFIX } from '../utils/localCache';
import { trackWrite } from '../utils/pendingWrites';


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

  // BUG CORRIGÉ (01/08, trouvé en écrivant les tests de ce hook, pas
  // signalé par un retour utilisateur) — un `isApplyingRemoteRef` existait
  // ici : posé à `true` juste avant l'appel à `setStateInternal` du pull
  // (remplacement par les données serveur), avec l'intention de "ne pas
  // repousser vers Supabase une valeur qui vient DÉJÀ de Supabase". Sauf
  // que ce flag n'était vérifié/réinitialisé QUE dans `setState` (la
  // fonction wrapper exposée à toute l'app, plus bas) — jamais dans
  // `setStateInternal` (le setter React brut, celui que le pull appelle
  // RÉELLEMENT). Résultat concret : le flag restait bloqué à `true` après
  // toute connexion où le serveur avait déjà des données, jusqu'au tout
  // PROCHAIN appel de `setState` — n'importe lequel, sauvegarder une
  // nouvelle playlist, la modifier, la supprimer. Ce 1er appel se
  // retrouvait donc traité À TORT comme "vient du serveur", son diff
  // sauté entièrement — la modification restait visible localement (l'état
  // change bien) mais ne partait JAMAIS vers Supabase. Perte de donnée
  // SILENCIEUSE, sans la moindre erreur console pour l'indiquer.
  //
  // Le vrai correctif : ce flag n'a JAMAIS été nécessaire. Le pull appelle
  // déjà `setStateInternal` DIRECTEMENT (pas `setState`) — la logique de
  // diff/synchro vit ENTIÈREMENT dans le callback interne de `setState`
  // (plus bas), jamais exécutée par un simple `setStateInternal`. Le
  // pull ne peut donc, par construction, jamais déclencher de synchro
  // parasite — retirer ce flag ne change RIEN au comportement du pull,
  // et corrige le bug pour tous les appels de `setState` qui le suivent.
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
          setStateInternal(data.map(rowToItem));
        } else if (stateRef.current.length > 0) {
          // `trackWrite` (08/08) — cette poussée initiale (1re connexion
          // d'un compte qui avait déjà des données invité) est, elle
          // aussi, une écriture Supabase en tâche de fond : un clic sur
          // Déconnexion juste après la connexion pourrait sinon la
          // manquer tout autant qu'une écriture "normale" en cours
          // d'usage — voir pendingWrites.js.
          const { error: insertError } = await trackWrite(supabase.from(tableName).insert(
            stateRef.current.map(item => itemToInsertRow(item, user.id))
          ));
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

      // Valeur qui vient d'un pull distant : IMPOSSIBLE d'arriver ici — le
      // pull appelle `setStateInternal` directement (voir plus haut),
      // jamais ce wrapper `setState`. Rien à vérifier de ce côté (voir le
      // commentaire du bug corrigé, à la déclaration de
      // `hasSyncedForUserRef` plus haut, pour l'historique complet).

      if (isSupabaseConfigured && userRef.current) {
        const uid = userRef.current.id;
        const prevById = new Map(prev.map(item => [item.id, item]));
        const nextById = new Map(next.map(item => [item.id, item]));

        // `trackWrite` (08/08) — enregistre chacune de ces écritures dans le
        // compteur global partagé (voir pendingWrites.js), pour que
        // `signOut()` (AuthContext.jsx) puisse les attendre avant de couper
        // la session/vider le cache local, plutôt que de simplement supposer
        // qu'elles sont "déjà parties". Ne change RIEN au comportement
        // observable : le callback de journalisation d'erreur passé en 2e
        // argument reçoit exactement le même `{ error }` qu'avant.
        prevById.forEach((_, id) => {
          if (!nextById.has(id)) {
            trackWrite(
              supabase.from(tableName).delete().eq('id', id).eq('user_id', uid),
              ({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — suppression échouée :`, error);
              },
            );
          }
        });

        nextById.forEach((item, id) => {
          if (!prevById.has(id)) {
            trackWrite(
              supabase.from(tableName).insert(itemToInsertRow(item, uid)),
              ({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — insertion échouée :`, error);
              },
            );
          }
        });

        // Modification — court-circuit par RÉFÉRENCE (07/08, optimisation),
        // puis comparaison JSON complète en filet de sécurité (pas de diff
        // champ par champ) : assez pour des collections de cette taille
        // (playlists/routines d'un seul utilisateur, jamais des milliers de
        // lignes), et évite d'avoir à maintenir une liste de champs "à
        // surveiller" qui se désynchroniserait du modèle de données au fil
        // du temps.
        //
        // `old === item` (référence stricte) élimine la quasi-totalité des
        // `JSON.stringify` inutiles en pratique : audité (07/08) sur les 27
        // appels de `setSavedPlaylists`/`setRoutines` du projet — TOUS
        // suivent le même pattern `.map(x => x.id === id ? { ...x, ... } :
        // x)` (ou équivalent — push/filter/Map#get), qui préserve
        // STRICTEMENT la référence de chaque item non modifié et n'en crée
        // une nouvelle QUE pour l'item réellement changé. Concrètement :
        // une frappe dans le brouillon de description d'UNE playlist ne
        // fait plus sérialiser les N-1 AUTRES playlists de la collection à
        // chaque rendu déclenché ailleurs — seul l'item dont la référence a
        // changé passe par `JSON.stringify`.
        // ⚠️ Ce court-circuit ne REMPLACE PAS la comparaison profonde, il la
        // précède : un item reconstruit avec une NOUVELLE référence mais un
        // contenu strictement identique (cas qui ne se produit pas
        // aujourd'hui vu l'audit ci-dessus, mais pourrait un jour venir
        // d'un code qui ne préserve pas les références) continue d'être
        // reconnu comme "pas de changement réel" par le `JSON.stringify` en
        // second temps — voir `tests/hooks/useSyncedCollection.test.js`,
        // describe "élément INCHANGÉ", qui vérifie précisément CE contrat
        // et continue de passer tel quel avec ce changement.
        //
        // `itemToUpdateRow` (PAS `itemToInsertRow`) — refonte du 03/08,
        // traçabilité de lignée : `parent_id`/`parent_user_id` ne doivent
        // JAMAIS être réécrits après la création (voir leur docstring,
        // supabase-schema.sql). Le trigger `lock_parent_lineage` protège
        // déjà ça côté serveur quoi qu'on envoie, mais ne PAS les inclure
        // ici évite même d'essayer — défense en profondeur, 2 couches
        // indépendantes plutôt qu'une seule.
        nextById.forEach((item, id) => {
          const old = prevById.get(id);
          if (old && old !== item && JSON.stringify(old) !== JSON.stringify(item)) {
            trackWrite(
              supabase.from(tableName).update(itemToUpdateRow(item, uid)).eq('id', id).eq('user_id', uid),
              ({ error }) => {
                if (error) console.error(`useSyncedCollection(${tableName}) — mise à jour échouée :`, error);
              },
            );
          }
        });
      }

      return next;
    });
  }, [tableName]);

  return [state, setState];
}

// `itemToInsertRow`/`itemToUpdateRow` — refonte du 03/08 (traçabilité de
// lignée résolue côté serveur, voir supabase-schema.sql) : DEUX fonctions
// séparées où il n'y en avait qu'une avant, précisément parce que
// `parent_id`/`parent_user_id` ne doivent transiter QUE dans le sens
// insertion. `itemToUpdateRow` les omet entièrement, jamais par erreur ni
// par un futur copier-coller distrait — la seule façon d'envoyer ces 2
// colonnes vers Supabase passe par `itemToInsertRow`, appelée UNIQUEMENT
// au moment de la création d'une ligne (voir les 2 appels plus haut).
function itemToInsertRow(item, userId) {
  return {
    id: item.id,
    user_id: userId,
    content: item,
    is_public: !!item.isPublic,
    is_intimate: !!item.isNaughty,
    // Posés UNE SEULE FOIS ici, jamais recopiés dans itemToUpdateRow —
    // `item.parentId`/`item.parentUserId` sont mirroirés dans `content`
    // (comme `isPublic`/`isNaughty` le sont déjà) pour un usage cosmétique
    // côté client (badge Clone/Enfant), mais c'est CETTE colonne réelle,
    // posée ici et protégée par le trigger `lock_parent_lineage`, qui sert
    // de source de vérité pour la marche récursive côté serveur — jamais
    // le contenu JSONB.
    parent_id: item.parentId || null,
    parent_user_id: item.parentUserId || null,
  };
}

function itemToUpdateRow(item, userId) {
  return {
    id: item.id,
    user_id: userId,
    content: item,
    is_public: !!item.isPublic,
    is_intimate: !!item.isNaughty,
    // `parent_id`/`parent_user_id` volontairement ABSENTS ici — voir la
    // docstring de `itemToInsertRow` juste au-dessus.
  };
}

function rowToItem(row) {
  // `content` porte déjà l'objet complet (y compris son propre `id`,
  // identique à `row.id` par construction) — spread suffit pour tout le
  // reste, mais `parent_id`/`parent_user_id` (colonnes réelles, jamais
  // dans `content` par construction côté serveur) doivent être rapatriés
  // explicitement ici pour que le badge Clone/Enfant fonctionne aussi
  // depuis SA PROPRE collection (Mes Séances/Mes Routines) — `content`
  // seul ne les contient que s'ils y ont été mirroirés à l'insertion (voir
  // `itemToInsertRow`), ce qui est déjà le cas pour une ligne créée par ce
  // client, mais pas garanti pour une ligne migrée depuis l'ancien blob
  // `user_data` (voir la migration, supabase-schema.sql) — la colonne
  // réelle reste donc la source la plus fiable, y compris ici.
  return {
    ...row.content,
    parentId: row.parent_id || row.content.parentId || null,
    parentUserId: row.parent_user_id || row.content.parentUserId || null,
  };
}
