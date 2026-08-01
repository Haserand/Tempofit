-- supabase-schema.sql — À exécuter UNE FOIS dans Supabase → le projet →
-- SQL Editor → New query → coller ce fichier entier → Run.
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

create policy "Un utilisateur lit uniquement ses propres données"
  on user_data for select
  using (auth.uid() = user_id);

create policy "Un utilisateur crée uniquement ses propres données"
  on user_data for insert
  with check (auth.uid() = user_id);

create policy "Un utilisateur modifie uniquement ses propres données"
  on user_data for update
  using (auth.uid() = user_id);

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
-- fichier. Elle est désormais intégrée ICI aussi, pour qu'une INSTALLATION
-- NEUVE (un `supabase-schema.sql` exécuté une seule fois sur un projet vide)
-- obtienne le schéma complet dès le départ, sans dépendre d'un second fichier
-- de migration qui n'est pas commité dans le dépôt. Si le projet Supabase
-- existe déjà et a SEULEMENT `user_data`, utiliser plutôt
-- `supabase-migration-profiles.sql` pour n'ajouter que ce qui manque (voir
-- la note en tête de ce fichier sur pourquoi ne jamais relancer ce fichier
-- entier sur un projet déjà initialisé).
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
  add column if not exists show_intimate_stats boolean not null default false;

drop policy if exists "Tout le monde peut lire les pseudonymes" on profiles;

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

create policy "Un utilisateur crée uniquement son propre pseudonyme"
  on profiles for insert
  with check (auth.uid() = user_id);

-- Modification autorisée maintenant (contrairement à avant) — mais
-- UNIQUEMENT pour avatar_url/is_profile_public/show_sport_stats/
-- show_intimate_stats : le pseudo reste IMMUABLE, garanti ci-dessous par un
-- trigger dédié plutôt que par la simple absence de policy update (qui ne
-- suffit plus, puisqu'une policy update doit désormais exister pour ces
-- 4 nouvelles colonnes).
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
  all_playlists jsonb;
  sport_sessions jsonb;
  intimate_sessions jsonb;
  result jsonb;
begin
  select user_id, is_profile_public, show_sport_stats, show_intimate_stats, avatar_url
    into target_user_id, is_public, want_sport, want_intimate, target_avatar
  from profiles
  where username = target_username;

  if target_user_id is null or is_public is not true then
    return null;
  end if;

  result := jsonb_build_object('username', target_username, 'avatar_url', target_avatar);

  -- Lecture de `user_data` retardée jusqu'ICI, seulement si au moins une
  -- des 2 bascules est active — inutile de lire quoi que ce soit sinon
  -- (profil public mais aucune stat consentie à être montrée).
  if want_sport or want_intimate then
    select value into all_playlists
    from user_data
    where user_id = target_user_id and key = 'savedPlaylists';

    all_playlists := coalesce(all_playlists, '[]'::jsonb);

    if want_sport then
      select coalesce(jsonb_agg(jsonb_build_object(
               'totalDuration', elem->'totalDuration',
               'bpm', elem->'config'->'bpm'
             )), '[]'::jsonb)
        into sport_sessions
      from jsonb_array_elements(all_playlists) elem
      where coalesce((elem->>'isNaughty')::boolean, false) = false;

      result := result || jsonb_build_object('sport_sessions', sport_sessions);
    end if;

    if want_intimate then
      select coalesce(jsonb_agg(jsonb_build_object(
               'totalDuration', elem->'totalDuration',
               'bpm', elem->'config'->'bpm'
             )), '[]'::jsonb)
        into intimate_sessions
      from jsonb_array_elements(all_playlists) elem
      where coalesce((elem->>'isNaughty')::boolean, false) = true;

      result := result || jsonb_build_object('intimate_sessions', intimate_sessions);
    end if;
  end if;

  return result;
end;
$$;

grant execute on function public.get_public_profile_summary(text) to anon, authenticated;
