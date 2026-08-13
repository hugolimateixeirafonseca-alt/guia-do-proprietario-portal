import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPageLinks,
  extractRobotsSitemaps,
  extractSitemap,
  rankHarvestCandidates
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
