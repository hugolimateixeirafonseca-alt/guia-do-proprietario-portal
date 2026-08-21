import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderSocialCardNode} from '../automation/social-card-renderer/render-node.mjs';

const root=path.resolve(import.meta.dirname,'..');
const webp=await fs.readFile(path.join(root,'public/imagens/artigos/equipar-quarto-estudante.webp'));
const image=await sharp(webp).jpeg({quality:90,mozjpeg:true}).toBuffer();
const rendered=await renderSocialCardNode({
  root,
  title:'Equipar um quarto de estudante: por onde começar',
  variant:'social',
  badge:'GUIA',
  image
});
await fs.mkdir(path.join(root,'tmp-preview'),{recursive:true});
await fs.writeFile(path.join(root,'tmp-preview/social-preview.png'),rendered.png);
console.log(JSON.stringify(rendered.metrics,null,2));
