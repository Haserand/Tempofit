-- supabase-schema.sql — À exécuter dans Supabase → le projet → SQL Editor →
-- New query → coller ce fichier entier → Run.
--
-- BUG CORRIGÉ (01/08) — ce fichier n'était PAS réellement rejouable tel
-- quel malgré ce que disait ce commentaire : `create table if not exists`/
-- `add column if not exists` sont idempotents, mais `create policy` n'a
-- PAS d'équivalent `if not exists` en Postgres — le rejouer entier une 2e
-- fois échouait dès la 1re policy rencontrée (`ERROR: 42710: policy ...
-- already exists`), avant même d'atteindre les évolutions plus récentes en
-- bas de fichier. Toutes les policies sont désormais précédées d'un `drop
-- policy if exists` — ce fichier entier est maintenant sûr à rejouer
-- autant de fois que nécessaire, sur un projet neuf comme déjà initialisé.
--
-- Une seule table générique (clé → valeur JSON), au lieu d'une table dédiée
-- par fonctionnalité (favoris, routines, stats...) — reflet exact de la
-- façon dont l'app stocke déjà tout localement : `usePersistentState(key,
-- valeur)` (src/hooks/usePersistentState.js) traite TOUT comme une paire
-- clé/valeur JSON dans localStorage (theme, favorites, routines,
-- athleticProfile, userStats, savedPlaylists...). Cette table reproduit
-- exactement la même forme côté serveur, ce qui permet de synchroniser
-- N'IMPORTE LEQUEL de ces états sans jamais créer de nouvelle table quand un
-- futur état apparaîtra dans l'app — un seul point de synchronisation pour
-- tout, comme il n'y a qu'un seul point de persistance locale aujourd'hui.
create table if not exists user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ⚠️ ÉTAPE CRITIQUE, à ne jamais sauter : sans Row Level Security (RLS),
-- n'importe quel compte pourrait lire/écrire les données de n'importe quel
-- autre utilisateur via la clé "anon" (publique par design, voir
-- supabaseClient.js) — c'est CETTE table de règles, pas le secret de la clé,
-- qui protège réellement les données de chacun ici.
alter table user_data enable row level security;

drop policy if exists "Un utilisateur lit uniquement ses propres données" on user_data;
create policy "Un utilisateur lit uniquement ses propres données"
  on user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Un utilisateur crée uniquement ses propres données" on user_data;
create policy "Un utilisateur crée uniquement ses propres données"
  on user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur modifie uniquement ses propres données" on user_data;
create policy "Un utilisateur modifie uniquement ses propres données"
  on user_data for update
  using (auth.uid() = user_id);

drop policy if exists "Un utilisateur supprime uniquement ses propres données" on user_data;
create policy "Un utilisateur supprime uniquement ses propres données"
  on user_data for delete
  using (auth.uid() = user_id);

-- Accélère la requête "toutes les clés de CET utilisateur" (utilisée à
-- chaque connexion pour tout récupérer d'un coup, voir AuthContext.jsx).
create index if not exists user_data_user_id_idx on user_data (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — pseudonyme public, unique et IMMUABLE (Feature, 28/07).
-- Table dédiée plutôt qu'une entrée `user_data` de plus : ce pseudonyme doit
-- être lisible PUBLIQUEMENT (y compris par des visiteurs non connectés, pour
-- vérifier sa disponibilité avant même la création du compte — voir
-- `checkUsernameAvailable` dans AuthContext.jsx), contrairement à `user_data`
-- qui n'est lisible que par son propriétaire. Une contrainte `unique` réelle
-- côté Postgres garantit l'unicité, pas seulement une convention côté client.
--
-- Rappel (voir passation du 28/07) : cette table a été livrée initialement
-- comme un fichier de migration séparé (`supabase-migration-profiles.sql`)
-- pour ne pas casser un projet Supabase déjà existant en relançant tout ce
-- fichier — à l'époque, une vraie limite (voir le correctif d'idempotence
-- des policies en tête de fichier, 01/08 : ce n'est PLUS le cas). Elle est
-- désormais intégrée ICI aussi, pour qu'une INSTALLATION NEUVE (un
-- `supabase-schema.sql` exécuté sur un projet vide) obtienne le schéma
-- complet dès le départ.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- Correctif UX — pseudos réservés (02/08, retour direct : "qu'est-ce que
-- je dois écrire dans supabase") — MIROIR EXACT du frontend
-- (src/utils/username.js, `isReservedUsername`) : même exception
-- ('tempofit_admin', seul cas autorisé malgré le mot "tempofit" qu'il
-- contient), même motif (`tempofit` interdit n'importe où, insensible à
-- la casse — `~*` est l'équivalent Postgres du flag `/i` de JavaScript ;
-- les mots-clés système interdits uniquement en PRÉFIXE via `^(...)`).
-- Contrairement à la contrainte de FORMAT ci-dessus (posée directement
-- dans `create table if not exists`, donc jamais rejouée sur une table
-- déjà existante) : `alter table` séparé, AVEC `drop constraint if
-- exists` avant — REJOUABLE sans risque, cohérent avec le reste de ce
-- fichier.
--
-- ⚠️ Si cette table contient DÉJÀ des lignes : `alter table ... add
-- constraint` vérifie TOUTES les lignes existantes contre la nouvelle
-- règle — une seule ligne qui la violerait ferait échouer toute la
-- commande. Avant de l'exécuter, vérifiez qu'aucun pseudo existant ne
-- serait bloqué (hors 'tempofit_admin', l'exception) :
--   select username from profiles
--   where username <> 'tempofit_admin'
--     and username ~* 'tempofit|^(admin|support|system|modo|staff|root|officiel)';
-- (devrait renvoyer 0 ligne avant d'exécuter ce qui suit)
-- Doublon trouvé en production (02/08, jamais posé par CE fichier — reste
-- de l'exécution d'un SQL équivalent généré ailleurs, avant celui-ci) :
-- `prevent_reserved_usernames`, logiquement identique à
-- `profiles_username_not_reserved` ci-dessous (même exception
-- 'tempofit_admin', même motif écrit différemment mais équivalent) —
-- retirée pour qu'une seule contrainte fasse foi, celle-ci.
alter table profiles drop constraint if exists prevent_reserved_usernames;
alter table profiles drop constraint if exists profiles_username_not_reserved;
alter table profiles add constraint profiles_username_not_reserved
  check (
    username = 'tempofit_admin'
    or username !~* 'tempofit|^(admin|support|system|modo|staff|root|officiel)'
  );

alter table profiles enable row level security;

-- Lecture PUBLIQUE (pas seulement `auth.uid() = user_id`) : nécessaire pour
-- vérifier la disponibilité d'un pseudonyme AVANT la création du compte,
-- avec la seule clé "anon" — voir `checkUsernameAvailable`, AuthContext.jsx.
-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION "Profil public" (01/08, Feature Sociale Partie 1/2) — le pseudo
-- était jusqu'ici la SEULE donnée de `profiles`, lisible par tout le monde
-- sans distinction. Ajout de 4 colonnes pour un vrai profil public
-- OPT-IN (avatar + 3 bascules de confidentialité) : contrairement au
-- pseudo, tout le reste du profil ne doit être lisible QUE par son
-- propriétaire OU par un visiteur SI `is_profile_public = true`.
--
-- ⚠️ Resserrer la policy SELECT à "soi-même OU is_profile_public" (au lieu
-- de `using (true)`, jusqu'ici) casserait `checkUsernameAvailable`
-- (AuthContext.jsx) : un visiteur non connecté doit pouvoir vérifier qu'un
-- pseudo est pris même si le propriétaire n'a PAS rendu son profil public —
-- "ce pseudo existe déjà" n'a rien à voir avec "ce profil est visible
-- publiquement". Résolu ci-dessous par une fonction dédiée
-- (`is_username_available`, SECURITY DEFINER, même principe que
-- `get_registered_users_count` déjà en place) : elle seule contourne RLS,
-- et ne renvoie qu'un booléen, jamais la ligne elle-même.
alter table profiles
  add column if not exists avatar_url text,
  add column if not exists is_profile_public boolean not null default false,
  add column if not exists show_sport_stats boolean not null default false,
  add column if not exists show_intimate_stats boolean not null default false,
  -- "Refonte Structurale — Round 2/2" (01/08, retour direct : "par défaut
  -- quand un utilisateur veut afficher ses playlists c'est dans ses
  -- réglages") — préférence PAR DÉFAUT appliquée à CHAQUE NOUVELLE playlist
  -- sauvegardée (voir usePlaylistLibrary.js, handleSavePlaylist) — ne
  -- change JAMAIS rétroactivement les playlists déjà existantes. La
  -- confidentialité RÉELLE d'une playlist reste TOUJOURS `playlists.is_public`
  -- (déjà en place depuis Round 1/2) — cette colonne-ci n'est qu'une valeur
  -- de départ pratique, jamais consultée après la sauvegarde initiale.
  add column if not exists default_playlist_public boolean not null default false;

drop policy if exists "Tout le monde peut lire les pseudonymes" on profiles;
drop policy if exists "Un profil est lisible par son propriétaire ou s'il est public" on profiles;

create policy "Un profil est lisible par son propriétaire ou s'il est public"
  on profiles for select
  using (auth.uid() = user_id or is_profile_public = true);

-- Fonction dédiée à la SEULE vérification de disponibilité d'un pseudo —
-- ne fuit RIEN d'autre du profil (ni avatar_url, ni les bascules, ni
-- l'existence même d'un profil privé) à un visiteur non connecté.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where username = candidate);
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

drop policy if exists "Un utilisateur crée uniquement son propre pseudonyme" on profiles;
create policy "Un utilisateur crée uniquement son propre pseudonyme"
  on profiles for insert
  with check (auth.uid() = user_id);

-- Modification autorisée maintenant (contrairement à avant) — mais
-- UNIQUEMENT pour avatar_url/is_profile_public/show_sport_stats/
-- show_intimate_stats : le pseudo reste IMMUABLE, garanti ci-dessous par un
-- trigger dédié plutôt que par la simple absence de policy update (qui ne
-- suffit plus, puisqu'une policy update doit désormais exister pour ces
-- 4 nouvelles colonnes).
drop policy if exists "Un utilisateur modifie uniquement son propre profil" on profiles;
create policy "Un utilisateur modifie uniquement son propre profil"
  on profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.prevent_username_change()
returns trigger
language plpgsql
as $$
begin
  if new.username <> old.username then
    raise exception 'Le pseudonyme est immuable et ne peut pas être modifié.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_username_change_trigger on profiles;
create trigger prevent_username_change_trigger
  before update on profiles
  for each row execute function public.prevent_username_change();

-- ⚠️ AUCUNE policy `delete` — toujours volontairement absent (voir plus
-- haut) : un profil ne se supprime que via la cascade `on delete cascade`
-- déclenchée par la suppression du compte lui-même (Edge Function
-- `delete-account`, voir AuthContext.jsx/deleteAccount), jamais en direct.
create index if not exists profiles_username_idx on profiles (username);

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION "Vue Profil Public" (01/08, Feature Sociale Partie 2/3) —
-- `show_sport_stats`/`show_intimate_stats` (profiles) restaient jusqu'ici
-- de simples bascules SANS AUCUN EFFET réel : les vraies statistiques
-- (BPM, temps d'entraînement) ne vivent pas dans `profiles` mais dans
-- `user_data` (clé 'savedPlaylists', un DOUBLE blob JSON par utilisateur —
-- voir usePersistentState.js/App.jsx) — une table RLS strictement privée
-- (`using (auth.uid() = user_id)`, sans exception), donc totalement fermée
-- à un visiteur non propriétaire quel que soit l'état de ces 2 bascules.
--
-- Cette fonction est la SEULE porte d'entrée autorisée à lire les données
-- d'un AUTRE utilisateur pour les besoins d'un profil public — jamais une
-- policy RLS élargie sur `user_data` elle-même (qui contient AUSSI les
-- favoris, routines, thème, profil athlétique... aucune raison qu'un
-- visiteur y touche, même en lecture). SECURITY DEFINER + vérifications
-- explicites AU DÉBUT (profil trouvé ? public ? bascule concernée
-- activée ?) avant toute lecture de `user_data` — si l'une échoue, renvoie
-- `null` sans jamais avoir lu la moindre ligne de `savedPlaylists`.
--
-- Ne renvoie QUE `{ totalDuration, bpm }` par séance (JAMAIS le titre, les
-- pistes, les dates, ou tout autre détail) — même en inspectant la requête
-- réseau depuis le navigateur, un visiteur ne peut pas voir plus que ce
-- résumé réduit. `sport_sessions`/`intimate_sessions` : présents dans le
-- JSON renvoyé UNIQUEMENT si la bascule correspondante est active — clé
-- ABSENTE (pas juste `null`), pour que ProfileView.jsx distingue "non
-- autorisé à voir" de "autorisé, mais aucune séance" (voir sa docstring).
--
-- ⚠️ Point NON VÉRIFIÉ (pas d'accès à un vrai projet Supabase pour
-- l'exécuter) : la syntaxe JSONB a été relue avec soin mais jamais testée
-- contre de vraies données. À valider dans l'éditeur SQL Supabase avant de
-- s'y fier en prod :
--   select public.get_public_profile_summary('un_pseudo_de_test_existant');
create or replace function public.get_public_profile_summary(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  is_public boolean;
  want_sport boolean;
  want_intimate boolean;
  target_avatar text;
  sport_sessions jsonb;
  intimate_sessions jsonb;
  result jsonb;
begin
  -- ÉVOLUTION "Login Wall" (01/08) — double sécurité, pas redondante avec
  -- le `revoke`/`grant` en bas de fichier : celui-ci bloque l'appel AVANT
  -- même qu'il n'atteigne cette fonction (Postgrest refuse la requête au
  -- niveau du rôle "anon"). CETTE vérification-ci protège contre le cas où
  -- les droits d'exécution seraient un jour élargis par erreur (ex. un
  -- futur `grant ... to anon` réintroduit sans y penser) — même un appel
  -- qui atteindrait la fonction malgré tout se ferait immédiatement
  -- refouler ici, avant la moindre lecture de `profiles`/`user_data`.
  if auth.uid() is null then
    return null;
  end if;

  select user_id, is_profile_public, show_sport_stats, show_intimate_stats, avatar_url
    into target_user_id, is_public, want_sport, want_intimate, target_avatar
  from profiles
  where username = target_username;

  if target_user_id is null or is_public is not true then
    return null;
  end if;

  result := jsonb_build_object('username', target_username, 'user_id', target_user_id, 'avatar_url', target_avatar);

  -- BUG CORRIGÉ (01/08, suite — retour direct : "j'ai fait une séance
  -- exemple mise comme faite, je la vois pas depuis mon profil") — cette
  -- fonction lisait encore `user_data` (clé 'savedPlaylists', l'ANCIEN
  -- blob JSON unique), alors que la migration "Refonte Structurale —
  -- Round 1/2" (voir plus bas dans ce fichier, useSyncedCollection.js côté
  -- app) a fait basculer TOUTES les sauvegardes/modifications de playlists
  -- vers la nouvelle table relationnelle `playlists` (une VRAIE ligne par
  -- playlist). Résultat concret : depuis cette bascule, cette fonction
  -- restait figée sur une photo de `user_data` prise au moment de la
  -- migration ponctuelle — plus jamais mise à jour par les sauvegardes/
  -- suppressions/modifications réelles faites APRÈS coup. Lit maintenant
  -- directement `playlists`, plus simple ET plus à jour : `is_intimate`
  -- est une VRAIE colonne désormais (plus besoin de la lire depuis le
  -- contenu JSON), et chaque ligne EST déjà une playlist individuelle
  -- (plus besoin de `jsonb_array_elements` pour déplier un tableau).
  if want_sport then
    select coalesce(jsonb_agg(jsonb_build_object(
             'totalDuration', content->'totalDuration',
             'bpm', content->'config'->'bpm'
           )), '[]'::jsonb)
      into sport_sessions
    from playlists
    where user_id = target_user_id and is_intimate = false;

    result := result || jsonb_build_object('sport_sessions', sport_sessions);
  end if;

  if want_intimate then
    select coalesce(jsonb_agg(jsonb_build_object(
             'totalDuration', content->'totalDuration',
             'bpm', content->'config'->'bpm'
           )), '[]'::jsonb)
      into intimate_sessions
    from playlists
    where user_id = target_user_id and is_intimate = true;

    result := result || jsonb_build_object('intimate_sessions', intimate_sessions);
  end if;

  return result;
end;
$$;

-- ÉVOLUTION (01/08, retour direct : "je veux que les profils des autres
-- soient consultables uniquement si tu t'es fait un compte") — un profil
-- "public" n'est donc plus accessible à N'IMPORTE QUI avec le lien, mais
-- seulement à un visiteur CONNECTÉ (n'importe quel compte, pas besoin d'un
-- lien de parenté avec le propriétaire du profil). `anon` retiré du grant :
-- Postgrest refuse désormais l'appel avec la seule clé "anon" (message
-- d'erreur générique de permission côté client, voir ProfileView.jsx qui
-- ne tente même plus l'appel dans ce cas — affiche directement un écran
-- "connecte-toi" sans gaspiller de round-trip réseau voué à échouer).
-- Sans ce `revoke` explicite, ré-exécuter ce fichier sur une base où `anon`
-- avait déjà reçu ce droit (1re version de cette fonction, voir plus haut)
-- ne l'aurait PAS retiré — `grant` ajoute des droits, ne retire jamais ceux
-- déjà accordés ailleurs.
revoke execute on function public.get_public_profile_summary(text) from anon;
grant execute on function public.get_public_profile_summary(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION "Recherche d'utilisateurs" (01/08, Feature Sociale — Navigation)
-- — permet de trouver un profil par pseudo depuis une modale dédiée (voir
-- SearchUsersModal.jsx). Même principe de confidentialité que
-- `get_public_profile_summary` : réservée aux visiteurs CONNECTÉS
-- (`authenticated` uniquement, jamais `anon`) et ne renvoie QUE les
-- profils `is_profile_public = true` — chercher un pseudo resté privé ne
-- doit renvoyer AUCUN résultat, pas même confirmer son existence.
--
-- `ilike` (insensible à la casse) + `%query%` (sous-chaîne, pas seulement
-- préfixe) — plus permissif qu'une recherche stricte, cohérent avec ce
-- qu'on attend d'une barre de recherche ("alex" retrouve "alex_runner" ET
-- "the_alex99"). `limit 20` : borne dure côté serveur, jamais renvoyer une
-- liste illimitée même si la requête matche des centaines de profils —
-- protège aussi contre un usage abusif de cette fonction pour lister TOUS
-- les profils publics d'un coup (une chaîne vide ou très courte matcherait
-- sinon tout le monde).
create or replace function public.search_public_profiles(search_query text)
returns table (username text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.username, p.avatar_url
  from profiles p
  where p.is_profile_public = true
    and auth.uid() is not null
    and length(trim(search_query)) >= 2
    and p.username ilike '%' || trim(search_query) || '%'
  order by p.username asc
  limit 20;
$$;

revoke execute on function public.search_public_profiles(text) from anon;
grant execute on function public.search_public_profiles(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION "Refonte Structurale — Round 1/2" (01/08) — 2 nouvelles tables
-- relationnelles (`playlists`/`routines`, une LIGNE par élément) en
-- PARALLÈLE de `user_data` (clés 'savedPlaylists'/'routines', un seul blob
-- JSON par utilisateur) — pas un remplacement destructeur : `user_data`
-- N'EST PAS vidée par ce fichier, elle reste en place comme filet de
-- sécurité tant que les nouveaux hooks (voir useSyncedCollection.js) n'ont
-- pas été vérifiés en usage réel.
--
-- ⚠️ ÉCART AU BRIEF #1 (id UUID → id text) — le brief demandait `id UUID
-- PRIMARY KEY`, mais les id réels générés côté client pour une playlist/
-- routine sont des CHAÎNES ARBITRAIRES (`pl-1731000000000-a1b2c3d4f`,
-- `routine-1`, `playlist-example-1`... voir musicEngine.js/App.jsx/
-- useRoutines.js) — JAMAIS au format UUID. Une colonne `uuid` stricte
-- aurait rejeté CHAQUE insertion dès le 1er essai (erreur de syntaxe
-- UUID), y compris toute la migration ci-dessous. `text` préserve la
-- compatibilité avec l'existant sans qu'aucun id n'ait besoin d'être
-- régénéré.
--
-- ⚠️ ÉCART AU BRIEF #2 (clé primaire composite `(id, user_id)`, PAS `id`
-- seul comme demandé) — trouvé en relisant ma propre conception avant
-- livraison : la playlist de DÉMONSTRATION par défaut (voir App.jsx,
-- `usePersistentState('savedPlaylists', ...)`) a l'id LITTÉRAL
-- `'playlist-example-1'`, IDENTIQUE pour chaque nouveau compte tant que
-- personne n'a encore sauvegardé sa propre séance (même chose pour
-- `'routine-1'` côté routines) — un `id` seul comme clé primaire GLOBALE
-- (toutes lignes, tous utilisateurs confondus) aurait fait échouer
-- l'insertion du 2e compte à créer un profil dans cet état par défaut :
-- collision de clé primaire sur `'playlist-example-1'` déjà pris par le
-- 1er compte. `(id, user_id)` résout ça sans rien perdre : chaque
-- opération de useSyncedCollection.js filtre de toute façon déjà
-- SYSTÉMATIQUEMENT par `id` ET `user_id` ensemble (jamais l'un sans
-- l'autre), donc ce changement ne coûte rien côté application — même
-- convention déjà utilisée par `user_data` (`primary key (user_id, key)`,
-- voir plus haut dans ce fichier).
create table if not exists playlists (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  is_public boolean not null default false,
  is_intimate boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

alter table playlists enable row level security;

drop policy if exists "Une playlist est lisible par son propriétaire ou si publique" on playlists;
create policy "Une playlist est lisible par son propriétaire ou si publique"
  on playlists for select
  -- ÉVOLUTION (01/08, "Refonte Structurale — Round 2/2") — la lecture
  -- publique exigeait UNIQUEMENT `is_public = true` sur la playlist
  -- elle-même, sans tenir compte ni du Login Wall (déjà en place partout
  -- ailleurs dans cette feature sociale : ProfileView.jsx, get_public_
  -- profile_summary, search_public_profiles) ni du réglage GLOBAL "Rendre
  -- mon profil public" du propriétaire — une playlist individuellement
  -- publique restait donc consultable même par un visiteur non connecté,
  -- ou même si le propriétaire avait depuis désactivé tout son profil.
  -- `exists (...)` vérifie que le PROFIL du propriétaire est bien public en
  -- plus du flag individuel de la playlist — les deux consentements sont
  -- désormais réellement nécessaires ensemble, pas l'un OU l'autre.
  using (
    auth.uid() = user_id
    or (
      is_public = true
      and auth.uid() is not null
      and exists (select 1 from profiles p where p.user_id = playlists.user_id and p.is_profile_public = true)
    )
  );

drop policy if exists "Un utilisateur crée uniquement ses propres playlists" on playlists;
create policy "Un utilisateur crée uniquement ses propres playlists"
  on playlists for insert
  with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur modifie uniquement ses propres playlists" on playlists;
create policy "Un utilisateur modifie uniquement ses propres playlists"
  on playlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur supprime uniquement ses propres playlists" on playlists;
create policy "Un utilisateur supprime uniquement ses propres playlists"
  on playlists for delete
  using (auth.uid() = user_id);

create index if not exists playlists_user_id_idx on playlists (user_id);
-- Index PARTIEL (uniquement les lignes publiques) — la future page "profil
-- public" (Round 2/2) lira surtout `where is_public = true`, jamais la
-- table entière ; un index complet sur toutes les lignes coûterait de
-- l'espace pour rien sur les ~99% de lignes qui resteront privées.
create index if not exists playlists_public_idx on playlists (user_id) where is_public = true;

-- `routines` — MÊME structure exacte que `playlists` (demandée telle
-- quelle par le brief). Note honnête : contrairement à `playlists`, aucune
-- vue de l'app n'expose encore de routine publiquement (pas de toggle, pas
-- d'affichage sur ProfileView.jsx) — `is_public`/`is_intimate` restent donc
-- posées mais INERTES pour l'instant, prêtes pour une future fonctionnalité
-- plutôt qu'un besoin déjà branché aujourd'hui.
create table if not exists routines (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  is_public boolean not null default false,
  is_intimate boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

alter table routines enable row level security;

drop policy if exists "Une routine est lisible par son propriétaire ou si publique" on routines;
create policy "Une routine est lisible par son propriétaire ou si publique"
  on routines for select
  -- Même correction exacte que playlists ci-dessus — voir son commentaire.
  using (
    auth.uid() = user_id
    or (
      is_public = true
      and auth.uid() is not null
      and exists (select 1 from profiles p where p.user_id = routines.user_id and p.is_profile_public = true)
    )
  );

drop policy if exists "Un utilisateur crée uniquement ses propres routines" on routines;
create policy "Un utilisateur crée uniquement ses propres routines"
  on routines for insert
  with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur modifie uniquement ses propres routines" on routines;
create policy "Un utilisateur modifie uniquement ses propres routines"
  on routines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Un utilisateur supprime uniquement ses propres routines" on routines;
create policy "Un utilisateur supprime uniquement ses propres routines"
  on routines for delete
  using (auth.uid() = user_id);

create index if not exists routines_user_id_idx on routines (user_id);
create index if not exists routines_public_idx on routines (user_id) where is_public = true;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION (02/08) — fondations SQL du chantier "Pulses/Leaderboard"
-- (README, "Décisions actées, pas encore implémentées") : SEULEMENT la
-- persona intime (table + génération de pseudonyme + RPC dédiée) —
-- AUCUN pulse, AUCUN leaderboard construit ici. Rien de visible pour
-- l'utilisateur tant qu'un futur chantier ne branche pas une UI dessus ;
-- l'objectif de cette passe est uniquement de poser une fondation sûre,
-- conforme aux règles déjà tranchées dans le README (à relire avant de
-- construire quoi que ce soit par-dessus).
--
-- Pourquoi une table SÉPARÉE plutôt qu'une colonne sur `profiles` : les
-- règles du README exigent que le pseudonyme intime ne soit "jamais joint
-- dans une requête publique" — une colonne sur `profiles` (déjà lue par
-- `get_public_profile_summary`/`search_public_profiles`) rendrait cette
-- séparation fragile (un futur `select *` sur `profiles` l'exposerait par
-- accident). Une table à part, sans AUCUNE policy de lecture publique
-- (voir plus bas), rend cette fuite structurellement impossible plutôt que
-- juste "à ne pas oublier de filtrer".
create table if not exists intimate_personas (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- `intimate_id` : l'identifiant STABLE exposé un jour publiquement (via
  -- la RPC ci-dessous, jamais directement) — généré par Postgres
  -- (`gen_random_uuid()`), AUCUN lien mathématique avec `user_id` ou le
  -- pseudo réel. C'est le "seed" du pseudonyme généré plus bas : en le
  -- faisant dépendre de CETTE valeur (et jamais du username), on garantit
  -- structurellement l'indépendance exigée par le README, plutôt que de
  -- compter sur la discipline du code applicatif pour ne jamais mélanger
  -- les deux.
  intimate_id uuid not null default gen_random_uuid() unique,
  pseudonym text not null,
  created_at timestamptz not null default now(),
  primary key (user_id)
);

alter table intimate_personas enable row level security;

-- Politique de lecture UNIQUE, volontairement restreinte au propriétaire —
-- PAS de policy publique ici, à la différence de `profiles`/`playlists`/
-- `routines` (qui ont toutes une policy "select public"). Une future
-- fonctionnalité de classement intime devra passer par une RPC dédiée
-- (security definer, comme `get_or_create_intimate_persona` ci-dessous),
-- jamais par un accès direct élargi à cette table.
drop policy if exists "Un utilisateur lit uniquement sa propre persona intime" on intimate_personas;
create policy "Un utilisateur lit uniquement sa propre persona intime"
  on intimate_personas for select
  using (auth.uid() = user_id);

-- Pas de policy insert/update/delete cote client, VOLONTAIREMENT : la
-- création passe exclusivement par `get_or_create_intimate_persona`
-- (security definer, contourne RLS en interne) — jamais un insert direct
-- depuis le client, qui pourrait sinon tenter de poser son propre
-- `intimate_id`/`pseudonym` au lieu de les laisser générer côté serveur.

-- Génération du pseudonyme — déterministe à partir de `seed` (toujours
-- `intimate_id`, jamais `user_id` ni le username réel, voir plus haut) :
-- même seed ⇒ même pseudonyme, systématiquement (stable dans le temps,
-- conforme au README : "pas généré à la volée à chaque partage").
-- VOLONTAIREMENT en SQL plutôt qu'en JS côté client : le seed ne doit
-- JAMAIS être choisi ou influencé par le client (un client qui pourrait
-- fournir son propre seed pourrait, par erreur ou malveillance, en
-- choisir un dérivé de son username, recréant exactement le pattern
-- reconnaissable que cette règle interdit) — en gardant toute la chaîne
-- (génération du seed ET du pseudonyme) côté serveur, ce risque n'existe
-- structurellement pas.
--
-- `hashtext(seed::text || ':adj')` / `'... || ':noun'` : 2 hash
-- INDÉPENDANTS du même seed (suffixe différent) pour piocher séparément un
-- adjectif et un nom, plutôt qu'un seul hash découpé en deux (aurait
-- corrélé les deux choix entre eux de façon prévisible). `hashtext()` est
-- une fonction Postgres NATIVE (utilisée en interne pour les index de
-- hachage) — préférée à une manipulation manuelle de `md5()`/conversion
-- bit-à-entier : signature stable et déjà connue, pas de dépendance à un
-- idiome plus difficile à vérifier sans accès direct à un vrai Postgres.
-- `abs(...)` : `hashtext()` renvoie un entier SIGNÉ (peut être négatif) ;
-- sans `abs()`, `%` renverrait un indice ≤ 0 et l'accès au tableau
-- (1-indexé) échouerait silencieusement (NULL plutôt qu'une erreur), pas
-- immédiatement visible en test.
--
-- 20 × 20 = 400 combinaisons — suffisant pour ne pas se répéter à chaque
-- pseudonyme généré, mais PAS conçu pour éliminer toute collision entre
-- utilisateurs à grande échelle (2 personnes pourraient un jour partager
-- le même pseudonyme affiché). Ce n'est PAS un problème de sécurité : deux
-- personas affichant "Loup Discret" restent deux `intimate_id` distincts,
-- jamais confondus par le système, seulement par un lecteur humain — à
-- surveiller si le nombre d'utilisateurs en Mode Intime grandit beaucoup,
-- mais pas une raison de complexifier cette v1 par anticipation.
--
-- VALIDÉ dans l'éditeur SQL Supabase le 02/08 : le seed nul
-- ('00000000-0000-0000-0000-000000000000'::uuid) renvoie systématiquement
-- "Marée Mystère" — confirmé stable sur plusieurs appels d'affilée (pas
-- une seule exécution isolée). Requêtes de vérification laissées ci-dessous
-- pour qu'une future session/un futur seed puisse revalider de la même
-- façon après toute modification de cette fonction :
--   select public.generate_intimate_pseudonym(gen_random_uuid());
--   select public.generate_intimate_pseudonym('00000000-0000-0000-0000-000000000000'::uuid); -- doit toujours renvoyer "Marée Mystère"
create or replace function public.generate_intimate_pseudonym(seed uuid)
returns text
language sql
immutable
as $$
  select
    (array['Loup','Renard','Faucon','Lynx','Orque','Corbeau','Puma','Aigle','Ours','Cerf',
           'Héron','Panthère','Iris','Étoile','Comète','Brume','Marée','Éclipse','Aurore','Tonnerre']
    )[1 + abs(hashtext(seed::text || ':adj') % 20)]
    || ' ' ||
    (array['Discret','Silencieux','Nocturne','Furtif','Libre','Sauvage','Errant','Voilé','Insaisissable','Anonyme',
           'Caché','Lointain','Vagabond','Secret','Indompté','Flottant','Nébuleux','Invisible','Fugace','Mystère']
    )[1 + abs(hashtext(seed::text || ':noun') % 20)];
