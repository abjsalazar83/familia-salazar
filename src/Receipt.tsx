// Talão → texto no próprio telemóvel (Tesseract.js, carregado só quando se usa; ficheiros servidos pela app).
import { useRef, useState } from 'react';
import { parseReceipt, type ReceiptGuess } from './lib/receipt';
import { supabase } from './lib/supabase';

export type ReceiptResult = { guess: ReceiptGuess; photo: Blob };

/** Reduz, passa a cinzento e aumenta o contraste. Devolve a imagem para o OCR e uma JPEG leve para guardar. */
async function prepare(file: File): Promise<{ ocr: HTMLCanvasElement; photo: Blob }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const photo = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('imagem inválida'))), 'image/jpeg', 0.7));
  const img = g.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.6 + 140));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return { ocr: c, photo };
}

export function ReceiptButton({ onResult, big }: { onResult: (r: ReceiptResult) => void; big?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<string | null>(null); const [err, setErr] = useState('');
  const go = async (f: File | undefined) => {
    if (!f) return; setErr(''); setProg('a preparar a foto…');
    try {
      const { ocr, photo } = await prepare(f);
      setProg('a carregar o leitor (só da 1.ª vez)…');
      const { createWorker } = await import('tesseract.js');
      const base = new URL(import.meta.env.BASE_URL + 'tess/', location.href).href;
      const w = await createWorker('por', 1, {
        workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''), gzip: true, workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => setProg(m.status === 'recognizing text' ? `a ler o talão… ${Math.round(m.progress * 100)}%` : 'a carregar o leitor…'),
      });
      const { data } = await w.recognize(ocr); await w.terminate();
      onResult({ guess: parseReceipt(data.text), photo });
    } catch (e) { setErr('Não consegui ler o talão: ' + (e as Error).message + '. Podes preencher à mão.'); }
    setProg(null); if (ref.current) ref.current.value = '';
  };
  return (<>
    <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={(e) => go(e.target.files?.[0])} />
    <button className={big ? 'pri wide' : 'wide'} disabled={!!prog} onClick={() => ref.current?.click()}>{prog ?? '📷 talão'}</button>
    {prog && <div className="bar" aria-hidden><i style={{ width: (Number(prog.match(/(\d+)%/)?.[1]) || 5) + '%' }} /></div>}
    {err && <p className="err small" role="alert">{err}</p>}
  </>);
}

/** Envia a foto para o bucket privado; devolve o caminho ou null (sem rede / migração v8 por aplicar). */
export async function uploadReceipt(familyId: string, expenseId: string, photo: Blob): Promise<string | null> {
  if (!navigator.onLine) return null;
  const path = `${familyId}/${expenseId}.jpg`;
  const { error } = await supabase.storage.from('taloes').upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  return error ? null : path;
}
export async function openReceipt(path: string) {
  const w = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('taloes').createSignedUrl(path, 300);
  if (error || !data) { w?.close(); alert('Não foi possível abrir o talão.'); return; }
  if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
}
