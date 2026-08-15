const ARTICLE_TYPES = new Set(['NewsArticle','Article','ReportageNewsArticle','BlogPosting']);

function decodeHtml(value='') {
  return String(value)
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)));
}

function attributes(tag) {
  const out={};
  for (const match of String(tag).matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[match[1].toLowerCase()]=decodeHtml(match[2]??match[3]??match[4]??'').trim();
  }
  return out;
}

function isoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const time=Date.parse(value.trim());
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function jsonLdNodes(value,seen=new Set()) {
  if (Array.isArray(value)) return value.flatMap(item=>jsonLdNodes(item,seen));
  if (!value || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return [value,...Object.values(value).flatMap(item=>jsonLdNodes(item,seen))];
}

function parseJsonLd(html) {
  const nodes=[];
  for (const match of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const text=match[1].trim();
    if (!text) continue;
    try { nodes.push(...jsonLdNodes(JSON.parse(text))); }
    catch {
      try { nodes.push(...jsonLdNodes(JSON.parse(decodeHtml(text)))); } catch {}
    }
  }
  return nodes;
}

function firstJsonLd(nodes,key) {
  for (const node of nodes) {
    const value=node?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function metaValue(html,matcher) {
  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs=attributes(match[0]);
    if (matcher(attrs) && attrs.content) return attrs.content;
  }
  return '';
}

function cleanFragment(fragment='') {
  return decodeHtml(
    String(fragment)
      .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi,' ')
      .replace(/<(?:br|\/p|\/li|\/h[1-6])\b[^>]*>/gi,'\n')
      .replace(/<[^>]+>/g,' ')
  )
    .replace(/[ \t]+/g,' ')
    .replace(/\n\s*\n+/g,'\n')
    .trim();
}

function articleExcerpt(html,nodes) {
  const jsonBody=cleanFragment(firstJsonLd(nodes,'articleBody'));
  if (jsonBody.length>=250) return jsonBody.slice(0,9000);

  const article=String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main=String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const scope=article||main||html;
  const paragraphs=[];
  for (const match of String(scope).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text=cleanFragment(match[1]);
    if (text.length<45) continue;
    if (/^(?:aceitar cookies|política de cookies|subscreva|newsletter|publicidade|continuar a ler)/i.test(text)) continue;
    paragraphs.push(text);
    if (paragraphs.join('\n').length>=9000) break;
  }
  return paragraphs.join('\n').slice(0,9000);
}

export function extractSourceMetadata(html) {
  const nodes=parseJsonLd(html);
  const dateCandidates=[
    ['jsonld_datePublished',firstJsonLd(nodes,'datePublished')],
    ['jsonld_dateCreated',firstJsonLd(nodes,'dateCreated')],
    ['article_published_time',metaValue(html,a=>a.property?.toLowerCase()==='article:published_time')],
    ['article_published_time',metaValue(html,a=>a.name?.toLowerCase()==='article:published_time')],
    ['meta_date',metaValue(html,a=>a.name?.toLowerCase()==='date')],
    ['meta_pubdate',metaValue(html,a=>a.name?.toLowerCase()==='pubdate')],
    ['meta_publish_date',metaValue(html,a=>a.name?.toLowerCase()==='publish-date')],
    ['itemprop_datePublished',metaValue(html,a=>a.itemprop?.toLowerCase()==='datepublished')]
  ];
  for (const match of String(html).matchAll(/<time\b[^>]*>/gi)) {
    const value=attributes(match[0]).datetime;
    if (value) dateCandidates.push(['time_datetime',value]);
  }

  let published_at='',date_source='';
  for (const [source,value] of dateCandidates) {
    const normalized=isoDate(value);
    if (!normalized) continue;
    published_at=normalized;
    date_source=source;
    break;
  }

  const jsonLdTitle=firstJsonLd(nodes,'headline');
  const ogTitle=metaValue(html,a=>a.property?.toLowerCase()==='og:title');
  const titleTag=String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  const types=nodes.flatMap(node=>Array.isArray(node?.['@type'])?node['@type']:[node?.['@type']]).filter(type=>typeof type==='string');
  const articleType=types.find(type=>ARTICLE_TYPES.has(type)) || types[0] || '';
  const description=cleanFragment(
    firstJsonLd(nodes,'description') ||
    metaValue(html,a=>a.property?.toLowerCase()==='og:description') ||
    metaValue(html,a=>a.name?.toLowerCase()==='description')
  ).slice(0,1400);

  return {
    published_at,
    date_source,
    title:decodeHtml(jsonLdTitle||ogTitle||titleTag).replace(/\s+/g,' ').trim(),
    description,
    article_excerpt:articleExcerpt(html,nodes),
    article_type:articleType,
    probable_article:ARTICLE_TYPES.has(articleType)
  };
}

export async function inspectSourceUrl(source,{fetchImpl=fetch,timeoutMs=10000}={}) {
  const result={
    url:source.url,
    http_status:0,
    published_at:'',
    date_source:'',
    date_status:'unknown',
    title:'',
    description:'',
    article_excerpt:'',
    article_type:'',
    probable_article:false,
    fetch_ok:false
  };
  try {
    const response=await fetchImpl(source.url,{
      redirect:'follow',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{
        'User-Agent':'Mozilla/5.0 (compatible; GuiaDoProprietario-EditorialRadar/22.0; +https://guiadoproprietario.pt/)',
        'Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'pt-PT,pt;q=0.9,en;q=0.7'
      }
    });
    result.http_status=response.status;
    if (!response.ok) return result;
    const contentType=response.headers.get('content-type')||'';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return result;
    const html=await response.text();
    const metadata=extractSourceMetadata(html);
    return {...result,...metadata,date_status:metadata.published_at?'verified':'unknown',fetch_ok:true};
  } catch {
    return result;
  }
}
