interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

function sanitizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  // Remove any trailing path segments that shouldn't be part of the base URL
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const url = sanitizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  console.warn(
    '[env] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Supabase features (images, media, forms) will not work. ' +
    'Set these in your deployment environment variables.',
  );
}

export const env: AppEnv = {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key,
};
