import { createClient } from '@supabase/supabase-js';
// Chave publicável (pública por definição). A segurança vem das regras RLS no servidor.
export const SUPABASE_URL = 'https://luumtyvsssazlexsqudk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_wnE_Rr4upCNwJao-vRXMEw_F0yHtsOM';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
