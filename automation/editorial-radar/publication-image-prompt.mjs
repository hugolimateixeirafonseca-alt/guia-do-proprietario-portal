export const IMAGE_TECHNICAL_PROMPT = 'gpt-image-2 high — ilustração editorial não fotorealista sem texto + composição tipográfica determinística';

const SAFE_DIRECTIONS={
  vender:'Ilustração editorial arquitetónica premium, claramente não fotorealista, da entrada de uma habitação portuguesa, com chave de casa em primeiro plano e contexto visual sóbrio de decisão de venda, sem sinalética nem texto.',
  impostos:'Ilustração editorial arquitetónica premium, claramente não fotorealista, de uma habitação portuguesa com pasta documental fechada e elementos administrativos discretos, sem texto, números ou documentos legíveis.',
  arrendar:'Ilustração editorial arquitetónica premium, claramente não fotorealista, da entrada de um prédio residencial português, com porta de apartamento, chave de casa em primeiro plano e corredor comum discreto associado ao arrendamento.',
  condominio:'Ilustração editorial arquitetónica premium, claramente não fotorealista, da entrada comum de um prédio residencial português, com intercomunicador sem texto, caixas de correio neutras e varandas ao fundo.',
  casa:'Ilustração editorial arquitetónica premium, claramente não fotorealista, de uma habitação portuguesa contemporânea, com formas simplificadas e elementos concretos ligados ao tema da notícia.'
};

const SENSITIVE_TERMS=/\b(crime|criminal|polícia|policial|detido|detenção|morte|morto|vítima|agressão|arma|droga|incêndio|explosão)\b/iu;
const NEWS_DETAIL_TERMS=/(?:https?:\/\/|www\.|\b[\w-]+\.(?:pt|com|org|net)\b|[€$£]|\b(?:euros?|milh(?:ão|ões)|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|hoje|ontem)\b)/iu;
const INTERNAL_LINK_RE=/\]\(\/(?:casa|vender|arrendar|condominio|impostos|calendario|simuladores)\/\)/giu;

