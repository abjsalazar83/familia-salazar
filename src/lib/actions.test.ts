import { expect, it } from 'vitest';
import { actionTab } from './actions';
it('atalhos', () => {
  expect(actionTab('despesa')).toEqual({ tab: 'inicio', panel: 'despesa' });
  expect(actionTab('saldar')).toEqual({ tab: 'inicio', panel: 'saldar' });
  expect(actionTab('compras')?.tab).toBe('compras'); expect(actionTab('historico')?.tab).toBe('historico');
  expect(actionTab('x')).toBeNull(); expect(actionTab(null)).toBeNull();
});
