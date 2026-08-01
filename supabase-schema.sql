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
