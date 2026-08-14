import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import {Resvg} from '@resvg/resvg-js';
import {createSocialCardLayout,SOCIAL_CARD} from '../../src/lib/social-card-layout.mjs';

async function readFont(root,name) {
  const value=await fs.readFile(path.join(root,'functions/assets/fonts',name));
  return value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);
}

export async function renderSocialCardNode({root=process.cwd(),title,source,pillar='casa',image}) {
  const [serif,sansRegular,sansBold]=await Promise.all([
    readFont(root,'old-standard-bold.bin'),
    readFont(root,'lato-regular.bin'),
    readFont(root,'lato-bold.bin')
  ]);
  const imageData=ArrayBuffer.isView(image)
    ? image.buffer.slice(image.byteOffset,image.byteOffset+image.byteLength)
    : image;
  const {tree,metrics}=createSocialCardLayout({title,source,pillar,image:imageData});
  const svg=await satori(tree,{
    width:SOCIAL_CARD.width,
    height:SOCIAL_CARD.height,
    fonts:[
      {name:'Old Standard TT',data:serif,weight:700,style:'normal'},
      {name:'Lato',data:sansRegular,weight:400,style:'normal'},
      {name:'Lato',data:sansBold,weight:700,style:'normal'}
    ]
  });
  const renderer=new Resvg(svg,{fitTo:{mode:'original'},background:'#F4EFE5',imageRendering:0,textRendering:2});
  const rendered=renderer.render();
  return {png:rendered.asPng(),svg,metrics};
}
