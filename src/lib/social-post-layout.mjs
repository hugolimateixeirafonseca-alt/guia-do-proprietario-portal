export const SOCIAL_POST_CARD=Object.freeze({
  width:1536,
  height:1024,
  panelWidth:800,
  image:{left:800,top:0,width:736,height:1024},
  label:{left:90,top:154,height:58,minWidth:174,maxWidth:360},
  title:{left:90,top:310,width:620,maxHeight:420},
  rule:{left:90,top:842,width:112,height:6},
  brand:{left:90,top:884,width:620,height:40},
  divider:{left:796,top:0,width:4,height:1024}
});

export const SOCIAL_POST_THEME=Object.freeze({
  background:'#F4EFE5',
  ink:'#173C3D',
  petrol:'#173C3D',
  gold:'#B88A4A',
  creamSecondary:'#E9DECC'
});

const FONT_SIZES=[88,84,80,76,72,68,64,60,58];

function characterWidth(character,fontSize){
  if (/\s/u.test(character)) return fontSize*0.25;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.27;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.77;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.58;
  return fontSize*0.47;
}

function textWidth(text,fontSize){
  return [...text].reduce((total,character)=>total+characterWidth(character,fontSize),0);
}

function wrapTitle(title,fontSize,maxWidth){
  const words=String(title||'').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const lines=[];
  let line='';
  for (const word of words){
    if (textWidth(word,fontSize)>maxWidth) return null;
    const candidate=line?`${line} ${word}`:word;
    if (line&&textWidth(candidate,fontSize)>maxWidth){
      lines.push(line);
      line=word;
    }else{
      line=candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function selectSocialPostTitleLayout(title){
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  if ([...exactTitle].length>88) throw new Error('title is too long for social card');
  for (const fontSize of FONT_SIZES){
    const lines=wrapTitle(exactTitle,fontSize,SOCIAL_POST_CARD.title.width);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.02);
    const height=lines.length*lineHeight;
    if (lines.length<=5&&height<=SOCIAL_POST_CARD.title.maxHeight){
      return {title:exactTitle,fontSize,lineHeight,lines,height,maxLines:5};
    }
  }
  throw new Error('title is too long for social card');
}

function element(type,style,children,extra={}){
  return {type,props:{...extra,style,children}};
}

function normalizeBadge(value){
  const badge=String(value||'GUIA').trim().toUpperCase();
  return badge||'GUIA';
}

function badgeWidth(badge){
  return Math.max(
    SOCIAL_POST_CARD.label.minWidth,
    Math.min(SOCIAL_POST_CARD.label.maxWidth,100+[...badge].length*15)
  );
}

export function createSocialPostLayout({title,badge='GUIA',image}){
  if (!image) throw new Error('base image is required');
  const exactBadge=normalizeBadge(badge);
  const titleLayout=selectSocialPostTitleLayout(title);
  const labelWidth=badgeWidth(exactBadge);
  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_POST_CARD.width,height:SOCIAL_POST_CARD.height,
    overflow:'hidden',backgroundColor:SOCIAL_POST_THEME.background
  },[
    element('img',{
      position:'absolute',left:SOCIAL_POST_CARD.image.left,top:0,
      width:SOCIAL_POST_CARD.image.width,height:SOCIAL_POST_CARD.image.height,
      objectFit:'cover',objectPosition:'center center'
    },null,{src:image,width:SOCIAL_POST_CARD.image.width,height:SOCIAL_POST_CARD.image.height}),
    element('div',{
      display:'flex',position:'absolute',left:0,top:0,
      width:SOCIAL_POST_CARD.panelWidth,height:SOCIAL_POST_CARD.height,
      backgroundColor:SOCIAL_POST_THEME.background
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.divider.left,top:0,
      width:SOCIAL_POST_CARD.divider.width,height:SOCIAL_POST_CARD.divider.height,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.82
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.label.left,top:SOCIAL_POST_CARD.label.top,
      width:labelWidth,height:SOCIAL_POST_CARD.label.height,borderRadius:29,
      alignItems:'center',justifyContent:'center',backgroundColor:SOCIAL_POST_THEME.petrol,color:'#F7F2E9',
      fontFamily:'Lato',fontWeight:700,fontSize:25,letterSpacing:exactBadge.length>12?2.1:3.6,
      paddingLeft:22,paddingRight:22
    },exactBadge),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.title.left,top:SOCIAL_POST_CARD.title.top,
      width:SOCIAL_POST_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.35
    },titleLayout.lines.map((line,index)=>element('div',{
      display:'flex',width:SOCIAL_POST_CARD.title.width,height:titleLayout.lineHeight,alignItems:'center'
    },line,{key:`social-title-${index}`}))),
    element('div',{
      display:'flex',position:'absolute',left:90,top:774,width:5,height:5,borderRadius:3,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.56
    },null),
    element('div',{
      display:'flex',position:'absolute',left:112,top:774,width:5,height:5,borderRadius:3,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.34
    },null),
    element('div',{
      display:'flex',position:'absolute',left:134,top:774,width:5,height:5,borderRadius:3,
      backgroundColor:SOCIAL_POST_THEME.gold,opacity:0.2
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.rule.left,top:SOCIAL_POST_CARD.rule.top,
      width:SOCIAL_POST_CARD.rule.width,height:SOCIAL_POST_CARD.rule.height,
      backgroundColor:SOCIAL_POST_THEME.gold
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_POST_CARD.brand.left,top:SOCIAL_POST_CARD.brand.top,
      width:SOCIAL_POST_CARD.brand.width,height:SOCIAL_POST_CARD.brand.height,alignItems:'center',
      color:SOCIAL_POST_THEME.ink,fontFamily:'Cormorant Garamond',fontWeight:500,fontSize:30
    },'Guia do Proprietário')
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      variant:'social',
      badge:exactBadge,
      title:{...SOCIAL_POST_CARD.title,...titleLayout,bottom:SOCIAL_POST_CARD.title.top+titleLayout.height},
      label:{...SOCIAL_POST_CARD.label,width:labelWidth},
      image:{...SOCIAL_POST_CARD.image},
      panelWidth:SOCIAL_POST_CARD.panelWidth,
      exactSource:'',
      source:null
    }
  };
}
