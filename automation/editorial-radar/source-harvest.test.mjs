import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPageLinks,
  extractRobotsSitemaps,
  extractSitemap,
  rankHarvestCandidates,
  scoreHarvestRelevance,
  prefilterHarvestSources
} from './source-harvest.mjs';

const seed={name:'Publisher',slug:'publisher',url:'https://news.example.pt/economia',section:true};

test('extractPageLinks resolves editorial links and removes utility URLs',()=>{
  const links=extractPageLinks(`
    <a href="/economia/casas-subiram">Preços das casas subiram</a>
    <a href="https://news.example.pt/login">Entrar</a>
    <a href="https://external.example.com/noticia">Externa</a>
    <a href="mailto:redacao@example.pt">Email</a>
    <a href="/economia/casas-subiram?utm_source=home#top">Duplicado</a>
  `,seed);
  assert.deepEqual(links,[{
    url:'https://news.example.pt/economia/casas-subiram',
    title:'Preços das casas subiram',
    origin:'seed'
  }]);
});

test('robots and news sitemap extraction preserve publication evidence',()=>{
  assert.deepEqual(extractRobotsSitemaps(`
    User-agent: *
    Sitemap: https://news.example.pt/sitemap.xml
    Sitemap: /news-sitemap.xml
  `,'https://news.example.pt/robots.txt'),[
    'https://news.example.pt/sitemap.xml',
    'https://news.example.pt/news-sitemap.xml'
  ]);
  const parsed=extractSitemap(`
    <urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url><loc>https://news.example.pt/artigo</loc><lastmod>2026-08-13</lastmod><news:news><news:publication_date>2026-08-13T09:00:00+01:00</news:publication_date><news:title>Nova regra para condomínios</news:title></news:news></url>
    </urlset>
  `);
  assert.equal(parsed.entries[0].publication_date,'2026-08-13T09:00:00+01:00');
  assert.equal(parsed.entries[0].title,'Nova regra para condomínios');
});

test('ranking prioritizes fresh news sitemap URLs and ignores lastmod as publication proof',()=>{
  const currentTime=new Date('2026-08-13T12:00:00Z');
  const ranked=rankHarvestCandidates(seed,[
    {url:'https://news.example.pt/economia/geral',title:'Outro artigo',origin:'seed'},
    {url:'https://news.example.pt/economia/casas',title:'Casas e crédito',origin:'seed'}
  ],[
    {url:'https://news.example.pt/economia/condominios',title:'Condomínios',publication_date:'2026-08-13T08:00:00Z'},
    {url:'https://news.example.pt/economia/antigo',title:'Antigo',publication_date:'2026-08-01T08:00:00Z'},
    {url:'https://news.example.pt/economia/so-lastmod',title:'Só lastmod',publication_date:'',lastmod:'2026-08-13'}
  ],currentTime,30);
  assert.equal(ranked[0].url,'https://news.example.pt/economia/condominios');
  assert.ok(ranked.some(item=>item.url.endsWith('/casas')));
  assert.ok(!ranked.some(item=>item.url.endsWith('/antigo')));
  assert.ok(!ranked.some(item=>item.url.endsWith('/so-lastmod')));

  const homepageRanked=rankHarvestCandidates({...seed,url:'https://news.example.pt/',section:false},[],[
    {url:'https://news.example.pt/estrangeiro/guerra',title:'Notícia internacional',publication_date:'2026-08-13T08:00:00Z'},
    {url:'https://news.example.pt/economia/habitacao',title:'Crédito habitação',publication_date:'2026-08-13T08:00:00Z'}
  ],currentTime,30);
  assert.deepEqual(homepageRanked.map(item=>item.url),['https://news.example.pt/economia/habitacao']);
});

test('relevance scoring preserves the required housing benchmarks',()=>{
  const titles=[
    'Nova lei dos condomínios entra em vigor',
    'Euribor sobe a três meses',
    'Oferta de moradias recua e preços sobem',
    'Despejos para obras profundas têm novas regras'
  ];
  for (const [index,title] of titles.entries()) {
    const result=scoreHarvestRelevance({
      url:`https://publisher.pt/artigo/${index}`,
      verified_title:title,
      article_type:'NewsArticle',
      direct_source:'CNN Portugal'
    });
    assert.equal(result.relevant,true,title);
    assert.ok(result.score>=50,title);
  }
});

