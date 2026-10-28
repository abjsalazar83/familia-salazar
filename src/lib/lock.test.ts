import { describe, expect, it } from 'vitest';
import { shouldLock, userVerified } from './lock';
describe('bloqueio local', () => {
  it('lê a flag UV', () => {
    const a = new Uint8Array(37); a[32] = 0x01; expect(userVerified(a)).toBe(false);
    a[32] = 0x05; expect(userVerified(a)).toBe(true); expect(userVerified(new Uint8Array(10))).toBe(false);
  });
  it('bloqueia ao abrir e após 60 s fora', () => {
    expect(shouldLock(true, null, 0)).toBe(true); expect(shouldLock(false, null, 0)).toBe(false);
    expect(shouldLock(true, 1000, 30_000)).toBe(false); expect(shouldLock(true, 1000, 61_000)).toBe(true);
  });
});
