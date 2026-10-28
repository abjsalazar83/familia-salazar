// Atalhos do manifesto (toque longo no ícone).
export function actionTab(a: string | null): { tab: 'mes' | 'compras' | 'fixas' | 'resumo'; panel: '' | 'despesa' | 'saldar' | 'fechar' } | null {
  switch (a) {
    case 'despesa': return { tab: 'mes', panel: 'despesa' };
    case 'saldar': return { tab: 'mes', panel: 'saldar' };
    case 'fechar': return { tab: 'mes', panel: 'fechar' };
    case 'compras': return { tab: 'compras', panel: '' };
    case 'historico': case 'resumo': return { tab: 'resumo', panel: '' };
    case 'contas': case 'fixas': return { tab: 'fixas', panel: '' };
    default: return null;
  }
}