$$;

-- Point d'entrée UNIQUE pour obtenir/créer SA PROPRE persona intime —
-- `security definer` : contourne RLS en interne (nécessaire pour l'insert
-- initial, la policy ci-dessus n'autorise que la lecture), mais
-- `auth.uid()` reste la SEULE source de vérité sur l'appelant — jamais un
-- paramètre transmis par le client, donc structurellement impossible de
-- demander/lire la persona de quelqu'un d'autre via cette fonction.
--
-- Ne renvoie JAMAIS `user_id` dans le résultat (règle du README,
-- garde-fou anti-corrélation réseau : un visiteur inspectant l'onglet
-- Network ne doit jamais pouvoir faire le lien) — uniquement
-- `intimate_id`/`pseudonym`, les deux seules valeurs qu'une future UI a
-- besoin d'afficher/manipuler.
--
-- Idempotente : un 2e appel pour le même utilisateur renvoie la persona
-- déjà créée (jamais une nouvelle), conforme à "pseudonyme STABLE" du
-- README — pas de possibilité d'en régénérer un autre en rappelant la
-- fonction plusieurs fois.
create or replace function public.get_or_create_intimate_persona()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing intimate_personas%rowtype;
  new_intimate_id uuid;
  new_pseudonym text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into existing from intimate_personas where user_id = auth.uid();

  if found then
    return jsonb_build_object('intimate_id', existing.intimate_id, 'pseudonym', existing.pseudonym);
  end if;

  new_intimate_id := gen_random_uuid();
  new_pseudonym := public.generate_intimate_pseudonym(new_intimate_id);

  insert into intimate_personas (user_id, intimate_id, pseudonym)
  values (auth.uid(), new_intimate_id, new_pseudonym);

  return jsonb_build_object('intimate_id', new_intimate_id, 'pseudonym', new_pseudonym);
end;
$$;

-- Même schéma de verrou que `get_public_profile_summary`/
-- `search_public_profiles` (voir plus haut) : `anon` ne doit jamais pouvoir
-- appeler cette fonction (elle créerait/lirait une persona pour
-- `auth.uid() is null`, qui échoue déjà en interne, mais autant fermer la
-- porte au niveau du rôle directement, sans compter uniquement sur ce
-- garde-fou interne).
revoke execute on function public.get_or_create_intimate_persona() from anon;
grant execute on function public.get_or_create_intimate_persona() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION (02/08) — compteur de clonages (point 4 de l'ordre de priorité,
-- README) : combien de fois une playlist/routine PUBLIQUE a été clonée par
-- quelqu'un d'autre. Volontairement PAR ITEM seulement — pas de classement
-- agrégé par créateur (ce serait le "Leaderboard" du chantier Pulses, pas
-- celui-ci), donc AUCUN lien avec `intimate_personas` : un simple total
-- affiché sur une carte ne révèle jamais qui a cloné quoi, juste combien
-- de fois — pas besoin d'anonymiser un nombre.
--
-- Colonnes ajoutées à `playlists`/`routines` (pas dans `content` jsonb,
-- contrairement à `description` plus haut) : ce total doit être
-- INCRÉMENTABLE de façon atomique par n'importe quel visiteur qui clone —
-- si c'était dans `content`, incrémenter forcerait à relire tout le jsonb,
-- le modifier, le réécrire en entier côté client (risque de race condition
-- entre 2 clonages simultanés : le 2e écraserait l'incrément du 1er). Une
-- vraie colonne + `set clone_count = clone_count + 1` DANS LA MÊME requête
-- SQL est atomique par construction, aucune race condition possible.
alter table playlists add column if not exists clone_count integer not null default 0;
alter table routines add column if not exists clone_count integer not null default 0;

-- ⚠️ Piège DÉJÀ rencontré une fois sur ce projet (voir
-- PlaylistDetailContext.jsx, calcul de `isSaved` avant correction) et
-- qui s'applique ICI À L'IDENTIQUE : la clé primaire de `playlists`/
-- `routines` est COMPOSITE `(id, user_id)`, JAMAIS `id` seul — 2 comptes
-- différents peuvent légitimement partager le même id (la playlist démo
-- d'un compte invité, par exemple). Cibler l'incrément par `target_id`
-- SEUL incrémenterait potentiellement le clone_count d'une playlist
-- appartenant à la MAUVAISE personne si un autre utilisateur possède une
-- ligne avec le même id — `target_user_id` est donc un paramètre
-- OBLIGATOIRE de ces deux fonctions, jamais une simplification "optionnelle".
--
-- Garde-fou anti-abus : `target_user_id = auth.uid()` bloque
-- l'auto-incrémentation (cloner virtuellement son propre contenu pour
-- gonfler son propre compteur) — mais AUCUNE protection contre un compte
-- authentifié qui appellerait cette fonction en boucle sur le contenu de
-- quelqu'un D'AUTRE sans jamais vraiment cloner (pas de vérification que
-- l'appelant possède réellement une copie). Accepté pour cette v1 : c'est
-- une métrique indicative, pas un système anti-fraude — à revisiter
-- seulement si un abus réel est constaté en usage.
--
-- À VALIDER dans l'éditeur SQL Supabase avant de s'y fier en prod (même
-- réserve que les fonctions précédentes) :
--   select clone_count from playlists where id = '...' and user_id = '...'; -- avant
--   select public.increment_playlist_clone_count('...', '...'::uuid);
--   select clone_count from playlists where id = '...' and user_id = '...'; -- après, doit avoir +1
create or replace function public.increment_playlist_clone_count(target_id text, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_user_id = auth.uid() then
    return;
  end if;

  update playlists
  set clone_count = clone_count + 1
  where id = target_id and user_id = target_user_id and is_public = true;
end;
$$;

revoke execute on function public.increment_playlist_clone_count(text, uuid) from anon;
grant execute on function public.increment_playlist_clone_count(text, uuid) to authenticated;

-- Même fonction, même raisonnement, pour les routines.
create or replace function public.increment_routine_clone_count(target_id text, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_user_id = auth.uid() then
    return;
  end if;

  update routines
  set clone_count = clone_count + 1
  where id = target_id and user_id = target_user_id and is_public = true;
end;
$$;

revoke execute on function public.increment_routine_clone_count(text, uuid) from anon;
grant execute on function public.increment_routine_clone_count(text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉVOLUTION (02/08) — compteur de clonages HONNÊTE pour le catalogue de
-- templates (data/curatedSessions.js — vitrine `@tempofit_officiel` ET
-- "Découvrir") : retour direct, "je veux que ce compteur soit honnête, 0
-- par défaut, jamais un chiffre inventé". `template_clone_counts` REMPLACE
-- l'ancien `fakeCloneCountForId` (curatedSessions.js) et les valeurs
-- fixes de `FAKE_VITRINE_ROUTINES` (officialVitrineProfile.js) — les deux
-- deviennent obsolètes et sont retirés côté client.
--
-- Table SÉPARÉE de `playlists`/`routines` : un template n'a JAMAIS de
-- vraie ligne dans ces 2 tables (voir templateToVitrineRow/
-- FAKE_VITRINE_ROUTINES) — rien à réutiliser des colonnes `clone_count`
-- déjà posées dessus. `template_id` sert de clé pour les DEUX catalogues
-- à la fois (templates `curatedSessions.js`, ex. `tpl-...`/`ntpl-...`, ET
-- routines fictives de la vitrine, ex. `vitrine-routine-1`) — aucun
-- risque de collision entre les deux espaces de noms (préfixes distincts),
-- pas besoin de 2 tables séparées pour une différence purement
-- cosmétique.
--
-- Lecture PUBLIQUE (`using (true)`, ni `auth.uid()` ni policy par
-- propriétaire) — volontaire : la vitrine est accessible aux visiteurs
-- NON connectés (voir le Login Wall plus haut, contourné exprès pour
-- cette page), et cette donnée n'a de toute façon rien de sensible (un
-- simple total public, jamais lié à un utilisateur précis). Aucune ligne
-- n'existe tant qu'un premier clonage n'a pas eu lieu — un template
-- jamais cloné n'a AUCUNE ligne ici, le client doit replier sur 0
-- lui-même (`realCloneCounts[id] || 0`), jamais supposer qu'une absence
-- de ligne signifie une erreur.
create table if not exists template_clone_counts (
  template_id text primary key,
  clone_count integer not null default 0
);

alter table template_clone_counts enable row level security;

drop policy if exists "Tout le monde peut lire les compteurs de clonage des templates" on template_clone_counts;
create policy "Tout le monde peut lire les compteurs de clonage des templates"
  on template_clone_counts for select
  using (true);

-- Pas de policy insert/update côté client — uniquement via la RPC
-- ci-dessous (security definer).

-- RPC dédiée — MÊME garde que `increment_playlist_clone_count`/
-- `increment_routine_clone_count` (`auth.uid() is null` bloque un
-- visiteur non connecté, cohérent : un clonage en mode invité n'incrémente
-- déjà aucun des 2 compteurs "réels" non plus, pas de nouvelle
-- incohérence introduite ici). PAS de garde anti-auto-incrémentation ici
-- (contrairement aux 2 fonctions ci-dessus) : un template n'a pas de
-- "propriétaire" au sens `user_id` — n'importe quel compte authentifié
-- qui clone légitimement un template incrémente le compteur, il n'y a
-- personne à protéger d'un auto-clonage.
--
-- `on conflict ... do update` : la 1re incrémentation d'un template crée
-- sa ligne (`clone_count` démarre à 1, jamais 0 — le insert ne se
-- déclenche qu'au moment d'un VRAI clonage), les suivantes l'incrémentent
-- normalement.
--
-- À VALIDER dans l'éditeur SQL Supabase avant de s'y fier en prod :
--   select clone_count from template_clone_counts where template_id = 'tpl-test'; -- doit ne renvoyer AUCUNE ligne avant le 1er clonage
--   select public.increment_template_clone_count('tpl-test');
--   select clone_count from template_clone_counts where template_id = 'tpl-test'; -- doit valoir 1
create or replace function public.increment_template_clone_count(target_template_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into template_clone_counts (template_id, clone_count)
  values (target_template_id, 1)
  on conflict (template_id) do update set clone_count = template_clone_counts.clone_count + 1;
end;
$$;

revoke execute on function public.increment_template_clone_count(text) from anon;
grant execute on function public.increment_template_clone_count(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- MIGRATION — copie chaque ÉLÉMENT du blob JSON `user_data` (clés
-- 'savedPlaylists'/'routines', un tableau par utilisateur) vers UNE LIGNE
-- de la table relationnelle correspondante. `jsonb_array_elements` déplie
-- le tableau ; `cross join lateral` associe chaque élément déplié à la
-- ligne `user_data` (donc au bon `user_id`) dont il provient.
--
-- `on conflict (id, user_id) do nothing` — REJOUABLE sans risque : une 2e
-- exécution (ex. après avoir ajouté de nouveaux utilisateurs) n'écrase
-- jamais une ligne déjà migrée, se contente d'ajouter ce qui manque
-- encore. Cible la clé primaire COMPOSITE `(id, user_id)` (voir plus haut,
-- pourquoi `id` seul aurait pu collisionner entre 2 comptes différents).
-- Aucune suppression : `user_data` n'est PAS vidée par ce script,
-- volontairement (voir plus haut) — à faire manuellement, plus tard, une
-- fois les nouveaux hooks vérifiés en usage réel.
--
-- `coalesce(elem->>'id', ...)` — filet de sécurité si jamais un élément
-- existant n'avait pas de champ `id` du tout (ne devrait pas arriver avec
-- le modèle de données actuel, mais une ligne SANS id ferait échouer
-- toute la migration sur une contrainte `primary key`, pas la peine de
-- risquer ça pour un cas limite).
insert into playlists (id, user_id, content, is_public, is_intimate, created_at)
select
  coalesce(elem->>'id', gen_random_uuid()::text),
  ud.user_id,
  elem,
  false,
  coalesce((elem->>'isNaughty')::boolean, false),
  now()
from user_data ud
cross join lateral jsonb_array_elements(ud.value) as elem
where ud.key = 'savedPlaylists'
on conflict (id, user_id) do nothing;

insert into routines (id, user_id, content, is_public, is_intimate, created_at)
select
  coalesce(elem->>'id', gen_random_uuid()::text),
  ud.user_id,
  elem,
  false,
  false,
  now()
from user_data ud
cross join lateral jsonb_array_elements(ud.value) as elem
where ud.key = 'routines'
on conflict (id, user_id) do nothing;
