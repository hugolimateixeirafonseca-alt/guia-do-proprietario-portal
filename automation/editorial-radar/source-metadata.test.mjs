import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSourceMetadata,inspectSourceUrl} from './source-metadata.mjs';

const fixtures=[
  {url:'https://www.rtp.pt/noticias/economia/imi-cobrado-aos-senhorios-com-rendas-antigas-vai-ser-devolvido_n1752371',date:'2026-07-09'},
  {url:'https://www.rtp.pt/noticias/economia/fisco-tera-150-dias-para-devolver-imposto-e-garantir-iva-de-6-na-construcao_n1702018',date:'2025-12-02'},
  {url:'https://www.rtp.pt/noticias/politica/seguro-promulga-desagravamento-fiscal-na-habitacao_n1740754',date:'2026-05-12'},
  {url:'https://www.rtp.pt/noticias/economia/conselho-de-ministros-aprova-diploma-que-baixa-impostos-na-construcao-de-habitacao_n1701381',date:'2025-11-28'}
];

test('metadata uses publication fields in order and never dateModified',()=>{
  const preferred=extractSourceMetadata(`
    <meta property="article:published_time" content="2026-08-12T10:00:00+01:00">
    <script type="application/ld+json">{"@type":"NewsArticle","headline":"Teste","datePublished":"2026-08-11T09:00:00+01:00","dateModified":"2026-08-13T12:00:00+01:00"}</script>
  `);
  assert.equal(preferred.published_at,'2026-08-11T08:00:00.000Z');
  assert.equal(preferred.date_source,'jsonld_datePublished');
  assert.equal(preferred.article_type,'NewsArticle');
  assert.equal(preferred.probable_article,true);

  const modifiedOnly=extractSourceMetadata('<script type="application/ld+json">{"@type":"NewsArticle","dateModified":"2026-08-13T12:00:00+01:00"}</script>');
  assert.equal(modifiedOnly.published_at,'');
});

test('RTP fixtures preserve their real publication dates',async()=>{
  for (const {url,date} of fixtures) {
    const inspection=await inspectSourceUrl({url});
    assert.equal(inspection.fetch_ok,true,`fetch failed for ${url}`);
    assert.equal(inspection.published_at.slice(0,10),date);
    assert.notEqual(inspection.published_at.slice(0,10),'2026-08-13');
  }
});
