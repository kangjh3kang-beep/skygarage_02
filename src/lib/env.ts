interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    '[env] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Supabase features (images, media, forms) will not work. ' +
    'Set these in your deployment environment variables.',
  );
}

export const env: AppEnv = {
  SUPABASE_URL: url || '',
  SUPABASE_ANON_KEY: key || '',
};