test('prefilter deixa passar casa prática e estudantes antes do Validator',()=>{
  const practical=scoreHarvestRelevance({
    url:'https://publisher.pt/casa/ondas-de-calor',
    verified_title:'Ondas de calor: quanto custa manter a casa fresca?',
    article_type:'NewsArticle',
    direct_source:'Publisher'
  });
  const students=scoreHarvestRelevance({
    url:'https://publisher.pt/casa/plataforma-estudantes',
    verified_title:'Vai estudar longe? Nova plataforma ajuda a encontrar casa',
    source_description:'Ferramenta portuguesa ajuda estudantes universitários a procurar alojamento e quartos.',
    article_type:'NewsArticle',
    direct_source:'Publisher'
  });
  assert.equal(practical.relevant,true);
  assert.equal(students.relevant,true);
  assert.ok(practical.score>=70,practical.score);
  assert.ok(students.score>=70,students.score);
});

test('prefilter mantém Euribor de rotina mas abaixo de casa prática',()=>{
  const euribor=scoreHarvestRelevance({
    url:'https://publisher.pt/economia/euribor-sobe',
    verified_title:'Euribor sobe a três meses e recua a seis meses',
    article_type:'NewsArticle',
    direct_source:'Publisher'
  });
  const practical=scoreHarvestRelevance({
    url:'https://publisher.pt/casa/humidade',
    verified_title:'Humidade em casa: como evitar bolor e infiltrações',
    article_type:'NewsArticle',
    direct_source:'Publisher'
  });
  assert.equal(euribor.relevant,true);
  assert.equal(practical.relevant,true);
  assert.ok(practical.score>euribor.score,{practical:practical.score,euribor:euribor.score});
});

test('falsos positivos semânticos são travados antes do Validator',()=>{
  const cases=[
    ['Homem encontrado morto em casa durante a madrugada','https://publisher.pt/pais/morto-em-casa'],
    ['Quatro obras de arte roubadas de museu','https://publisher.pt/cultura/obras-de-arte'],
    ['Concursos de obras públicas atingem novo máximo','https://publisher.pt/economia/obras-publicas']
  ];
  for (const [title,url] of cases) {
    const result=scoreHarvestRelevance({url,verified_title:title,article_type:'NewsArticle',direct_source:'Publisher'});
    assert.equal(result.relevant,false,title);
  }
});

test('relevance scoring rejects context-only, sports and generic pages before Validator',()=>{
  assert.equal(scoreHarvestRelevance({
    url:'https://publisher.pt/economia/banco-seguros',
    verified_title:'Banco revê seguros',
    article_type:'NewsArticle'
  }).reason,'low_relevance');
  assert.equal(scoreHarvestRelevance({
    url:'https://www.rtp.pt/desporto/futebol-benfica',
    verified_title:'Benfica vence no futebol',
    article_type:'NewsArticle',
    direct_source:'RTP Economia'
  }).reason,'excluded_section');
  assert.equal(scoreHarvestRelevance({
    url:'https://www.idealista.pt/news/imobiliario/habitacao',
    verified_title:'Habitação',
    article_type:'Article',
    direct_source:'Idealista News Portugal'
  }).reason,'non_article');
  assert.equal(scoreHarvestRelevance({
    url:'https://cnnportugal.iol.pt/donald-trump/casa-branca/noticia/20260813/id',
    verified_title:'Trump anuncia mudanças na Casa Branca',
    article_type:'NewsArticle',
    direct_source:'CNN Portugal'
  }).reason,'excluded_section');
});

test('smoke prefilter caps at 24 and takes up to eight per source before filling',()=>{
  const sources=[];
  for (const source of ['Fonte A','Fonte B','Fonte C']) {
    for (let index=0; index<12; index++) sources.push({
      url:`https://${source.toLowerCase().replace(' ','')}.pt/casas/${index}`,
      verified_title:`Casas e habitação ${index}`,
      verified_published_at:new Date(Date.UTC(2026,7,13,12,index)).toISOString(),
      article_type:'NewsArticle',
      direct_source:source
    });
  }
  const {selected}=prefilterHarvestSources(sources,{limit:24});
  assert.equal(selected.length,24);
  const counts=selected.reduce((map,item)=>map.set(item.direct_source,(map.get(item.direct_source)||0)+1),new Map());
  assert.deepEqual([...counts.values()].sort((a,b)=>a-b),[8,8,8]);
});
