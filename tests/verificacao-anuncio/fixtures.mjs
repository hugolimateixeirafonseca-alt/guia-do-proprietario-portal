import { ENGINE_VERSION } from "../../src/lib/verificacao-anuncio/constants.mjs";

export const fact = (overrides = {}) => ({
  id: "facto_cidade",
  campo: "cidade",
  presente: true,
  valor: "Porto",
  fontes_imagem: [1],
  citacao: "Porto",
  ...overrides
});

export const extraction = (overrides = {}) => ({
  versao: ENGINE_VERSION,
  factos: [fact()],
  regioes_fotografias: [{ fonte_imagem: 1, x: 0, y: 0, largura: 500, altura: 500 }],
  ...overrides
});

export const classification = (overrides = {}) => ({
  versao: ENGINE_VERSION,
  verificacoes: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    estado: index === 10 ? "nao_verificavel" : "por_confirmar",
    leitura: "confirmar_na_conversa",
    observacao: index === 10 ? "As capturas não permitem confirmar a autorização documental." : "Falta informação explícita.",
    evidencia_ids: []
  })),
  ...overrides
});

export const photo = (id, overrides = {}) => ({
  id,
  sha256: `sha-${id}`,
  phash: "0000000000000000",
  dhash: "0000000000000000",
  ...overrides
});
