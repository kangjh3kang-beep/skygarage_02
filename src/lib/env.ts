interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const FALLBACK_URL = 'https://ykmeconwqbathcdejalr.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbWVjb253cWJhdGhjZGVqYWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTQ5OTIsImV4cCI6MjA5NDM5MDk5Mn0.zLr_1dxkyJURP87fBxnXtyEuPckzWLGVRo4wuGWvARI';

function resolveSupabaseUrl(raw: string | undefined): string {
  if (!raw) return FALLBACK_URL;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return FALLBACK_URL;
  }
  return cleaned;
}

function resolveSupabaseKey(raw: string | undefined): string {
  if (!raw) return FALLBACK_KEY;
  const cleaned = raw.trim();
  if (!cleaned || cleaned.length < 20) return FALLBACK_KEY;
  return cleaned;
}

export const env: AppEnv = {
  SUPABASE_URL: resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL),
  SUPABASE_ANON_KEY: resolveSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY),
};
