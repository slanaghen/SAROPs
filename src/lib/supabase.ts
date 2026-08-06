import { createClient } from '@supabase/supabase-js';

let dbInstance;

if (import.meta.env.PROD) {
  // In production, always use the build-time environment variable. Ignore localStorage.
  dbInstance = import.meta.env.VITE_SAROPS_DB_INSTANCE || 'REMOTE';
} else {
  // In development, allow localStorage to override for easy toggling.
  dbInstance = localStorage.getItem('SAROPS_DB_INSTANCE') || import.meta.env.VITE_SAROPS_DB_INSTANCE || 'LOCAL';
}

export const SAROPS_DB_INSTANCE = dbInstance; // LOCAL or REMOTE

const url = dbInstance === 'REMOTE'
  ? import.meta.env.VITE_REMOTE_SUPABASE_URL
  : import.meta.env.VITE_LOCAL_SUPABASE_URL;

const key = dbInstance === 'REMOTE'
  ? import.meta.env.VITE_REMOTE_SUPABASE_ANON_KEY
  : import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(`Missing Supabase Environment Variables for ${dbInstance} instance`);
}

export const supabase = createClient(url, key, {
  auth: {
    // Ensure Local and Remote instances use separate storage buckets to prevent JWT 401 collisions
    storageKey: `sarops-auth-${SAROPS_DB_INSTANCE.toLowerCase()}`,
    persistSession: true,
    autoRefreshToken: true,
  }
});
