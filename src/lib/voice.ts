// Despesa por voz: interpreta frases PT-PT. Só sugere — o formulário é sempre confirmado à mão.
import { STORES } from './receipt';
export type VoiceGuess = { total: number | null; store: string | null; category: string; payer: 'me' | 'other'; personal: boolean; text: string };

const KW: [RegExp, string][] = [
  [/gasolina|gas[oó]leo|combust[ií]vel|\bgpl\b|portage|via verde|estacionamento|uber|bolt|comboio|metro|autocarro|oficina|pneus/i, 'Transporte'],
  [/farm[aá]cia|m[eé]dic|consulta|dentista|hospital|an[aá]lises|[oó]culos/i, 'Saúde'],
  [/escola|livros?|material escolar|propinas|creche|atl/i, 'Escola'],
  [/netflix|spotify|subscri|dropbox|disney|hbo|icloud|google one/i, 'Subscrições'],
  [/restaurante|jantar|almo[cç]o|caf[eé]|cinema|f[eé]rias|bar\b|pizza|mcdonald|lazer/i, 'Lazer'],
  [/\bluz\b|[aá]gua|\bg[aá]s\b|renda|internet|meo|nos\b|vodafone|ikea|leroy|casa|condom[ií]nio|limpeza/i, 'Casa'],
  [/supermercado|mercearia|compras|talho|padaria|peixaria|frutaria/i, 'Supermercado'],
];
const WORDNUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100 };

export function parseVoice(raw: string): VoiceGuess {
  let t = ' ' + raw.toLowerCase().replace(/(\d)\s*€/g, '$1 euros ').replace(/\s+/g, ' ') + ' ';
  t = t.replace(/\b(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\b(?= (euros?|c[eê]ntimos))/g, (w) => String(WORDNUM[w] ?? w));
  let total: number | null = null;
  const m = t.match(/(\d+)(?:\s?[,.]\s?(\d{1,2}))?(?:\s*(?:euros?|eur))?(?:\s*(?:e|com)\s*(\d{1,2})(\s*c[eê]ntimos?)?)?/);
  if (m) {
    const c = m[2] ?? m[3]; const cents = c == null ? 0 : c.length === 1 && !m[4] ? Number(c) * 10 : Number(c);
    total = Number(m[1]) * 100 + cents; t = t.replace(m[0], ' ');
  }
  let payer: VoiceGuess['payer'] = 'me';
  if (/pagou (a |o )?\p{L}+|foi (a |o )?ana|ana pagou/u.test(t) && !/paguei eu|fui eu/.test(t)) payer = 'other';
  const personal = /s[óo] (minha|meu)|pessoal|(n[aã]o|sem) (dividir|partilh)/.test(t);
  t = t.replace(/paguei( eu)?|fui eu|pagou (a |o )?\p{L}+|(a |o )?\p{L}+ pagou|s[óo] (minha|meu)|pessoal|(n[aã]o|sem) (dividir|partilhar)|partilhad[ao]|a meias|\b(euros?|c[eê]ntimos?|no|na|em|de|do|da)\b/gu, ' ');
  const store = STORES.find(([r]) => r.test(raw))?.[1] ?? null;
  const left = t.replace(/[^\p{L}\d ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const desc = store ?? (left ? left[0].toUpperCase() + left.slice(1) : null);
  const category = store ? 'Supermercado' : KW.find(([r]) => r.test(raw))?.[1] ?? 'Outros';
  return { total, store: desc, category, payer, personal, text: raw };
}
