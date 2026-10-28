import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFamily, useOnline, type FamilyData } from './lib/useFamily';
import { calculateHouseholdBalance, splitEqual } from './lib/balance';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { CATS, type Bill, type Budget, type Expense, type HistoryMonth, type Item, type Member } from './lib/types';
import { useExtra, Savings, Upcoming, CloseMonth, Money, NotifySettings, PorLancar, type Extra } from './Plan';
import { hasV7, monthlyEq } from './lib/plan';
import { averages, byStore, currentPace, costByCategory, fixedVsVariable, monthly, savingTips, ymLabel } from './lib/history';
import { THEMES, type ThemeId } from './themes';
import { crossings, usage } from './lib/budget';
import { disableLock, enableLock, lockAvailable, lockEnabled, shouldLock, unlock } from './lib/lock';
import { msg, displayMode, LimitsEdit, Limits, Notes, type Ctx } from './App';

function Lock() {
  const [on, setOn] = useState(lockEnabled()); const [ok, setOk] = useState<boolean | null>(null); const [err, setErr] = useState('');
  useEffect(() => { lockAvailable().then(setOk); }, []);
  const toggle = async () => { setErr(''); try { if (on) disableLock(); else await enableLock('Família Salazar'); setOn(lockEnabled()); } catch (e) { setErr(msg(e)); } };
  return (<><h3>entrada rápida</h3><ul className="list">
    <li className="li"><span className="grow">pedir impressão digital ao abrir</span>{ok ? <button className="link" onClick={toggle}>{on ? 'desligar' : 'ligar'}</button> : <span className="dim small">{ok === false ? 'sem leitor neste aparelho' : '…'}</span>}</li>
    <li className="li dim small">bloqueio só deste aparelho: a sessão continua iniciada; a impressão digital fica no telemóvel e nunca sai dele. Se falhar, entra com email.</li>
  </ul>{err && <p className="err small" role="alert">{err}</p>}</>);
}
function Screen() {
  const [mode, setMode] = useState(displayMode());
  useEffect(() => { const f = () => setMode(displayMode()); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [bip, setBip] = useState(!!window.__bip);
  useEffect(() => { const f = () => setBip(!!window.__bip); window.addEventListener('fs-bip', f); return () => window.removeEventListener('fs-bip', f); }, []);
  const install = async () => { const e = window.__bip; if (!e) return; await e.prompt(); await e.userChoice.catch(() => null); window.__bip = null; setBip(false); };
  const canFs = !!document.documentElement.requestFullscreen && !ios;
  const toggle = async () => { try { if (document.fullscreenElement) { localStorage.setItem('fs-autofs', 'off'); await document.exitFullscreen(); } else { localStorage.removeItem('fs-autofs'); await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } } catch { /* recusado pelo browser */ } setMode(displayMode()); };
  return (<><h3>ecrã</h3><ul className="list">
    <li className="li"><span className="grow">modo atual</span><span className="acc">{mode === 'fullscreen' ? 'ecrã inteiro' : mode === 'standalone' ? 'app instalada' : 'browser'}</span></li>
    {canFs && <li className="li"><span className="grow">ecrã inteiro</span><button className="link" onClick={toggle}>{document.fullscreenElement ? 'sair' : 'ativar'}</button></li>}
    <li className="li dim small" style={{display:'block',wordBreak:'break-all'}}>
      diagnóstico · modo: {['fullscreen','standalone','minimal-ui','browser'].find(m => matchMedia('(display-mode: ' + m + ')').matches) ?? '?'}
      {' · instalada: '}{(matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || new URLSearchParams(location.search).get('source') === 'pwa' || sessionStorage.getItem('fs-pwa') === '1') ? 'sim' : 'não'}
      {' · '}{location.href}{' · '}{navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? ''}
    </li>
    {bip && mode === 'browser' && <li className="li"><span className="grow">instalar como app</span><button className="pri" onClick={install}>instalar app</button></li>}
    {mode === 'browser' && <li className="li dim small">{ios ? 'Safari → Partilhar → Adicionar ao ecrã principal, e abre pelo ícone.' : 'Chrome → ⋮ → Instalar app / Adicionar ao ecrã principal, e abre pelo ícone.'}</li>}
    {ios && mode === 'standalone' && <li className="li dim small">no iPhone isto já é o máximo: a barra de estado fica por cima da app.</li>}
  </ul></>);
}
export default function Settings({ data, online, theme, setTheme, mutate, run, state, setToast, extra }: Ctx & { theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const [copied, setCopied] = useState(false);
  const code = data.family!.invite_code;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão: o código fica visível */ } };
  return (
    <>
      <h3>tema</h3>
      <ul className="list themes" role="radiogroup" aria-label="Tema">{THEMES.map((t) => (
        <li key={t.id}><button role="radio" aria-checked={theme === t.id} className={'li theme' + (theme === t.id ? ' on' : '')} onClick={() => setTheme(t.id)}>
          <span className="sw" style={{ background: t.bg, boxShadow: `inset -10px 0 0 ${t.acc}` }} /><span className="grow">{t.name}</span>{theme === t.id && <span className="acc">●</span>}</button></li>))}</ul>
      <Lock />
      <Screen />
      <LimitsEdit data={data} mutate={mutate} run={run} state={state} online={online} setToast={setToast} extra={extra} />
      <Savings data={data} extra={extra} online={online} settings />
      <NotifySettings data={data} extra={extra} online={online} />
      <h3>família</h3>
      <ul className="list">{data.members.map((m) => <li key={m.id} className="li"><span className="grow">{m.display_name}</span>{m.id === data.me!.id && <span className="dim">tu</span>}</li>)}
        <li className="li"><span className="grow dim">convite</span><span className="num acc">{code}</span><button className="link" onClick={copy}>{copied ? 'copiado' : 'copiar'}</button></li></ul>
      <h3>sessão</h3>
      <button className="link" disabled={!online} onClick={() => supabase.auth.signOut()}>terminar sessão</button>{!online && <p className="dim small">só com rede, para não perder o que está por sincronizar</p>}
    </>
  );
}
