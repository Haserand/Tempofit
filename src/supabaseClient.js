/**
 * supabaseClient.js — Initialisation du client Supabase (auth + base de
 * données), utilisé par AuthContext.jsx et usePersistentState.js.
 *
 * Configuration requise (Vercel → Project Settings → Environment Variables,
 * ET dans un fichier local `.env` pour `npm run dev` — voir `.env.example`) :
 *   - VITE_SUPABASE_URL      : l'URL du projet, sur supabase.com/dashboard →
 *     le projet → Project Settings → Data API
 *   - VITE_SUPABASE_ANON_KEY : la clé "anon public" (PAS la clé "service_role",
 *     qui elle ne doit JAMAIS être exposée côté client) — même page.
 *
 * Contrairement aux clés GetSongBPM/Deezer (secrètes, gardées dans un proxy
 * serverless), la clé "anon" Supabase est CONÇUE pour être publique — la vraie
 * protection des données vient des règles RLS (Row Level Security) posées sur
 * la table `user_data` (voir supabase-schema.sql à la racine du projet), pas
 * du secret de cette clé. Préfixe `VITE_` obligatoire : c'est la convention
 * Vite pour qu'une variable d'environnement soit incluse dans le bundle envoyé
 * au navigateur (celles sans ce préfixe restent invisibles côté client, comme
 * GETSONGBPM_API_KEY/DEEZER_APP_SECRET dans /api).
 *
 * `supabase` vaut `null` tant que ces 2 variables ne sont pas configurées —
 * l'app doit rester utilisable SANS compte (voir usePersistentState.js,
 * AuthContext.jsx) : les comptes sont un ajout, jamais une dépendance dure.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = !!supabase;
