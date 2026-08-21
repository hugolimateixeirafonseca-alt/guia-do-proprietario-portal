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

test('social reserva quase metade do cartão para fotografia sem overlay creme',()=>{
  const layout=createSocialPostLayout({title:'Equipar um quarto de estudante: por onde começar',badge:'GUIA',image:solidImagePng()});
  assert.equal(layout.metrics.image.left,800);
  assert.equal(layout.metrics.image.width,736);
  assert.ok(layout.metrics.image.width/SOCIAL_POST_CARD.width>0.47);
  assert.ok(layout.metrics.title.left+layout.metrics.title.width<=layout.metrics.image.left-80);
  assert.equal(layout.metrics.panelWidth,layout.metrics.image.left);
});

test('PNG social mantém a fotografia visível na metade direita',async()=>{
  const rendered=await renderSocialCardNode({
    root,
    title:'Equipar um quarto de estudante: por onde começar',
    variant:'social',
    badge:'GUIA',
    image:solidImagePng('#1267A5')
  });
  const stats=await sharp(rendered.png).extract({left:1000,top:250,width:300,height:300}).stats();
  const [r,g,b]=stats.channels.slice(0,3).map(channel=>channel.mean);
  assert.ok(b>120,'a zona da fotografia deve conservar o azul da imagem-base');
  assert.ok(b>r+25,'a zona da fotografia não pode ser substituída pelo painel creme');
  assert.equal(rendered.metrics.image.left,800);
  assert.equal(rendered.metrics.image.width,736);
});

test('título social nunca é truncado nem reduzido abaixo do mínimo legível',()=>{
  const title='Caução no fim do contrato: o que pode ser descontado?';
  const selected=selectSocialPostTitleLayout(title);
  assert.equal(selected.lines.join(' '),title);
  assert.ok(selected.fontSize>=58);
  assert.ok(selected.lines.length<=5);
  assert.throws(()=>selectSocialPostTitleLayout('Este título social é deliberadamente demasiado comprido para caber no cartão sem encolher a tipografia até ficar ilegível e por isso deve falhar de forma explícita'),/too long/u);
});
