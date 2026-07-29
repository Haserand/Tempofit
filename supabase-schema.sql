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
create policy "Tout le monde peut lire les pseudonymes"
  on profiles for select
  using (true);

-- Un utilisateur ne peut créer QUE sa propre ligne (jamais au nom de
-- quelqu'un d'autre) — la contrainte `unique` sur `username` empêche déjà le
-- doublon, cette policy empêche en plus qu'on écrive `user_id` d'un tiers.
create policy "Un utilisateur crée uniquement son propre pseudonyme"
  on profiles for insert
  with check (auth.uid() = user_id);

-- ⚠️ AUCUNE policy `update`/`delete` — volontairement absent, pas un oubli.
-- L'immuabilité du pseudonyme est garantie ICI, côté serveur : même un
-- appel direct à l'API Supabase (en contournant totalement l'UI) ne peut
-- pas modifier ou supprimer une ligne existante, RLS refuse la requête
-- avant même qu'elle n'atteigne la table.
create index if not exists profiles_username_idx on profiles (username);
