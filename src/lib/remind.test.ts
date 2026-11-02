import { expect, test } from 'vitest';
import { newMonthReminder, reminderText } from './remind';
const d = { from: 'ana', to: 'ant', cents: 2428 };
test('dia 1: mês anterior por saldar e há dívida', () => {
  const r = newMonthReminder('2026-12-01', [{ ym: '2026-10' }], d)!;
  expect(r.ym).toBe('2026-11'); expect(r.key).toBe('fs-dia1-2026-11');
  expect(reminderText(r, 'ant', { ana: 'Ana', ant: 'António' }, (c) => (c / 100).toFixed(2) + ' €')).toBe('Novo mês: Ana deve-te 24.28 € — saldar tudo');
  expect(reminderText(r, 'ana', { ana: 'Ana', ant: 'António' }, (c) => (c / 100).toFixed(2) + ' €')).toBe('Novo mês: Deves 24.28 € a António — saldar tudo');
});
test('sem aviso: mês fechado, sem dívida, janeiro→dezembro', () => {
  expect(newMonthReminder('2026-11-02', [{ ym: '2026-10' }], d)).toBeNull();
  expect(newMonthReminder('2026-12-01', [], null)).toBeNull();
  expect(newMonthReminder('2027-01-01', [], d)!.ym).toBe('2026-12');
  expect(newMonthReminder('2026-11-02', [{ ym: '2026-10', is_deleted: true }], d)!.ym).toBe('2026-10');
});
