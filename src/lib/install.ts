// Regra do banner de instalação: só depois da 2.ª visita ou da 1.ª despesa gravada,
// nunca a editar, nunca já instalada, e 30 dias de silêncio depois de fechado.
export const DAY = 86_400_000;
export type InstallState = { visits: number; saved: boolean; dismissedAt: number | null };
export function shouldShowInstall(s: InstallState, o: { now: number; installed: boolean; editing: boolean; canPrompt: boolean; ios: boolean }): boolean {
  if (o.installed || o.editing) return false;
  if (!o.canPrompt && !o.ios) return false;
  if (s.dismissedAt != null && o.now - s.dismissedAt < 30 * DAY) return false;
  return s.visits >= 2 || s.saved;
}