function normalizeLine(value) {
  return String(value||'').replace(/\s+/gu,' ').trim();
}
function comparable(value) {
  return normalizeLine(value).normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLowerCase();
}
function values(value) {
  return Array.isArray(value) ? value : [value];
}
function wordCount(value) {
  return (String(value||'').match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)||[]).length;
}
function section(markdown,heading) {
  const lines=String(markdown||'').split(/\r?\n/gu);
  const target=`## ${heading}`;
  const start=lines.findIndex(line=>line.trim()===target);
  if (start<0) return '';
  const out=[];
  for (let index=start+1; index<lines.length; index++) {
    if (/^##\s+/u.test(lines[index].trim())) break;
    out.push(lines[index]);
  }
  return out.join('\n').trim();
}
function hasRepeatedLongBlock(markdown) {
  const blocks=String(markdown||'')
    .split(/\n\s*\n/gu)
    .map(block=>block.trim())
    .filter(block=>block && !/^#{1,6}\s+/u.test(block) && !/^(?:[-*+]\s+|\d+[.)]\s+)/u.test(block))
    .map(block=>normalizeLine(block))
    .filter(block=>wordCount(block)>=18);
  const seen=new Set();
  for (const block of blocks) {
    const key=comparable(block);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function topicDirection(event={}) {
  const text=comparable([event.title,event.summary,...values(event.key_facts)].join(' '));
  if (/\bprr\b|habitacao publica|casas entreg|casas concluid|oferta de habitacao|construcao de habitacao/u.test(text)) {
    return 'Ilustração editorial arquitetónica premium, claramente não fotorealista: conjunto de habitação pública portuguesa em fase final de construção, com volumes simplificados de vários edifícios residenciais novos, silhueta elegante de uma grua junto a um bloco em obra e um molho de chaves tratado como elemento simbólico em primeiro plano; textura editorial suave, composição sóbria e factual.';
  }
  if (/euribor|credito a habitacao|credito habitacao|prestacao da casa|hipoteca/u.test(text)) {
    return 'Ilustração editorial arquitetónica premium, claramente não fotorealista: entrada de uma habitação portuguesa, chave de casa e pequena maquete residencial em primeiro plano, acompanhadas por um elemento geométrico discreto que sugira custos de financiamento sem gráficos, texto ou números; composição sóbria e financeira.';
  }
  if (/despejo|senhorio|arrendamento|inquilino|renda|caucao/u.test(text)) {
    return 'Ilustração editorial arquitetónica premium, claramente não fotorealista, da entrada de um prédio residencial português, com porta de apartamento, chave de casa em primeiro plano e corredor comum simplificado, numa composição claramente associada ao arrendamento.';
  }
  if (/condominio|condomino|fundo comum|administrador/u.test(text)) return SAFE_DIRECTIONS.condominio;
  if (/\bimi\b|\bimt\b|irs|imposto|fisco|mais valias/u.test(text)) return SAFE_DIRECTIONS.impostos;
  if (/obras|reabilitacao|eficiencia energetica|isolamento|painel solar|energia/u.test(text)) {
    return 'Ilustração editorial arquitetónica premium, claramente não fotorealista, de uma habitação portuguesa em melhoria ou reabilitação, com formas simplificadas, materiais de construção discretos e detalhe de obra limpa, sem trabalhadores em poses publicitárias nem sinalética.';
  }
  if (/preco das casas|mercado imobiliario|valor dos imoveis|vendas de casas/u.test(text)) {
    return 'Ilustração editorial arquitetónica premium, claramente não fotorealista, de uma rua residencial portuguesa com edifícios de habitação simplificados, chave de casa em primeiro plano e profundidade gráfica controlada, sugerindo mercado imobiliário sem placas, texto ou publicidade.';
  }
  return '';
}

export class PublicationQualityError extends Error {
  constructor(reasons=[]) {
    super(`Publication quality rejected: ${reasons.join('; ')}`);
    this.name='PublicationQualityError';
    this.reasons=[...reasons];
  }
}

export function validatePublicationContent(generated,event={}) {
  const reasons=[];
  const textoFb=String(generated?.texto_fb||'').trim();
  const textoSite=String(generated?.texto_site||'').trim();
  const visual=String(generated?.orientacao_ilustracao_segura||'').trim();

  const fbWords=wordCount(textoFb);
  if (!textoFb) reasons.push('texto_fb_empty');
  else {
    if (fbWords<55) reasons.push(`texto_fb_too_short:${fbWords}`);
    if (fbWords>140) reasons.push(`texto_fb_too_long:${fbWords}`);
    if (!textoFb.endsWith('Explicamos o essencial no link.')) reasons.push('texto_fb_bad_ending');
  }

  if (!textoSite) reasons.push('texto_site_empty');
  if (!visual) reasons.push('illustration_direction_empty');

  if (textoSite) {
    const words=wordCount(textoSite);
    if (words<300) reasons.push(`texto_site_too_short:${words}`);
    if (words>700) reasons.push(`texto_site_too_long:${words}`);
    if (!/^##\s+O essencial\s*$/imu.test(textoSite)) reasons.push('missing_o_essencial');
    if (!/^##\s+Também pode interessar\s*$/imu.test(textoSite)) reasons.push('missing_tambem_pode_interessar');
    if (/^#\s+/mu.test(textoSite)) reasons.push('h1_not_allowed');
    if (/<[a-z][^>]*>/iu.test(textoSite)) reasons.push('html_not_allowed');

    const headings=textoSite.match(/^##\s+.+$/gmu)||[];
    if (headings.length<4) reasons.push(`insufficient_sections:${headings.length}`);

    const essential=section(textoSite,'O essencial');
    if (essential) {
      const bullets=essential.split(/\r?\n/gu).filter(line=>/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u.test(line)).length;
      if (bullets<4) reasons.push(`o_essencial_bullets:${bullets}`);
    } else if (/^##\s+O essencial\s*$/imu.test(textoSite)) {
      reasons.push('o_essencial_empty');
    }

    const related=section(textoSite,'Também pode interessar');
    if (related) {
      const links=related.match(INTERNAL_LINK_RE)||[];
      if (links.length!==3) reasons.push(`internal_links:${links.length}`);
    } else if (/^##\s+Também pode interessar\s*$/imu.test(textoSite)) {
      reasons.push('tambem_pode_interessar_empty');
    }

    if (hasRepeatedLongBlock(textoSite)) reasons.push('repeated_long_block');
  }

  return {ok:reasons.length===0,reasons,word_count:wordCount(textoSite),facebook_word_count:fbWords,legal_stage:event?.legal_stage||'na'};
}

export function safeIllustrationDirection(value,event={}) {
  const rawDirection=normalizeLine(value);
  if (!rawDirection) throw new Error('Safe illustration direction is required');

  const deterministic=topicDirection(event);
  if (deterministic) return deterministic;

  const direction=rawDirection
    .replace(/\bfotografia editorial realista\b/giu,'ilustração editorial arquitetónica premium, claramente não fotorealista')
    .replace(/\bfotografia\b/giu,'ilustração editorial')
    .replace(/\bfotorealista\b/giu,'não fotorealista');
  const fallback=SAFE_DIRECTIONS[event.pillar] || SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
  const forbidden=[
    event.title,event.source_name,event.summary,event.article_url,event.url_original,
    ...values(event.entities),...values(event.key_facts),...values(event.forbiddenText)
  ].map(comparable).filter(item=>item.length>=4);

  const unsafe=direction.length>360
    || /\p{N}/u.test(direction)
    || SENSITIVE_TERMS.test(direction)
    || NEWS_DETAIL_TERMS.test(direction)
    || forbidden.some(item=>normalized.includes(item));

  return unsafe ? fallback : direction;
}

export function buildPublicationImagePrompt({illustrationDirection}) {
  const direction=normalizeLine(illustrationDirection);
  if (!direction) throw new Error('Safe illustration direction is required');

  return `Premium editorial architectural illustration for a Portuguese homeowner publication.

Create only the illustrated visual layer for a professionally designed news card. Do not create the card, layout, badge, typography, cream panel, curved graphics or branding.

VISUAL STYLE
- clearly non-photorealistic editorial illustration, sophisticated and adult
- simplified architectural forms with controlled perspective and gentle depth
- subtle paper, gouache and fine-grain texture; tactile but clean
- creamy neutrals, deep petrol green, muted terracotta, restrained gold and natural tones
- refined newspaper and magazine illustration aesthetic
- premium, elegant and restrained, never childish or decorative for its own sake

EDITORIAL RELEVANCE
- communicate the concrete subject of the news through two or three recognisable visual anchors
- do not use a generic apartment, façade or interior merely because the story concerns property
- prefer contextual objects, architecture and symbolic elements that make the topic understandable without written text
- keep the interpretation neutral and factual, not dramatic or sensational

COMPOSITION
- horizontal 1536x1024, composed for a predictable cover crop
- place the main subject predominantly in the centre-right or right side of the frame
- keep the left and centre-left visually calm because deterministic editorial graphics will cover that area
- use layered shapes and restrained depth rather than camera-style depth of field
- keep important architecture, people and objects away from the outer crop edges
- let the illustration bleed naturally to the top, right and bottom edges

SUBJECT DIRECTION
${direction}

PORTUGUESE VISUAL LANGUAGE WHERE RELEVANT
- recognisably Portuguese residential architecture, ceramic roof tiles, iron balconies and light stucco
- stone, subtle traditional tile motifs, Mediterranean vegetation and contemporary Portuguese interiors
- European doors and windows, natural wood and plausible Portuguese streets or buildings
- simplify these references into an editorial illustration rather than reproducing a real photograph

AVOID
- photorealism, hyperrealism, stock photography and any image that could be mistaken for a real camera photograph
- camera lens effects, bokeh, photographic depth of field, HDR lighting or cinematic photo colour grading
- glossy real-estate advertising, CGI, 3D renders or game-like rendering
- generic luxury interiors unrelated to the concrete news event
- American suburban architecture, mansions, skyscrapers without context or futuristic buildings
- childish cartoon, clip-art, icon sheet or generic corporate flat-vector style
- any curved template graphics, badge, cream title panel or predesigned news-card composition

ABSOLUTELY NO
- visible text, letters, numbers, titles, labels or captions
- logos, watermarks, icons, brand marks or readable signage
- readable documents, newspapers, contracts, screens, plaques or envelopes
- copied or imitated imagery from the original news source

Return one non-photorealistic editorial illustration layer only, ready for deterministic editorial composition by the renderer.`;
}

export function finalizePublication({publishableNews,event,generated}) {
  if (!publishableNews) return {texto_fb:'',texto_site:'',prompt_imagem:'',prompt_tecnico:''};

  const quality=validatePublicationContent(generated,event);
  if (!quality.ok) throw new PublicationQualityError(quality.reasons);

  const illustrationDirection=safeIllustrationDirection(generated.orientacao_ilustracao_segura,{
    ...event,
    forbiddenText:[generated.texto_fb,generated.texto_site,...values(generated.resumo_factual_curto)]
  });

  return {
    texto_fb:generated.texto_fb,
    texto_site:generated.texto_site,
    prompt_imagem:buildPublicationImagePrompt({illustrationDirection}),
    prompt_tecnico:IMAGE_TECHNICAL_PROMPT
  };
}
