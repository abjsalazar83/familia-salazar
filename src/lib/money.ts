export const eur = (c: number) =>
  (c / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }) + ' €';

/** "12,34" | "12.34" | "1 234,5" -> cêntimos; null se inválido. */
export function parseCents(s: string): number | null {
  const t = s.replace(/[\s€]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [i, d = ''] = t.split('.');
  return Number(i) * 100 + Number((d + '00').slice(0, 2));
}
export const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',');
export const ptDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
