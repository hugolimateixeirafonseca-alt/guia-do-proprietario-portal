export const site = {
  nome: "Guia do Proprietário",
  dominio: "https://guiadoproprietario.pt",
  descricao: "Informação prática para cuidar, arrendar e vender imóveis em Portugal.",
  email: "ola@guiadoproprietario.pt"
};

export const redesSociais = [
  { nome: "Facebook", url: "https://www.facebook.com/guiadoproprietario/" },
  { nome: "Instagram", url: "https://www.instagram.com/guiadoproprietario.pt/" }
] as const;

export const NEWSLETTER_ATIVA = false;

export const pilares = [
  { slug: "casa", nome: "Casa e obras", descricao: "Custos reais, manutenção, energia e vizinhança. A casa vivida, não a casa administrativa.", imagemAvif: "/imagens/pilar-casa.avif", imagemWebp: "/imagens/pilar-casa.webp", alt: "Casa portuguesa em manutenção com escadote e lata de tinta" },
  { slug: "vender", nome: "Vender casa", descricao: "Prepare documentos, custos e decisões antes de colocar o imóvel no mercado.", imagemAvif: "/imagens/pilar-vender.avif", imagemWebp: "/imagens/pilar-vender.webp", alt: "Casa portuguesa preparada para venda, com placa, chaves e documentos" },
  { slug: "arrendar", nome: "Arrendamento", descricao: "Organize contratos, rendas e obrigações de senhorio.", imagemAvif: "/imagens/pilar-arrendar.avif", imagemWebp: "/imagens/pilar-arrendar.webp", alt: "Entrada de casa portuguesa com chave e contrato de arrendamento" },
  { slug: "condominio", nome: "Condomínio", descricao: "Prepare assembleias, obras, quotas e decisões do prédio.", imagemAvif: "/imagens/pilar-condominio.avif", imagemWebp: "/imagens/pilar-condominio.webp", alt: "Prédio de condomínio português com mesa preparada para assembleia" },
  { slug: "impostos", nome: "Impostos", descricao: "Perceba os principais impostos, prazos e valores que deve confirmar.", imagemAvif: "/imagens/pilar-impostos.avif", imagemWebp: "/imagens/pilar-impostos.webp", alt: "Casas portuguesas com calendário, moeda e documentos fiscais" }
] as const;

export const avisos = {
  fiscal: "Informação geral sobre fiscalidade. Confirme a aplicação ao seu caso com um contabilista certificado ou a Autoridade Tributária.",
  juridico: "Informação geral sobre temas jurídicos. Não substitui aconselhamento de um advogado ou solicitador.",
  financeiro: "Informação geral para apoiar decisões. Confirme custos, condições e impacto financeiro antes de avançar.",
  nenhum: ""
};

export function formatarData(data: Date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(data);
}
