import type { Session } from '@supabase/supabase-js';
// Lê a sessão guardada pelo supabase-js (localStorage), para continuar a usar a app sem rede mesmo com o token expirado.
export function readStoredSession(): Session | null {
  try {
    const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
    const s = k ? JSON.parse(localStorage.getItem(k)!) : null;
    return s?.user?.id ? (s as Session) : null;
  } catch { return null; }
}
