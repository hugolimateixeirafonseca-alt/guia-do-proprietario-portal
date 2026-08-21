import satori,{init as initSatori} from 'satori/standalone';
import yogaWasm from 'satori/yoga.wasm';
import {initWasm,Resvg} from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import serifFont from '../assets/fonts/cormorant-garamond-medium.bin';
import sansRegularFont from '../assets/fonts/lato-regular.bin';
import sansBoldFont from '../assets/fonts/lato-bold.bin';
import {createSocialCardLayout,SOCIAL_CARD} from '../../src/lib/social-card-layout.mjs';
import {createSocialPostLayout} from '../../src/lib/social-post-layout.mjs';
import {isMultipartFormData,isSupportedRasterImage} from '../../src/lib/social-card-upload.mjs';

interface Env { SOCIAL_CARD_RENDERER_SECRET?:string; }
interface RequestContext { request:Request; env:Env; }

const MAX_IMAGE_BYTES=15*1024*1024;
let initialization:Promise<void>|undefined;

function initializeRenderer(){
  initialization??=Promise.all([initSatori(yogaWasm),initWasm(resvgWasm)]).then(()=>undefined);
  return initialization;
}

function jsonError(error:string,status:number){
  return new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}

function requiredText(value:FormDataEntryValue|null,name:string,maxLength:number){
  if(typeof value!=='string') throw new Error(`${name}_required`);
  const clean=value.trim();
  if(!clean) throw new Error(`${name}_required`);
  if(clean.length>maxLength) throw new Error(`${name}_too_long`);
  return clean;
}

function optionalText(value:FormDataEntryValue|null,name:string,maxLength:number,defaultValue=''){
  if(value===null) return defaultValue;
  if(typeof value!=='string') throw new Error(`${name}_invalid`);
  const clean=value.trim();
  if(clean.length>maxLength) throw new Error(`${name}_too_long`);
  return clean||defaultValue;
}

async function renderRequest({request,env}:RequestContext){
  if(!env.SOCIAL_CARD_RENDERER_SECRET) return jsonError('renderer_not_configured',503);
  if(request.headers.get('Authorization')!==`Bearer ${env.SOCIAL_CARD_RENDERER_SECRET}`) return jsonError('unauthorized',401);
  if(!isMultipartFormData(request.headers.get('Content-Type'))) return jsonError('multipart_form_required',415);

  let form:FormData;
  try{ form=await request.formData(); }catch{ return jsonError('invalid_multipart_form',400); }

  try{
    const variant=optionalText(form.get('variant'),'variant',20,'news')==='social'?'social':'news';
    const title=requiredText(form.get('title'),'title',variant==='social'?88:600);
    const source=variant==='news'?requiredText(form.get('source'),'source',180):optionalText(form.get('source'),'source',180,'');
    const badge=variant==='social'?optionalText(form.get('badge'),'badge',40,'GUIA'):'NOTÍCIAS';
    const pillar=typeof form.get('pilar')==='string'?String(form.get('pilar')).trim().slice(0,40):'casa';
    const image=form.get('image');
    if(!(image instanceof File)||!image.size) return jsonError('image_required',400);
    if(image.size>MAX_IMAGE_BYTES) return jsonError('image_too_large',413);
    const allowedTypes=variant==='social'?['image/png','image/jpeg']:['image/png','image/jpeg','image/webp'];
    if(!allowedTypes.includes(image.type)) return jsonError(variant==='social'?'unsupported_social_image_type':'unsupported_image_type',415);

    const imageBytes=await image.arrayBuffer();
    if(!isSupportedRasterImage(imageBytes,image.type)) return jsonError('invalid_image_data',415);
    await initializeRenderer();

    const layout=variant==='social'
      ? createSocialPostLayout({title,badge,image:imageBytes})
      : createSocialCardLayout({title,source,pillar,image:imageBytes,variant:'news',badge:'NOTÍCIAS'});

    const svg=await satori(layout.tree,{
      width:SOCIAL_CARD.width,
      height:SOCIAL_CARD.height,
      fonts:[
        {name:'Cormorant Garamond',data:serifFont,weight:500,style:'normal'},
        {name:'Lato',data:sansRegularFont,weight:400,style:'normal'},
        {name:'Lato',data:sansBoldFont,weight:700,style:'normal'}
      ]
    });
    const renderer=new Resvg(svg,{fitTo:{mode:'original'},background:'#F4EFE5',imageRendering:0,textRendering:2});
    const rendered=renderer.render();
    const png=rendered.asPng();
    const body=new ArrayBuffer(png.byteLength);
    new Uint8Array(body).set(png);
    const contentLength=png.byteLength;
    rendered.free(); renderer.free();
    return new Response(body,{status:200,headers:{'Content-Type':'image/png','Content-Length':String(contentLength),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){
    const code=error instanceof Error?error.message:'render_failed';
    const expected=/^(title|source)_(required|too_long)$|^(badge|variant)_(invalid|too_long)$|^title is too long/u.test(code);
    return jsonError(expected?code:'render_failed',expected?400:500);
  }
}

export const onRequest=async(context:RequestContext)=>{
  if(context.request.method!=='POST') return jsonError('method_not_allowed',405);
  return renderRequest(context);
};
