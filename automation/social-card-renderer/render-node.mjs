import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import {Resvg} from '@resvg/resvg-js';
import {createSocialCardLayout,SOCIAL_CARD} from '../../src/lib/social-card-layout.mjs';
import {createSocialPostLayout} from '../../src/lib/social-post-layout.mjs';

async function readFont(root,name){
  const value=await fs.readFile(path.join(root,'functions/assets/fonts',name));
  return value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);
}

export async function renderSocialCardNode({root=process.cwd(),title,source,pillar='casa',image,variant='news',badge}){
  const [serif,sansRegular,sansBold]=await Promise.all([
    readFont(root,'cormorant-garamond-medium.bin'),
    readFont(root,'lato-regular.bin'),
    readFont(root,'lato-bold.bin')
  ]);
  const imageData=ArrayBuffer.isView(image)?image.buffer.slice(image.byteOffset,image.byteOffset+image.byteLength):image;
  const layout=variant==='social'
    ? createSocialPostLayout({title,badge,pillar,image:imageData})
    : createSocialCardLayout({title,source,pillar,image:imageData,variant:'news'});
  const svg=await satori(layout.tree,{
    width:SOCIAL_CARD.width,
    height:SOCIAL_CARD.height,
    fonts:[
      {name:'Cormorant Garamond',data:serif,weight:500,style:'normal'},
      {name:'Lato',data:sansRegular,weight:400,style:'normal'},
      {name:'Lato',data:sansBold,weight:700,style:'normal'}
    ]
  });
  const renderer=new Resvg(svg,{fitTo:{mode:'original'},background:'#F6F0E6',imageRendering:0,textRendering:2});
  const rendered=renderer.render();
  return {png:rendered.asPng(),svg,metrics:layout.metrics};
}
