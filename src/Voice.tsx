import { useEffect, useRef, useState } from 'react';
import { parseVoice, type VoiceGuess } from './lib/voice';

type SR = { lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean; start(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const Ctor = (): (new () => SR) | undefined => (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
export const voiceSupported = () => typeof window !== 'undefined' && !!Ctor();

const ERR: Record<string, string> = {
  'not-allowed': 'O microfone está bloqueado. Ativa-o em Chrome → cadeado → Definições do site → Microfone, e tenta outra vez.',
  'service-not-allowed': 'O reconhecimento de voz não está disponível neste telemóvel. Escreve a despesa à mão.',
  'no-speech': 'Não ouvi nada. Toca no microfone e diz, por exemplo, «Mercadona 80 euros e 30».',
  'audio-capture': 'Não encontrei microfone.',
  network: 'O reconhecimento de voz precisa de internet neste telemóvel. Escreve à mão ou tenta com rede.',
};

/** Botão de microfone. Só devolve uma sugestão: nada é gravado sem confirmares no formulário. */
export function VoiceButton({ onResult, auto, big }: { onResult: (g: VoiceGuess) => void; auto?: boolean; big?: boolean }) {
  const [on, setOn] = useState(false); const [heard, setHeard] = useState(''); const [err, setErr] = useState('');
  const rec = useRef<SR | null>(null);
  const start = () => {
    const C = Ctor(); setErr(''); setHeard('');
    if (!C) { setErr('Este browser não suporta despesa por voz. Usa o Chrome no Android, ou escreve à mão.'); return; }
    try {
      const r = new C(); rec.current = r;
      r.lang = 'pt-PT'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
      let final = '';
      r.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) { s += e.results[i][0].transcript; if (e.results[i].isFinal) final = s; } setHeard(s); };
      r.onerror = (e) => { if (e.error !== 'aborted') setErr(ERR[e.error] ?? 'Não consegui ouvir. Tenta outra vez ou escreve à mão.'); };
      r.onend = () => { setOn(false); rec.current = null; if (final.trim()) onResult(parseVoice(final)); };
      r.start(); setOn(true);
    } catch { setOn(false); setErr('Não consegui ligar o microfone. Tenta outra vez.'); }
  };
  useEffect(() => { if (auto) start(); return () => rec.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <button className={'act' + (on ? ' rec' : '') + (big ? ' pri' : '')} aria-pressed={on} aria-label={on ? 'A ouvir — toca para parar' : 'Despesa por voz'}
        onClick={() => (on ? rec.current?.abort() : start())}><span className="ic" aria-hidden>🎤</span>{on ? 'A ouvir…' : 'Voz'}</button>
      {(on || heard) && <p className="dim small act-x" aria-live="polite">{heard ? `«${heard}»` : 'Diz, por exemplo: «Mercadona 80 euros e 30, pagou a Ana»'}</p>}
      {err && <p className="err small act-x" role="alert">{err}</p>}
    </>
  );
}
