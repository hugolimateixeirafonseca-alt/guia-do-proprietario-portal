import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAssessContentImpact} from './impact-gate.mjs';
import {shouldUpgradeLegacyPublication} from './legacy-upgrade.mjs';
import {scoreHarvestRelevance} from './source-harvest.mjs';

test('impacto editorial só chama IA quando algum score justifica',()=>{
  assert.equal(shouldAssessContentImpact({news_score:35,seo_score:37,lead_score:20}),false);
  assert.equal(shouldAssessContentImpact({news_score:70,seo_score:40,lead_score:20}),true);
  assert.equal(shouldAssessContentImpact({news_score:40,seo_score:80,lead_score:20}),true);
  assert.equal(shouldAssessContentImpact({news_score:40,seo_score:40,lead_score:80}),true);
});

test('evento legacy só sobe para notícia ao cruzar o limiar e se não estiver publicado',()=>{
  assert.equal(shouldUpgradeLegacyPublication({news_score:8,published:0},{news_score:70},70),true);
  assert.equal(shouldUpgradeLegacyPublication({news_score:70,published:0},{news_score:70},70),false);
  assert.equal(shouldUpgradeLegacyPublication({news_score:8,published:1},{news_score:90},70),false);
  assert.equal(shouldUpgradeLegacyPublication({news_score:8,published:0},{news_score:35},70),false);
});

function source(title,url,direct_source='CNN Portugal') {
  return {verified_title:title,title,url,direct_source,source_domain:new URL(url).hostname,article_type:'NewsArticle'};
}

test('prefiltro rejeita ocorrências incidentais de casa e notícias mundiais',()=>{
  const cases=[
    source('Chuvas históricas no Japão deixam 26 mil casas sem energia','https://www.rtp.pt/noticias/mundo/chuvas-historicas-no-japao-deixam-26-mil-casas-sem-energia_n1','RTP Economia'),
    source('Ex-professor de Cambridge encontrado morto em casa','https://cnnportugal.iol.pt/jason-arday/mortos/ex-professor-de-cambridge-encontrado-morto-em-casa/20260814/x'),
    source('Almaraz vive!','https://cnnportugal.iol.pt/central-nuclear/energia-nuclear/almaraz-vive/20260814/x'),
    source('Ensinamentos do eclipse sobre o futuro da energia solar','https://eco.sapo.pt/opiniao/o-que-um-eclipse-nos-ensina-sobre-o-futuro-da-energia-solar-em-portugal','ECO'),
    source('Conheça as dez casas de luxo mais espreitadas este verão','https://eco.sapo.pt/2026/08/14/dez-casas-de-luxo','ECO')
  ];
  for (const item of cases) assert.equal(scoreHarvestRelevance(item).relevant,false,item.title);
});

test('prefiltro preserva PRR habitacional e Euribor',()=>{
  const prr=source('Habitação pública alavancada com 28 mil casas pagas pelo PRR','https://eco.sapo.pt/2026/08/15/cerca-de-28-000-casas-de-habitacao-publica-entregues-ate-ao-fim-de-agosto-no-ambito-do-prr','ECO');
  const euribor=source('Euribor desce a três e 12 meses, mas taxa mais usada volta a subir','https://cnnportugal.iol.pt/credito-a-habitacao/prestacao-da-casa/euribor-desce/20260814/x');
  assert.equal(scoreHarvestRelevance(prr).relevant,true);
  assert.equal(scoreHarvestRelevance(euribor).relevant,true);
});
