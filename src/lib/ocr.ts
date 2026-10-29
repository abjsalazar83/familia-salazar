// Regras puras do leitor de talões (testáveis sem browser).
export const OCR_W = 1400;
/** Tamanho para o OCR: largura até 1400 px, altura até 3200 px (talões compridos), sem ampliar. */
export function fitOcr(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, OCR_W / w, 3200 / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
export function progressText(status: string, p: number): string {
  const pc = Math.round((p || 0) * 100);
  if (status === 'recognizing text') return `a ler o talão… ${pc}%`;
  if (/traineddata/.test(status)) return `a carregar o dicionário português… ${pc}%`;
  if (/core/.test(status)) return `a carregar o leitor… ${pc}%`;
  return 'a preparar o leitor…';
}
export function receiptErrorText(e: unknown): string {
  const m = String((e as Error)?.message ?? e ?? '');
  if (/memory|alloc|OOM|Aborted/i.test(m)) return 'O telemóvel ficou sem memória a ler a foto. Fecha outras apps e tenta outra vez.';
  if (/fetch|network|load|404|NetworkError/i.test(m)) return 'Não consegui descarregar o leitor. Verifica a internet (só é preciso da 1.ª vez) e tenta outra vez.';
  if (/wasm|WebAssembly|compile/i.test(m)) return 'Este browser não consegue correr o leitor. Atualiza o Chrome e tenta outra vez.';
  return 'Não consegui ler o talão (' + (m.slice(0, 80) || 'erro desconhecido') + ').';
}
