export const IMAGE_TECHNICAL_PROMPT = 'gpt-image-2 high — base editorial sem texto + composição tipográfica determinística';

const SAFE_DIRECTIONS={
  vender:'Arquitetura residencial portuguesa e elementos económicos abstratos e discretos.',
  impostos:'Casa portuguesa elegante, documentos patrimoniais genéricos e elementos discretos ligados a propriedade.',
  arrendar:'Interior residencial português, chave e documentos genéricos associados a arrendamento.',
  condominio:'Edifício residencial português contemporâneo, detalhes arquitetónicos e documentação genérica.',
  casa:'Habitação portuguesa contemporânea com detalhes arquitetónicos e elementos domésticos discretos.'
};

const SENSITIVE_TERMS=/\b(crime|criminal|polícia|policial|detido|detenção|morte|morto|vítima|agressão|arma|droga|incêndio|explosão)\b/iu;

function normalizeLine(value) {
  return String(value||'').replace(/\s+/gu,' ').trim();
}

function comparable(value) {
  return normalizeLine(value).normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLowerCase();
}

export function safeIllustrationDirection(value,event={}) {
  const direction=normalizeLine(value);
  if (!direction) throw new Error('Safe illustration direction is required');
  const fallback=SAFE_DIRECTIONS[event.pillar]||SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
  const forbidden=[event.title,event.source_name,...(event.entities||[])]
    .map(comparable)
    .filter(item=>item.length>=4);
  const unsafe=direction.length>320
    || /\p{N}/u.test(direction)
    || SENSITIVE_TERMS.test(direction)
    || forbidden.some(item=>normalized.includes(item));
  return unsafe ? fallback : direction;
}

export function buildPublicationImagePrompt({illustrationDirection}) {
  const direction=normalizeLine(illustrationDirection);
  if (!direction) throw new Error('Safe illustration direction is required');

  return `Cria a base visual de um cartão social editorial premium para um portal português sobre habitação e património.

IMPORTANTE
- gerar apenas a composição visual
- não incluir qualquer texto, letras, números, logótipos ou marcas de água
- não incluir títulos, legendas, cápsulas ou tipografia
- reservar 56% da metade esquerda como área tipográfica editorial cuidadosamente desenhada, com espaço negativo elegante
- usar os 44% da metade direita para uma ilustração editorial sofisticada integrada na composição
- fazer a transição entre as duas áreas de forma orgânica, sem caixa branca sobre fotografia

FORMATO
- horizontal 1536x1024
- elementos principais dentro de uma zona central segura

ESTILO
- editorial premium, elegante, adulto e credível
- fundo creme ou marfim, aproximadamente #F4EFE5 ou #F7F2E9
- verde-petróleo escuro dominante, aproximadamente #183A3D ou #1F4E52
- pequenos acentos dourado ou terracota, aproximadamente #B77B52 ou #C28A62
- textura muito subtil e composição com bastante espaço negativo
- estética portuguesa ligada a casa e património
- evitar stock genérico, 3D exagerado ou aspeto infantil

ORIENTAÇÃO VISUAL
${direction}

REGRAS FINAIS
- sem texto visível
- sem letras ou algarismos
- sem logótipos, ícones, selos ou símbolos de marca
- sem marcas de água
- sem nomes de pessoas ou entidades
- sem documentos legíveis
- sem copiar ou imitar imagens de notícias
- devolver uma única base visual pronta para receber tipografia real no renderer`;
}

export function finalizePublication({publishableNews,event,generated}) {
  if (!publishableNews) return {texto_fb:'',texto_site:'',prompt_imagem:'',prompt_tecnico:''};
  if (!generated?.texto_fb||!generated?.texto_site) throw new Error('Publication generation returned incomplete content');
  const illustrationDirection=safeIllustrationDirection(generated.orientacao_ilustracao_segura,event);
  return {
    texto_fb:generated.texto_fb,
    texto_site:generated.texto_site,
    prompt_imagem:buildPublicationImagePrompt({illustrationDirection}),
    prompt_tecnico:IMAGE_TECHNICAL_PROMPT
  };
}
