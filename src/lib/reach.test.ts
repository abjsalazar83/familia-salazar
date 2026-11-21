// fs-v48 — checklist de alcance: a simplificação da interface não retirou nada.
// Cada funcionalidade tem de continuar a ter uma entrada (botão/linha/menu) e o ecrã que abre.
import { describe, expect, it } from 'vitest';
import app from '../App.tsx?raw';
import month from '../Month.tsx?raw';
import resumo from '../Resumo.tsx?raw';
import defs from '../Defs.tsx?raw';
import menu from '../Menu.tsx?raw';
import eventos from '../Eventos.tsx?raw';
import dayone from '../DayOne.tsx?raw';
import actions from './actions.ts?raw';
import sw from '../../public/sw.js?raw';

const SRC = { app, month, resumo, defs, menu, eventos, dayone, actions } as const;
type F = keyof typeof SRC;
// [funcionalidade, onde fica agora (para o relatório), provas: [ficheiro, texto que tem de existir]]
const CHECK: [string, string, [F, string][]][] = [
  ['Adicionar (folha)', '«+» grande sempre visível → folha Adicionar', [['menu', 'className="fab"'], ['app', "setTab('mes'); setPanel('mais'); }} />"], ['month', "panel === 'mais' || panel === 'talao' || panel === 'voz') && <AddSheet"]]],
  ['Escrever', '«+» → Escrever', [['month', '>Escrever</button>']]],
  ['Voz', '«+» → Voz', [['month', '<VoiceButton']]],
  ['Talão', '«+» → Talão', [['month', '<ReceiptButton']]],
  ['Da lista (carrinho)', '«+» → Da lista', [['month', 'Da lista</button>'], ['month', 'p.goList']]],
  ['Receita partilhada', '«+» → «+ Receita» e menu «⋯» → Receita partilhada', [['month', '+ Receita</button>'], ['menu', "go: 'receita'"], ['month', "panel === 'receita' ? <div className=\"card sheet\"><IncomeForm"]]],
  ['Lançar fixa que já saiu', 'Avisos → Faltam lançar, e atalhos na folha «+»', [['month', '<Faltam '], ['month', 'ou lança uma fixa que já saiu da conta'], ['month', 'fixa={fx}']]],
  ['Saldar / fechar o mês', 'topo do Mês → Saldar mês; menu «⋯» → Fechar o mês; Avisos (dia 1)', [['app', "onClick={() => setPanel('fechar')}><span className=\"ic\"><IcCheck /></span>Saldar mês"], ['menu', "go: 'fechar'"], ['month', "panel === 'fechar' && <CloseMonth"], ['dayone', 'onClick={open}>Saldar mês']]],
  ['Acerto avulso', 'menu «⋯» → Acerto avulso', [['menu', "go: 'saldar'"], ['app', "g === 'saldar' || g === 'fechar' || g === 'lista' || g === 'receita') { setTab('mes'); setPanel(g)"], ['month', "panel === 'saldar' && <SettleForm"]]],
  ['Acertos por confirmar', 'Avisos → Acerto por confirmar · Confirmar; e histórico de acertos', [['month', 'Acerto por confirmar'], ['month', 'confirmS(s.id)']]],
  ['Histórico de acertos', 'Mês, fim da lista', [['month', 'histórico de acertos']]],
  ['Keep (nota do mês)', 'topo do Mês → Keep; menu «⋯» → Keep', [['app', "onClick={() => setPanel('lista')}><span className=\"ic\"><IcList /></span>Keep"], ['menu', "go: 'lista'"], ['month', "panel === 'lista' && <Lista"]]],
  ['Por confirmar (inbox)', 'Avisos → N por confirmar', [['month', '<Inbox ']]],
  ['Lembretes (pagamentos, viagem, meio do mês)', 'Avisos', [['month', '<MonthCards ']]],
  ['Aviso do dia 1', 'Avisos', [['month', '<DayOne ']]],
  ['Eventos a decorrer', 'Avisos (toca → Resumo) e Resumo › mais', [['month', '<EventAlerts '], ['resumo', '<EventFolds ']]],
  ['Eventos · gerir', 'menu «⋯» → Eventos (abre Resumo › Eventos · gerir)', [['menu', "go: 'eventos'"], ['app', "sessionStorage.setItem('fs-open', 'eventos')"], ['eventos', "sessionStorage.getItem('fs-open') === 'eventos'"], ['eventos', 'id="eventos"'], ['eventos', '<EventsManager ']]],
  ['Movimentos: filtro, pesquisa, retiradas', 'Mês (como antes)', [['month', 'matchExpense(e, q)'], ['month', 'setWho'], ['month', 'setShowGone']]],
  ['Resumo: total, saldo, poupança, ritmo', 'Resumo, topo', [['resumo', 'gastámos {eur(curT.total)}'], ['resumo', 'deve-te'], ['resumo', 'poupança'], ['resumo', 'ritmo →']]],
  ['Meta de poupança', 'Resumo › o essencial › Meta', [['resumo', '<GoalCard g={goal} />']]],
  ['Categorias e 6 meses', 'Resumo › o essencial › Categorias', [['resumo', '<CatBars rows={catRowsSel}'], ['resumo', 'className="mb"'], ['resumo', 'className="mdet']]],
  ['Mês fora do normal', 'Resumo, logo a seguir ao topo', [['resumo', '<OffMonth ']]],
  ['Meninas & escola', 'Resumo › mais', [['resumo', '<KidsCard ']]],
  ['vs ano passado', 'Resumo › mais', [['resumo', '<YoYCard ']]],
  ['Limites do mês', 'Resumo › mais (quando há limites)', [['resumo', '<Limits data={data} />']]],
  ['Histórico, poupança, dicas, lojas, notas, meses', 'Resumo › mais › Histórico', [['resumo', '<Savings '], ['resumo', '<Overview '], ['resumo', 'onde poupar'], ['resumo', 'supermercado por loja'], ['resumo', '<Notes '], ['resumo', 'reabrir mês'], ['resumo', 'className="msearch"']]],
  ['Definições (todas)', 'menu «⋯» → Todas as definições', [['menu', "go: 'defs'"], ['app', "setTab('defs')"], ['app', "tab === 'defs' && <><Settings"]]],
  ['Tema', 'menu «⋯» → Tema', [['menu', "go: 'defs-tema'"], ['defs', 'id="defs-tema"'], ['defs', '<ThemePicker ']]],
  ['Limites e meta (editar)', 'menu «⋯» → Limites e meta de poupança', [['menu', "go: 'defs-limites'"], ['defs', 'id="defs-limites"'], ['defs', '<LimitsEdit '], ['defs', '<Savings data={data} extra={extra} online={online} settings />']]],
  ['Avisos e notificações', 'menu «⋯» → Avisos e notificações', [['menu', "go: 'defs-avisos'"], ['defs', 'id="defs-avisos"'], ['defs', '<NotifySettings ']]],
  ['Aparelho, família, sessão', 'menu «⋯» → Família, aparelho e sessão', [['menu', "go: 'defs-aparelho'"], ['defs', 'id="defs-aparelho"'], ['defs', '<Lock />'], ['defs', '<ListaAlias '], ['defs', '<Screen />'], ['defs', 'convite'], ['defs', 'terminar sessão']]],
  ['Separadores', 'barra de baixo (como antes)', [['app', "tab === 'compras'"], ['app', "tab === 'receitas'"], ['app', "tab === 'fixas'"], ['app', "tab === 'resumo'"]]],
  ['Atalhos do ícone (?acao=)', 'como antes', [['app', "searchParams.get('acao')"], ['actions', 'saldar']]],
];

describe('fs-v47+ · nada foi retirado', () => {
  it.each(CHECK)('%s → %s', (_n, _onde, provas) => {
    for (const [f, needle] of provas) expect(SRC[f], `${f}: «${needle}»`).toContain(needle);
  });
  it('o menu «⋯» substitui a roda dentada e cada opção tem destino', () => {
    expect(app).toContain('aria-label="Menu"'); expect(app).toContain('<MenuSheet');
    const gos = [...menu.matchAll(/go: '([a-z-]+)'/g)].map((m) => m[1]);
    expect(gos.length).toBe(10);
    for (const g of gos) {
      if (g.startsWith('defs-')) expect(defs).toContain(`id="${g}"`);
      else if (g !== 'defs' && g !== 'eventos') expect(app).toMatch(new RegExp(`'${g}'`));
    }
  });
  it('v44 mantém-se: nenhuma fixa é lançada sozinha', () => {
    for (const s of [app, month]) expect(s).not.toMatch(/useAutoPost\(/);
  });
  it('versão igual na app e no service worker', () => {
    const v = app.match(/APP_V = '(fs-v\d+)'/)?.[1]; expect(v).toBeTruthy(); expect(sw).toContain(`VERSION = '${v}'`);
  });
});
