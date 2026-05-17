interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export const env: AppEnv = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
