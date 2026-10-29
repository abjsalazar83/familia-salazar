import { IcCamera } from './Icons';
// Talão → texto no próprio telemóvel (Tesseract.js, carregado só quando se usa; ficheiros servidos pela app).
import { useRef, useState } from 'react';
import { parseReceipt, type ReceiptGuess } from './lib/receipt';
import { OCR_W, fitOcr, progressText, receiptErrorText } from './lib/ocr';
import { supabase } from './lib/supabase';

export type ReceiptResult = { guess: ReceiptGuess; photo: Blob };

/** Descodifica já reduzido (fotos de 50 MP rebentam a memória no telemóvel) e respeita a rotação EXIF. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file, { resizeWidth: OCR_W, resizeQuality: 'high', imageOrientation: 'from-image' }); } catch { /* browser antigo */ }
  try { return await createImageBitmap(file); } catch { /* HEIC/formato estranho: tenta <img> */ }
  const url = URL.createObjectURL(file);
  try { const im = new Image(); im.src = url; await im.decode(); return im; }
  catch { throw new ReceiptError('Não consegui abrir essa imagem. Tira a foto outra vez (formato JPG).'); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

/** Reduz, passa a cinzento e aumenta o contraste. Devolve a imagem para o OCR e uma JPEG leve para guardar. */
async function prepare(file: File): Promise<{ ocr: HTMLCanvasElement; photo: Blob }> {
  if (file.type && !file.type.startsWith('image/')) throw new ReceiptError('Esse ficheiro não é uma imagem.');
  const bmp = await decode(file);
  const [w0, h0] = [bmp.width, bmp.height];
  const { w, h } = fitOcr(w0, h0);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); if (!g) throw new ReceiptError('Sem memória para a foto. Fecha outras apps e tenta outra vez.');
  g.drawImage(bmp, 0, 0, w, h); if ('close' in bmp) bmp.close();
  const photo = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new ReceiptError('Não consegui preparar a foto.'))), 'image/jpeg', 0.7));
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.6 + 140));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return { ocr: c, photo };
}

class ReceiptError extends Error {}
const timeout = <T,>(p: Promise<T>, ms: number, msg: string) => new Promise<T>((ok, ko) => { const t = setTimeout(() => ko(new ReceiptError(msg)), ms); p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); ko(e); }); });

type W = { recognize(c: HTMLCanvasElement): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> };
let progCb: (s: string) => void = () => {};
let workerP: Promise<W> | null = null; // reutiliza o leitor entre talões (carregar custa ~10 MB de memória)
function getWorker(onProg: (s: string) => void): Promise<W> {
  progCb = onProg;
  workerP ??= (async () => {
    const { createWorker } = await import('tesseract.js').catch(() => { throw new ReceiptError('Não consegui carregar o leitor. Verifica a internet (só é preciso da 1.ª vez) e tenta outra vez.'); });
    const base = new URL(import.meta.env.BASE_URL + 'tess/', location.href).href;
    return createWorker('por', 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''), gzip: true, workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => progCb(progressText(m.status, m.progress)),
      errorHandler: () => {},
    }) as unknown as Promise<W>;
  })();
  workerP.catch(() => { workerP = null; });
  return workerP;
}

export function ReceiptButton({ onResult, big }: { onResult: (r: ReceiptResult) => void; big?: boolean }) {
  const cam = useRef<HTMLInputElement>(null); const gal = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<string | null>(null); const [err, setErr] = useState('');
  const go = async (f: File | undefined) => {
    if (cam.current) cam.current.value = ''; if (gal.current) gal.current.value = '';
    if (!f) return; setErr(''); setProg('a preparar a foto…');
    try {
      const { ocr, photo } = await prepare(f);
      setProg('a carregar o leitor (só da 1.ª vez, ~5 MB)…');
      const w = await timeout(getWorker(setProg), 90_000, 'O leitor demorou demasiado a carregar. Verifica a internet e tenta outra vez.');
      setProg('a ler o talão…');
      const { data } = await timeout(w.recognize(ocr), 90_000, 'A leitura demorou demasiado. Tenta com a foto mais perto do talão.');
      const guess = parseReceipt(data.text);
      if (!guess.total && !guess.store) setErr('Li a foto mas não encontrei loja nem total. Confirma tudo à mão (ou tira outra foto, direita e com boa luz).');
      onResult({ guess, photo });
    } catch (e) {
      if (!(e instanceof ReceiptError)) { workerP?.then((w) => w.terminate()).catch(() => {}); workerP = null; }
      setErr(e instanceof ReceiptError ? e.message : receiptErrorText(e));
    }
    setProg(null);
  };
  return (<>
    <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => go(e.target.files?.[0])} />
    <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={(e) => go(e.target.files?.[0])} />
    <button className={'act' + (big ? ' pri' : '')} disabled={!!prog} aria-label={prog ?? 'Ler talão'} onClick={() => cam.current?.click()}><span className="ic"><IcCamera /></span>{prog ? 'A ler…' : 'Talão'}</button>
    {prog && <div className="bar act-x" aria-hidden><i style={{ width: (Number(prog.match(/(\d+)%/)?.[1]) || 5) + '%' }} /></div>}
    {!prog && <button className="link small act-x" onClick={() => gal.current?.click()}>ou escolher foto da galeria</button>}
    {prog && <p className="dim small act-x" aria-live="polite">{prog}</p>}
    {err && <p className="err small act-x" role="alert">{err} Podes sempre preencher à mão.</p>}
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
