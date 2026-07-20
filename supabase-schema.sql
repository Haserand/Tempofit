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
