// fs-v47 — menu «⋯» (substitui a roda dentada): as opções raras num só sítio. E o «+» grande sempre à mão.
import { IcPlus, IcSwap, IcCheck, IcList, IcBell, IcGear } from './Icons';

export type MenuGo = 'saldar' | 'fechar' | 'lista' | 'receita' | 'eventos' | 'defs-limites' | 'defs-avisos' | 'defs-tema' | 'defs-aparelho' | 'defs';
type Item = { go: MenuGo; ic: React.ReactNode; t: string; s?: string };
export const MENU: { h: string; items: Item[] }[] = [
  { h: 'este mês', items: [
    { go: 'saldar', ic: <IcSwap />, t: 'Acerto avulso', s: 'transferência entre vocês, fora do fecho' },
    { go: 'fechar', ic: <IcCheck />, t: 'Fechar o mês', s: 'saldar tudo e começar a zeros' },
    { go: 'lista', ic: <IcList />, t: 'Lista do mês (como no Keep)' },
    { go: 'eventos', ic: <span>🎉</span>, t: 'Eventos', s: 'aniversários, Páscoa, Natal…' },
    { go: 'receita', ic: <span>＋</span>, t: 'Receita partilhada' },
  ] },
  { h: 'raramente', items: [
    { go: 'defs-limites', ic: <span>🎯</span>, t: 'Limites e meta de poupança' },
    { go: 'defs-avisos', ic: <IcBell />, t: 'Avisos e notificações' },
    { go: 'defs-tema', ic: <span>🎨</span>, t: 'Tema' },
    { go: 'defs-aparelho', ic: <span>👪</span>, t: 'Família, aparelho e sessão', s: 'impressão digital, lista, ecrã, convite, sair' },
    { go: 'defs', ic: <IcGear />, t: 'Todas as definições' },
  ] },
];

export function MenuSheet({ close, go }: { close: () => void; go: (g: MenuGo) => void }) {
  return <>
    <div className="scrim" onClick={close} aria-hidden="true" />
    <div className="bsheet menu-s" role="dialog" aria-label="Menu">
      <div className="grab" aria-hidden="true" />
      {MENU.map((g) => <div key={g.h}><h4>{g.h}</h4>
        {g.items.map((x) => <button key={x.go} className="ms-r" onClick={() => { close(); go(x.go); }}>
          <span className="ms-i" aria-hidden="true">{x.ic}</span><span className="ms-t">{x.t}{x.s && <small>{x.s}</small>}</span><span className="fold-c" aria-hidden="true">›</span></button>)}</div>)}
      <button className="link ms-x" onClick={close}>fechar</button>
    </div>
  </>;
}
export const Fab = ({ onClick }: { onClick: () => void }) => <button className="fab" aria-label="Adicionar movimento" onClick={onClick}><IcPlus /></button>;
