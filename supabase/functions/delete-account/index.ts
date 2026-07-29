// supabase/functions/delete-account/index.ts
//
// Edge Function "delete-account" — chantier en suspens depuis la passation
// du 28/07 ("vraie suppression de compte"). Remplace `eraseUserData`
// (AuthContext.jsx, src/), qui n'effaçait que les lignes `user_data` d'un
// utilisateur, jamais le compte `auth.users` lui-même — limite assumée à
// l'époque : supprimer une ligne `auth.users` exige la clé "service_role",
// qui ne doit JAMAIS être exposée côté client (voir supabaseClient.js,
// commentaire sur la clé "anon"). Une Edge Function est le SEUL endroit de
// ce projet où cette clé peut vivre en sécurité — fournie automatiquement
// par la plateforme Supabase via la variable d'environnement
// `SUPABASE_SERVICE_ROLE_KEY`, jamais committée ni visible du navigateur.
//
// ─── Comment ce fichier arrive sur Supabase ─────────────────────────────
// Ce fichier N'EST PAS buildé par Vite (il tourne sur Deno, pas Node/le
// navigateur) — il ne fait donc PAS partie du bundle envoyé au client.
// Deux façons de le déployer, au choix :
//   A) Supabase CLI (si installée) : `supabase functions deploy delete-account`
//      depuis la racine du projet — la CLI lit ce dossier automatiquement.
//   B) Dashboard Supabase (sans rien installer) : Edge Functions → New
//      Function → nommer "delete-account" → coller le contenu de CE fichier
//      dans l'éditeur → Deploy. Les 3 variables d'environnement ci-dessous
//      (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) sont
//      déjà fournies automatiquement par la plateforme à CHAQUE Edge
//      Function de ce projet — rien à configurer manuellement pour elles.
//
// ─── Ce que fait la fonction, dans l'ordre ──────────────────────────────
// 1. Vérifie l'identité de l'appelant à partir du JWT envoyé automatiquement
//    par `supabase.functions.invoke(...)` (voir AuthContext.jsx,
//    `deleteAccount`) — un client "anon" scopé à CE token suffit pour ça,
//    pas besoin de `service_role` à cette étape.
// 2. Supprime le compte via `auth.admin.deleteUser(userId)`, qui EXIGE la
//    clé `service_role` — seul un client Supabase construit avec cette clé
//    (jamais le client "anon") peut appeler cette méthode.
// 3. Cascade AUTOMATIQUE côté Postgres, aucun code supplémentaire ici :
//    `user_data.user_id` ET `profiles.user_id` référencent déjà
//    `auth.users(id) on delete cascade` (voir supabase-schema.sql) — les
//    données synchronisées ET le pseudonyme disparaissent d'eux-mêmes dès
//    que la ligne `auth.users` est supprimée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// CORS : `supabase.functions.invoke(...)` fait un vrai appel HTTP cross-origin
// depuis le navigateur (le domaine de l'app n'est pas celui de la fonction),
// donc une requête `OPTIONS` de pré-vérification arrive AVANT chaque appel
// réel — sans ces en-têtes, le navigateur bloquerait la requête avant même
// qu'elle n'atteigne ce code.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Requête de pré-vérification CORS — aucune logique métier, juste
  // confirmer au navigateur que l'appel réel qui suivra est autorisé.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Non authentifié.' }, 401);
    }

    // Client "anon" scopé au token de l'appelant — sert UNIQUEMENT à
    // vérifier "qui es-tu", jamais à supprimer quoi que ce soit (la clé
    // "anon" ne pourrait pas de toute façon, `auth.admin.*` la refuse).
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Session invalide ou expirée.' }, 401);
    }

    // Client "service_role" — CE client-ci, et lui seul dans tout le projet,
    // a le droit d'appeler `auth.admin.deleteUser`. La clé vit UNIQUEMENT
    // dans cette variable d'environnement fournie par la plateforme, jamais
    // dans un fichier commité (contrairement à SUPABASE_URL/ANON_KEY, qui,
    // eux, sont déjà publics côté client — voir supabaseClient.js).
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (e) {
    return jsonResponse({ error: e?.message || 'Erreur inattendue.' }, 500);
  }
});
