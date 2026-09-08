// O tracker mantém os destinos afiliados e acrescenta o nosso identificador em subid.
export const SEGURO_VIDA_DESTINOS = {
  landing: "https://track.guiadoproprietario.pt/go/seguro-vida-landing",
  editorial: "https://track.guiadoproprietario.pt/go/seguro-vida-editorial",
} as const;

export const SEGURO_VIDA_ARTIGOS = [
  {
    "slug": "seguro-vida-credito-habitacao-poupar",
    "titulo": "Seguro de vida do crédito habitação: está a pagar mais do que precisa?",
    "angulo": "Pagar menos",
    "descricao": "Não deixe o seguro de vida renovar por hábito. Peça uma simulação gratuita e descubra se pode reduzir este custo do seu crédito habitação."
  },
  {
    "slug": "mudar-seguro-vida-credito-habitacao-banco",
    "titulo": "Seguro de vida no banco? Descubra se pode pagar menos fora.",
    "angulo": "Sair do seguro do banco",
    "descricao": "Ter o crédito no banco não o impede de procurar outro seguro. Peça uma simulação gratuita e descubra se a mudança pode baixar os seus encargos."
  },
  {
    "slug": "comparar-seguro-vida-credito-habitacao",
    "titulo": "Paga o seguro de vida todos os meses. Está a comprar a proteção certa?",
    "angulo": "Melhor preço e proteção",
    "descricao": "Ponha o preço e a proteção do seu seguro de vida à prova. Descubra cinco pontos que fazem diferença e peça uma simulação gratuita para o seu caso."
  }
] as const;
