// Atalhos do manifesto (toque longo no ícone).
export function actionTab(a: string | null): { tab: 'inicio' | 'compras' | 'historico' | 'contas'; panel: '' | 'despesa' | 'saldar' | 'fechar' } | null {
  switch (a) {
    case 'despesa': return { tab: 'inicio', panel: 'despesa' };
    case 'saldar': return { tab: 'inicio', panel: 'saldar' };
    case 'compras': return { tab: 'compras', panel: '' };
    case 'historico': return { tab: 'historico', panel: '' };
    case 'contas': return { tab: 'contas', panel: '' };
    case 'fechar': return { tab: 'inicio', panel: 'fechar' };
    default: return null;
  }
}
