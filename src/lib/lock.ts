// Bloqueio local por impressão digital/rosto (WebAuthn, autenticador do próprio aparelho).
// Não substitui o login Supabase: a sessão continua guardada; isto só impede abrir a app sem o dedo.
const KEY = 'fs-lock';
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Flag UV (bit 2) do authenticatorData: o aparelho confirmou dedo/rosto/PIN, não só presença. */
export const userVerified = (authData: ArrayBuffer | Uint8Array) => {
  const a = authData instanceof Uint8Array ? authData : new Uint8Array(authData);
  return a.length > 32 && (a[32] & 0x04) !== 0;
};
/** Bloquear ao voltar à app se esteve fora mais que `graceMs`. */
export const shouldLock = (enabled: boolean, hiddenAt: number | null, now: number, graceMs = 60_000) =>
  enabled && (hiddenAt == null || now - hiddenAt >= graceMs);

export const lockEnabled = () => !!localStorage.getItem(KEY);
export const disableLock = () => localStorage.removeItem(KEY);
export async function lockAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}
export async function enableLock(label: string) {
  const c = await navigator.credentials.create({ publicKey: {
    challenge: rnd(32), rp: { name: 'Família Salazar' },
    user: { id: rnd(16), name: label, displayName: label },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60_000, attestation: 'none',
  } }) as PublicKeyCredential | null;
  if (!c) throw new Error('Cancelado.');
  localStorage.setItem(KEY, b64(c.rawId));
}
export async function unlock() {
  const id = localStorage.getItem(KEY); if (!id) return true;
  const a = await navigator.credentials.get({ publicKey: {
    challenge: rnd(32), timeout: 60_000, userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
  } }) as PublicKeyCredential | null;
  if (!a || !userVerified((a.response as AuthenticatorAssertionResponse).authenticatorData)) throw new Error('Impressão digital não confirmada.');
  return true;
}
