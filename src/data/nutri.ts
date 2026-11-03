// Valores aproximados por 100 g de parte edível: kcal, proteína, hidratos, gordura (g).
// Referência: Tabela da Composição de Alimentos (TCA) do INSA — portfir.insa.pt. Valores arredondados,
// para estimativa (≈); o azeite e o tamanho real das doses fazem variar bastante.
export type Nut = [kcal: number, p: number, h: number, g: number];
export const NUT: Record<string, Nut> = {
  bacalhau: [80, 18, 0, 0.6], batata: [80, 2, 17, 0.1], ovo: [149, 12.6, 0.5, 10.8], cebola: [37, 1, 7, 0.2], alho: [118, 6, 23, 0.2],
  azeite: [899, 0, 0, 99.9], leite: [47, 3.3, 4.8, 1.6], broa: [220, 5, 45, 2], paoralado: [360, 12, 72, 3], farinha: [350, 10, 74, 1.2],
  arroz: [350, 7, 78, 0.6], feijao: [95, 6.5, 14, 0.5], grao: [120, 7, 16, 2.5], feijaofrade: [110, 7.5, 18, 0.6], espinafres: [20, 2.6, 0.6, 0.4],
  couve: [30, 3, 3, 0.5], nabicas: [20, 2.5, 1, 0.3], cenoura: [33, 0.8, 7, 0.2], tomate: [20, 0.9, 3.5, 0.2], polpa: [30, 1.5, 5, 0.2],
  pimento: [25, 1, 4.5, 0.3], courgette: [17, 1.5, 2, 0.3], abobora: [26, 1, 5, 0.1], alhofrances: [30, 1.8, 5, 0.3], ervilhas: [80, 5.5, 11, 0.6],
  cogumelos: [22, 3, 1, 0.4], brocolos: [34, 3, 4, 0.5], nabo: [20, 0.7, 4, 0.1], alface: [15, 1.3, 1.6, 0.2], pepino: [12, 0.7, 2, 0.1],
  porco: [140, 21, 0, 6], vitela: [120, 21, 0, 4], vaca: [150, 21, 0, 7], picada: [170, 20, 0, 10], frango: [110, 23, 0, 1.6],
  frangoint: [160, 20, 0, 9], galinha: [150, 20, 0, 8], peru: [105, 23, 0, 1], pato: [190, 18, 0, 13], dobrada: [85, 13, 0, 3.5],
  chourico: [380, 22, 2, 32], entremeada: [300, 15, 0, 27], pescada: [75, 17, 0, 0.7], salmao: [200, 20, 0, 13], sardinha: [150, 19, 0, 8],
  polvo: [70, 15, 1, 0.9], atum: [110, 25, 0, 1], peixe: [90, 18, 0, 2], massa: [360, 12, 73, 1.5], queijo: [280, 22, 2, 20],
  ricota: [140, 10, 3, 10], natas: [150, 3, 5, 13], manteiga: [740, 0.6, 0.5, 82], iogurte: [60, 3.8, 5, 3], azeitonas: [145, 1, 1, 15],
  vinho: [70, 0, 1, 0], limao: [30, 0.5, 6, 0.3], leitecoco: [70, 0.5, 2, 7],
};
/** Gramas por unidade, quando a receita conta unidades. */
export const UNIT_G: Record<string, number> = { ovo: 55, alho: 5, cebola: 100, limao: 60, pimento: 150, tomate: 120, cenoura: 80, courgette: 250, alhofrances: 150 };
/** Despensa: não entra na lista por omissão. */
export const PANTRY = new Set(['azeite', 'alho', 'farinha', 'vinho', 'limao', 'paoralado', 'manteiga', '']);
