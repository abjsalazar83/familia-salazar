import { describe, expect, it } from 'vitest';
import { DAY, shouldShowInstall } from './install';
const o = { now: 100 * DAY, installed: false, editing: false, canPrompt: true, ios: false };
describe('banner de instalação', () => {
  it('não aparece na 1.ª visita sem despesas', () => expect(shouldShowInstall({ visits: 1, saved: false, dismissedAt: null }, o)).toBe(false));
  it('aparece na 2.ª visita ou depois da 1.ª despesa', () => {
    expect(shouldShowInstall({ visits: 2, saved: false, dismissedAt: null }, o)).toBe(true);
    expect(shouldShowInstall({ visits: 1, saved: true, dismissedAt: null }, o)).toBe(true);
  });
  it('nunca a editar, nem instalada, nem sem prompt fora do iOS', () => {
    const s = { visits: 5, saved: true, dismissedAt: null };
    expect(shouldShowInstall(s, { ...o, editing: true })).toBe(false);
    expect(shouldShowInstall(s, { ...o, installed: true })).toBe(false);
    expect(shouldShowInstall(s, { ...o, canPrompt: false })).toBe(false);
    expect(shouldShowInstall(s, { ...o, canPrompt: false, ios: true })).toBe(true);
  });
  it('fica 30 dias calado depois de fechado', () => {
    expect(shouldShowInstall({ visits: 5, saved: true, dismissedAt: o.now - 29 * DAY }, o)).toBe(false);
    expect(shouldShowInstall({ visits: 5, saved: true, dismissedAt: o.now - 31 * DAY }, o)).toBe(true);
  });
});
