import { describe, expect, it } from 'vitest';
import { actionTab } from './actions';
it('atalhos', () => {
  expect(actionTab('despesa')).toEqual({ tab: 'mes', panel: 'despesa' });
  expect(actionTab('saldar')).toEqual({ tab: 'mes', panel: 'saldar' });
  expect(actionTab('compras')?.tab).toBe('compras'); expect(actionTab('historico')?.tab).toBe('resumo'); expect(actionTab('contas')?.tab).toBe('fixas'); expect(actionTab('fechar')).toEqual({ tab: 'mes', panel: 'fechar' });
  expect(actionTab('x')).toBeNull(); expect(actionTab(null)).toBeNull();
});
describe('atalho voz', () => { it('?acao=voz abre a captura por voz', () => expect(actionTab('voz')).toEqual({ tab: 'mes', panel: 'voz' })); });
describe('atalhos v42', () => {
  it('agenda, subscrições e viagens abrem a vista certa em «fixas»', () => {
    expect(actionTab('agenda')).toEqual({ tab: 'fixas', panel: '', view: 'agenda' });
    expect(actionTab('subscricoes')?.view).toBe('subs');
    expect(actionTab('viagem')?.view).toBe('viagens');
  });
});
