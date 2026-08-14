export const IMAGE_TECHNICAL_PROMPT = 'gpt-image-2 high — base editorial sem texto + composição tipográfica determinística';

const SAFE_DIRECTIONS={
  vender:'Arquitetura residencial portuguesa elegante e elementos económicos abstratos e discretos.',
  impostos:'Casa portuguesa elegante com documentos patrimoniais sem texto legível e elementos financeiros abstratos.',
  arrendar:'Interior residencial português elegante com chave e elementos genéricos associados a habitação.',
  condominio:'Prédio residencial português elegante, varandas em ferro, azulejos discretos e vegetação mediterrânica.',
  casa:'Habitação portuguesa elegante com telha cerâmica, detalhes arquitetónicos tradicionais e vegetação discreta.'
};

const SENSITIVE_TERMS=/\b(crime|criminal|polícia|policial|detido|detenção|morte|morto|vítima|agressão|arma|droga|incêndio|explosão)\b/iu;
const NEWS_DETAIL_TERMS=/(?:https?:\/\/|www\.|\b[\w-]+\.(?:pt|com|org|net)\b|[€$£]|\b(?:euros?|milh(?:ão|ões)|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|hoje|ontem)\b)/iu;

function normalizeLine(value) {
  return String(value||'').replace(/\s+/gu,' ').trim();
}

function comparable(value) {
  return normalizeLine(value).normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLowerCase();
}

function values(value) {
  return Array.isArray(value) ? value : [value];
}

export function safeIllustrationDirection(value,event={}) {
  const direction=normalizeLine(value);
  if (!direction) throw new Error('Safe illustration direction is required');
  const fallback=SAFE_DIRECTIONS[event.pillar]||SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
  const forbidden=[
    event.title,event.source_name,event.summary,event.article_url,event.url_original,
    ...values(event.entities),...values(event.key_facts),...values(event.forbiddenText)
  ]
    .map(comparable)
    .filter(item=>item.length>=4);
  const unsafe=direction.length>320
    || /\p{N}/u.test(direction)
    || SENSITIVE_TERMS.test(direction)
    || NEWS_DETAIL_TERMS.test(direction)
    || forbidden.some(item=>normalized.includes(item));
  return unsafe ? fallback : direction;
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
  if (!generated?.texto_fb||!generated?.texto_site) throw new Error('Publication generation returned incomplete content');
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
