/**
 * Inflação em Portugal — valores publicados pelo INE (IPC, não harmonizado). Tabela estática; não são dados da família.
 * Fonte: INE, destaques «Índice de Preços no Consumidor» (www.ine.pt):
 *  - dez 2025 (13/01/2026): variação média anual 2,3% em 2025; 2,4% em 2024.
 *  - set 2026 (13/10/2026): variação homóloga 3,6%; média dos últimos 12 meses 2,8%; subjacente 2,7%.
 *  - 2022 7,8% e 2023 4,3%: variação média anual do IPC publicada pelo INE para esses anos.
 * Atualizar ao sair um novo destaque mensal.
 */
export const CPI_ANNUAL: Record<string, number> = { '2022': 7.8, '2023': 4.3, '2024': 2.4, '2025': 2.3 };
export const CPI_LATEST = { ym: '2026-09', yoy: 3.6, avg12: 2.8, core: 2.7, published: '2026-10-13', source: 'INE — IPC, setembro 2026' };

/** Inflação de referência para comparar 12 meses: média dos últimos 12 meses publicada (ou anual do ano). */
export function inflationFor(ym: string): { pct: number; label: string } {
  if (ym >= CPI_LATEST.ym) return { pct: CPI_LATEST.avg12, label: `INE · média 12 meses até ${CPI_LATEST.ym.slice(5)}/${CPI_LATEST.ym.slice(0, 4)}` };
  const y = ym.slice(0, 4);
  if (ym.slice(5) === '12' && CPI_ANNUAL[y] != null) return { pct: CPI_ANNUAL[y], label: `INE · média anual ${y}` };
  return { pct: CPI_LATEST.avg12, label: `INE · média 12 meses até ${CPI_LATEST.ym.slice(5)}/${CPI_LATEST.ym.slice(0, 4)}` };
}

/** Variação real (descontada a inflação), em %. */
export const realChange = (nominalPct: number, inflPct: number) => Math.round(((1 + nominalPct / 100) / (1 + inflPct / 100) - 1) * 1000) / 10;
