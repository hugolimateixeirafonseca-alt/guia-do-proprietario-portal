export const IMAGE_TECHNICAL_PROMPT = 'gpt-image-2 high — base editorial sem texto + composição tipográfica determinística';

const SAFE_DIRECTIONS={
  vender:'Entrada de uma habitação portuguesa com chave em primeiro plano e contexto visual sóbrio de decisão de venda, sem sinalética nem texto.',
  impostos:'Habitação portuguesa com pasta documental fechada e elementos administrativos discretos, sem texto, números ou documentos legíveis.',
  arrendar:'Entrada de prédio residencial português, porta de apartamento e chave em primeiro plano, numa atmosfera editorial sóbria associada a arrendamento.',
  condominio:'Entrada comum de prédio residencial português, intercomunicador sem texto, caixas de correio neutras e varandas ao fundo.',
  casa:'Habitação portuguesa contemporânea com contexto residencial realista e elementos concretos ligados ao tema da notícia.'
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
    return 'Conjunto residencial português contemporâneo em fase final de construção, com vários edifícios de habitação novos, acabamentos recentes e uma chave de casa em primeiro plano, ambiente realista de entrega de novas habitações.';
  }
  if (/euribor|credito a habitacao|credito habitacao|prestacao da casa|hipoteca/u.test(text)) {
    return 'Entrada de apartamento português com chave em primeiro plano e uma pequena maquete residencial sobre uma mesa, com ambiente financeiro sóbrio sugerido apenas por formas e materiais, sem texto nem números.';
  }
  if (/despejo|senhorio|arrendamento|inquilino|renda|caucao/u.test(text)) {
    return 'Entrada de prédio residencial português, porta de apartamento, chave em primeiro plano e corredor comum discreto, numa composição editorial ligada de forma clara ao arrendamento.';
  }
  if (/condominio|condomino|fundo comum|administrador/u.test(text)) return SAFE_DIRECTIONS.condominio;
  if (/\bimi\b|\bimt\b|irs|imposto|fisco|mais valias/u.test(text)) return SAFE_DIRECTIONS.impostos;
  if (/obras|reabilitacao|eficiencia energetica|isolamento|painel solar|energia/u.test(text)) {
    return 'Habitação portuguesa em contexto realista de melhoria ou reabilitação, com detalhe de obra limpa e materiais de construção discretos, sem trabalhadores em poses publicitárias nem sinalética.';
  }
  if (/preco das casas|mercado imobiliario|valor dos imoveis|vendas de casas/u.test(text)) {
    return 'Rua residencial portuguesa com edifícios de habitação reais, chave de casa em primeiro plano e profundidade urbana natural, sugerindo mercado imobiliário sem placas, texto ou publicidade.';
  }
  return '';
}

function genericDirection(direction='') {
  const d=comparable(direction);
  const words=wordCount(direction);
  if (words<8) return true;
  return /\b(?:casa bonita|interior premium|interior elegante|apartamento bonito|fachada bonita|casa elegante|predio elegante)\b/u.test(d);
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
  const direction=normalizeLine(value);
  if (!direction) throw new Error('Safe illustration direction is required');

  const deterministic=topicDirection(event);
  const fallback=deterministic || SAFE_DIRECTIONS[event.pillar] || SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
  const forbidden=[
    event.title,event.source_name,event.summary,event.article_url,event.url_original,
    ...values(event.entities),...values(event.key_facts),...values(event.forbiddenText)
  ].map(comparable).filter(item=>item.length>=4);

  const unsafe=direction.length>320
    || /\p{N}/u.test(direction)
    || SENSITIVE_TERMS.test(direction)
    || NEWS_DETAIL_TERMS.test(direction)
    || forbidden.some(item=>normalized.includes(item));

  if (unsafe || (deterministic && genericDirection(direction))) return fallback;
  return direction;
}

export function buildPublicationImagePrompt({illustrationDirection}) {
  const direction=normalizeLine(illustrationDirection);
  if (!direction) throw new Error('Safe illustration direction is required');

  return `Editorial architectural photograph for a premium Portuguese homeowner publication.

Create only the photographic visual layer for a professionally designed news card. Do not create the card, layout, badge, typography, cream panel, curved graphics or branding.

VISUAL STYLE
- warm sophisticated Portuguese editorial photography
- natural warm light with soft, deep shadows
- subtle cinematic colour grading
- creamy neutrals, deep petrol green, muted terracotta and natural wood
- refined magazine aesthetic with realistic depth
- premium but restrained, never ostentatious

EDITORIAL RELEVANCE
- the photograph must communicate the concrete subject of the news through two or three recognisable visual anchors
- do not use a generic apartment, façade or interior merely because the story concerns property
- prefer contextual objects and situations that make the topic understandable without any written text
- keep the interpretation neutral and factual, not dramatic or sensational

COMPOSITION
- horizontal 1536x1024, composed for a predictable cover crop
- place the main subject predominantly in the centre-right or right side of the frame
- keep the left and centre-left visually calm because deterministic editorial graphics will cover that area
- use natural depth and, when appropriate, a tasteful foreground element in the lower-right area
- keep the main architecture, faces and important objects away from the outer crop edges
- let the photograph bleed naturally to the top, right and bottom edges

SUBJECT DIRECTION
${direction}

PORTUGUESE VISUAL LANGUAGE WHERE RELEVANT
- authentic residential architecture, ceramic roof tiles, iron balconies and light stucco
- stone, subtle traditional tile details, Mediterranean vegetation and contemporary Portuguese interiors
- European doors and windows, natural wood and plausible Portuguese streets or buildings

AVOID
- generic stock photography or cheap real-estate advertising
- generic luxury interiors unrelated to the concrete news event
- American suburban architecture, mansions, skyscrapers without context or futuristic buildings
- hyper-glossy real-estate photography, CGI or 3D render appearance
- cartoon, flat vector illustration or childish styling
- any curved template graphics, badge, cream title panel or predesigned news-card composition

ABSOLUTELY NO
- visible text, letters, numbers, titles, labels or captions
- logos, watermarks, icons, brand marks or readable signage
- readable documents, newspapers, contracts, screens, plaques or envelopes
- copied or imitated imagery from the original news source

Return one photographic visual layer only, ready for deterministic editorial composition by the renderer.`;
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
