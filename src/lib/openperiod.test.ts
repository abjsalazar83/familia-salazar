import { expect, test } from 'vitest';
import { openFrom } from './monthclose';
test('período em aberto começa depois do último fecho ativo', () => {
  expect(openFrom([])).toBe(null);
  expect(openFrom([{ ym: '2026-09', is_deleted: false }, { ym: '2026-10', is_deleted: false }])).toBe('2026-11-01');
  expect(openFrom([{ ym: '2026-12', is_deleted: true }, { ym: '2026-10', is_deleted: false }])).toBe('2026-11-01');
  expect(openFrom([{ ym: '2026-12', is_deleted: false }])).toBe('2027-01-01');
});
