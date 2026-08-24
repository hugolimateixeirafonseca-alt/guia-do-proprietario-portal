import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import sharp from 'sharp';
import {createSocialPostLayout,SOCIAL_POST_CARD,selectSocialPostTitleLayout} from '../src/lib/social-post-layout.mjs';
import {renderSocialCardNode} from '../automation/social-card-renderer/render-node.mjs';

const root=path.resolve(import.meta.dirname,'..');

function solidImagePng(fill='#1267A5'){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="1536" height="1024" fill="${fill}"/></svg>`;
  return new Resvg(svg).render().asPng();
}

test('social premium reserva imagem ampla e usa separador curvo em camadas',()=>{
  const layout=createSocialPostLayout({title:'Equipar um quarto de estudante: por onde começar',badge:'GUIA',pillar:'casa',image:solidImagePng()});
  assert.equal(layout.metrics.design,'premium-editorial-v3');
  assert.equal(layout.metrics.image.left,560);
  assert.equal(layout.metrics.image.width,976);
  assert.ok(layout.metrics.image.width/SOCIAL_POST_CARD.width>0.59);
  assert.ok(layout.metrics.title.left+layout.metrics.title.width<=layout.metrics.textSafeRight);
  assert.equal(layout.metrics.curve.layered,true);
  assert.equal(layout.metrics.curve.gold,true);
  assert.equal(layout.metrics.curve.petrol,true);
  assert.equal(layout.metrics.label.border,true);
  assert.equal(layout.metrics.footer.houseIcon,true);
});

test('PNG social premium mantém fotografia visível e camadas editoriais no SVG final',async()=>{
  const rendered=await renderSocialCardNode({
    root,
    title:'Equipar um quarto de estudante: por onde começar',
    variant:'social',
    badge:'GUIA',
    pillar:'casa',
    image:solidImagePng('#1267A5')
  });
  assert.equal(rendered.metrics.design,'premium-editorial-v3');
  const right=await sharp(rendered.png).extract({left:1110,top:260,width:260,height:300}).stats();
  const [rr,,rb]=right.channels.slice(0,3).map(channel=>channel.mean);
  assert.ok(rb>120,'a zona da fotografia deve conservar o azul da imagem-base');
  assert.ok(rb>rr+25,'a fotografia não pode ser substituída pelo painel editorial');
  assert.match(rendered.svg,/#F6F0E6/i,'o SVG final deve conter o painel creme premium');
  assert.match(rendered.svg,/#B78943/i,'o SVG final deve conter os detalhes dourados');
  assert.match(rendered.svg,/#153C38/i,'o SVG final deve conter o verde-petróleo');
});

test('social premium inclui motivos editoriais por pilar sem mudar a composição',()=>{
  const impostos=createSocialPostLayout({title:'O seu IMI subiu ou desceu este ano?',badge:'PERGUNTA',pillar:'impostos',image:solidImagePng()});
  const condominio=createSocialPostLayout({title:'As contas do condomínio estão claras?',badge:'PERGUNTA',pillar:'condominio',image:solidImagePng()});
  assert.equal(impostos.metrics.watermark.pillar,'impostos');
  assert.equal(condominio.metrics.watermark.pillar,'condominio');
  assert.deepEqual(impostos.metrics.image,condominio.metrics.image);
  assert.equal(impostos.metrics.label.goldText,true);
});

test('título social nunca é truncado nem reduzido abaixo do mínimo legível',()=>{
  const title='Caução no fim do contrato: o que pode ser descontado?';
  const selected=selectSocialPostTitleLayout(title);
  assert.equal(selected.lines.join(' '),title);
  assert.ok(selected.fontSize>=62);
  assert.ok(selected.lines.length<=5);
  assert.throws(()=>selectSocialPostTitleLayout('Este título social é deliberadamente demasiado comprido para caber no cartão sem encolher a tipografia até ficar ilegível e por isso deve falhar de forma explícita'),/too long/u);
});
