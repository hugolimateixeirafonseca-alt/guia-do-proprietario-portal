export const SOCIAL_CARD = Object.freeze({
  width:1536,
  height:1024,
  safe:{left:96,right:96,top:72,bottom:72},
  illustrationStart:860,
  label:{left:104,top:82,width:174,height:50},
  title:{left:104,top:178,width:690,maxHeight:582},
  source:{left:104,top:842,width:690},
  brand:{left:104,top:924,width:690},
  editorialShapes:[
    {left:812,top:-170,width:190,height:1240,color:'#F4EFE5',opacity:0.98},
    {left:856,top:-100,width:190,height:700,color:'#183A3D',opacity:0.34},
    {left:826,top:560,width:238,height:170,color:'#B78345',opacity:0.92}
  ]
});

const FONT_SIZES=[76,72,68,64,60,58,56,54,52,50,48,46,44,42,40,38,36];
const ACCENTS={
  vender:'#B77B52',
  impostos:'#C28A62',
  arrendar:'#B77B52',
  condominio:'#C28A62',
  casa:'#B77B52'
};

function characterWidth(character,fontSize) {
  if (/\s/u.test(character)) return fontSize*0.28;
  if (/[ilI1.,:;!'|]/u.test(character)) return fontSize*0.3;
  if (/[mwMW@%&]/u.test(character)) return fontSize*0.88;
  if (/[A-ZÀ-Þ]/u.test(character)) return fontSize*0.66;
  return fontSize*0.53;
}

function textWidth(text,fontSize) {
  return [...text].reduce((total,character)=>total+characterWidth(character,fontSize),0);
}

export function wrapTitle(title,fontSize,maxWidth=SOCIAL_CARD.title.width) {
  const words=String(title||'').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const lines=[];
  let line='';
  for (const word of words) {
    if (textWidth(word,fontSize)>maxWidth) return null;
    const candidate=line ? `${line} ${word}` : word;
    if (line && textWidth(candidate,fontSize)>maxWidth) {
      lines.push(line);
      line=word;
    } else {
      line=candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function selectTitleLayout(title) {
  const exactTitle=String(title||'').trim();
  if (!exactTitle) throw new Error('title is required');
  const length=[...exactTitle].length;
  const category=length<=45?'short':length<=80?'medium':length<=115?'long':'very_long';
  const preferredSize={short:76,medium:66,long:58,very_long:50}[category];
  const maxLines=category==='very_long'?6:5;
  for (const fontSize of FONT_SIZES.filter(size=>size<=preferredSize)) {
    const lines=wrapTitle(exactTitle,fontSize);
    if (!lines) continue;
    const lineHeight=Math.round(fontSize*1.04);
    const height=lines.length*lineHeight;
    if (lines.length<=maxLines && height<=SOCIAL_CARD.title.maxHeight) {
      return {title:exactTitle,category,fontSize,lineHeight,lines,height,maxLines};
    }
  }
  throw new Error('title is too long to fit inside the safe area without truncation');
}

function element(type,style,children,extra={}) {
  return {type,props:{...extra,style,children}};
}

export function createSocialCardLayout({title,source,pillar='casa',image}) {
  const exactSource=String(source||'').trim();
  if (!exactSource) throw new Error('source is required');
  if (!image) throw new Error('base image is required');
  const titleLayout=selectTitleLayout(title);
  const accent=ACCENTS[pillar]||ACCENTS.casa;
  const titleBottom=SOCIAL_CARD.title.top+titleLayout.height;
  const titleNodes=titleLayout.lines.map((line,index)=>element('div',{
    display:'flex',
    width:SOCIAL_CARD.title.width,
    height:titleLayout.lineHeight,
    alignItems:'center'
  },line,{key:`title-${index}`}));
  const shapeNodes=SOCIAL_CARD.editorialShapes.map((shape,index)=>element('div',{
    display:'flex',position:'absolute',left:shape.left,top:shape.top,
    width:shape.width,height:shape.height,borderRadius:'50%',
    backgroundColor:shape.color,
    transform:index===0?'rotate(-8deg)':index===1?'rotate(10deg)':'rotate(-13deg)',
    opacity:shape.opacity
  },null,{key:`editorial-shape-${index}`}));

  const tree=element('div',{
    display:'flex',position:'relative',width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
    overflow:'hidden',backgroundColor:'#F4EFE5'
  },[
    element('img',{
      position:'absolute',left:0,top:0,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
      objectFit:'cover'
    },null,{src:image,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height}),
    element('div',{
      display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_CARD.width,height:SOCIAL_CARD.height,
      backgroundImage:'linear-gradient(90deg, rgba(247,242,233,0.99) 0%, rgba(244,239,229,0.98) 48%, rgba(244,239,229,0.88) 56%, rgba(244,239,229,0.18) 70%, rgba(244,239,229,0) 78%)'
    },null),
    element('div',{
      display:'flex',position:'absolute',left:0,top:0,width:SOCIAL_CARD.illustrationStart,height:SOCIAL_CARD.height,
      backgroundImage:'repeating-linear-gradient(0deg, rgba(24,58,61,0.018) 0px, rgba(24,58,61,0.018) 1px, rgba(244,239,229,0) 1px, rgba(244,239,229,0) 7px)'
    },null),
    ...shapeNodes,
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.label.left,top:SOCIAL_CARD.label.top,
      width:SOCIAL_CARD.label.width,height:SOCIAL_CARD.label.height,borderRadius:27,
      alignItems:'center',justifyContent:'center',backgroundColor:'#183A3D',color:'#F7F2E9',
      fontFamily:'Lato',fontWeight:700,fontSize:22,letterSpacing:3.2
    },'NOTÍCIAS'),
    element('div',{
      display:'flex',position:'absolute',left:104,top:150,width:88,height:4,
      backgroundColor:accent,borderRadius:3
    },null),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.title.left,top:SOCIAL_CARD.title.top,
      width:SOCIAL_CARD.title.width,height:titleLayout.height,flexDirection:'column',
      color:'#183A3D',fontFamily:'Old Standard TT',fontWeight:700,
      fontSize:titleLayout.fontSize,lineHeight:1,letterSpacing:-0.85
    },titleNodes),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.source.left,top:SOCIAL_CARD.source.top,
      width:SOCIAL_CARD.source.width,height:38,alignItems:'center',
      color:'#35595B',fontFamily:'Lato',fontWeight:400,fontSize:25
    },`Fonte: ${exactSource}`),
    element('div',{
      display:'flex',position:'absolute',left:SOCIAL_CARD.brand.left,top:SOCIAL_CARD.brand.top,
      width:SOCIAL_CARD.brand.width,height:34,alignItems:'center',
      color:'#183A3D',fontFamily:'Old Standard TT',fontWeight:700,fontSize:25,letterSpacing:0.1
    },'Guia do Proprietário'),
    element('div',{
      display:'flex',position:'absolute',left:104,top:900,width:108,height:4,
      backgroundColor:accent,borderRadius:2
    },null)
  ],{lang:'pt-PT'});

  return {
    tree,
    metrics:{
      width:SOCIAL_CARD.width,
      height:SOCIAL_CARD.height,
      safe:SOCIAL_CARD.safe,
      illustrationStart:SOCIAL_CARD.illustrationStart,
      editorialShapes:SOCIAL_CARD.editorialShapes,
      label:SOCIAL_CARD.label,
      source:SOCIAL_CARD.source,
      brand:SOCIAL_CARD.brand,
      title:{...SOCIAL_CARD.title,...titleLayout,bottom:titleBottom},
      exactSource
    }
  };
}
