import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  // Check the environment preference set by the toggle
  const envPreference = localStorage.getItem('sarops_env') || 'remote';
  
  if (envPreference === 'local') {
    return {
      // Matches your config.toml [api] port and [Authentication Keys] Publishable key
      url: 'http://127.0.0.1:54321', 
      key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' 
    };
  }
  
  // Default to cloud settings from environment variables
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY
  };
};

const { url, key } = getSupabaseConfig();
export const supabase = createClient(url, key);
